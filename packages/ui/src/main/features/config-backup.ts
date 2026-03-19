import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'node:fs'
import fsPromise from 'node:fs/promises'
import path from 'node:path'
import {
  configFileNameList,
  readConfigFile,
  writeConfigFile,
  storageFilePath,
  storageFileNameList,
  readStorageFile,
  writeStorageFile,
  ensureConfigFileExist,
  ensureStorageFileExist,
  getPublicDbFilePath
} from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'

interface ExportOptions {
  configFiles: boolean
  storageFiles: boolean
  promptTemplates: boolean
  database: boolean
  resumes: boolean
}

const PROMPT_TEMPLATE_FILES = [
  'auto-reminder-resume-system-message-template.md',
  'auto-reminder-open-message-template.md'
]

function getExportableItems() {
  return {
    configFiles: {
      label: '配置文件（职位筛选、钉钉通知、LLM配置等）',
      files: configFileNameList
    },
    resumes: {
      label: '简历内容',
      files: ['resumes.json']
    },
    storageFiles: {
      label: '存储文件（登录凭据、localStorage等）',
      files: storageFileNameList
    },
    promptTemplates: {
      label: '提示词模板（自动复聊提示词）',
      files: PROMPT_TEMPLATE_FILES
    },
    database: {
      label: '运行记录数据库（public.db）',
      files: ['public.db']
    }
  }
}

async function exportConfig(options: ExportOptions): Promise<Record<string, unknown>> {
  const backup: Record<string, unknown> = {
    _meta: {
      version: 1,
      exportTime: new Date().toISOString(),
      options
    }
  }

  if (options.configFiles) {
    ensureConfigFileExist()
    const configData: Record<string, unknown> = {}
    for (const fileName of configFileNameList) {
      try {
        configData[fileName] = readConfigFile(fileName)
      } catch {
        // skip unreadable files
      }
    }
    backup.config = configData
  }

  if (options.resumes) {
    try {
      const resumes = readConfigFile('resumes.json')
      if (resumes) {
        backup.resumes = resumes
      }
    } catch {
      // skip
    }
  }

  if (options.storageFiles) {
    ensureStorageFileExist()
    const storageData: Record<string, unknown> = {}
    for (const fileName of storageFileNameList) {
      try {
        storageData[fileName] = readStorageFile(fileName)
      } catch {
        // skip
      }
    }
    backup.storage = storageData
  }

  if (options.promptTemplates) {
    const promptData: Record<string, string> = {}
    for (const fileName of PROMPT_TEMPLATE_FILES) {
      const filePath = path.join(storageFilePath, fileName)
      if (fs.existsSync(filePath)) {
        try {
          promptData[fileName] = fs.readFileSync(filePath, 'utf-8')
        } catch {
          // skip
        }
      }
    }
    backup.promptTemplates = promptData
  }

  if (options.database) {
    const dbPath = getPublicDbFilePath()
    if (fs.existsSync(dbPath)) {
      try {
        const dbBuffer = await fsPromise.readFile(dbPath)
        backup.database = {
          'public.db': dbBuffer.toString('base64')
        }
      } catch {
        // skip
      }
    }
  }

  return backup
}

async function importConfig(
  backupData: Record<string, unknown>,
  selectedCategories: string[]
): Promise<{ imported: string[]; errors: string[] }> {
  const imported: string[] = []
  const errors: string[] = []

  if (selectedCategories.indexOf('config') !== -1 && backupData.config) {
    ensureConfigFileExist()
    const configData = backupData.config as Record<string, unknown>
    for (const [fileName, content] of Object.entries(configData)) {
      try {
        await writeConfigFile(fileName, content)
        imported.push(`config/${fileName}`)
      } catch {
        errors.push(`config/${fileName}`)
      }
    }
  }

  if (selectedCategories.indexOf('resumes') !== -1 && backupData.resumes) {
    try {
      await writeConfigFile('resumes.json', backupData.resumes)
      imported.push('config/resumes.json')
    } catch {
      errors.push('config/resumes.json')
    }
  }

  if (selectedCategories.indexOf('storage') !== -1 && backupData.storage) {
    ensureStorageFileExist()
    const storageData = backupData.storage as Record<string, unknown>
    for (const [fileName, content] of Object.entries(storageData)) {
      try {
        await writeStorageFile(fileName, content)
        imported.push(`storage/${fileName}`)
      } catch {
        errors.push(`storage/${fileName}`)
      }
    }
  }

  if (selectedCategories.indexOf('promptTemplates') !== -1 && backupData.promptTemplates) {
    const promptData = backupData.promptTemplates as Record<string, string>
    for (const [fileName, content] of Object.entries(promptData)) {
      try {
        await writeStorageFile(fileName, content, { isJson: false } as any)
        imported.push(`storage/${fileName}`)
      } catch {
        errors.push(`storage/${fileName}`)
      }
    }
  }

  if (selectedCategories.indexOf('database') !== -1 && backupData.database) {
    const dbData = backupData.database as Record<string, string>
    const base64Content = dbData['public.db']
    if (base64Content) {
      try {
        const dbPath = getPublicDbFilePath()
        const buffer = Buffer.from(base64Content, 'base64')
        await fsPromise.writeFile(dbPath, buffer)
        imported.push('storage/public.db')
      } catch {
        errors.push('storage/public.db')
      }
    }
  }

  return { imported, errors }
}

let _lastReadBackupFilePath: string | null = null

export function initConfigBackupIpc() {
  ipcMain.handle('get-exportable-items', () => {
    return getExportableItems()
  })

  ipcMain.handle('export-config', async (ev, options: ExportOptions) => {
    const win = BrowserWindow.fromWebContents(ev.sender) || undefined
    const backup = await exportConfig(options)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
    const defaultFileName = `geekgeekrun-backup-${timestamp}.json`

    const dialogOptions: Electron.SaveDialogOptions = {
      title: '导出配置备份',
      defaultPath: defaultFileName,
      filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
    }

    const result = win
      ? await dialog.showSaveDialog(win, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    await fsPromise.writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf-8')
    return { success: true, filePath: result.filePath }
  })

  ipcMain.handle('import-config-read-file', async (ev) => {
    const win = BrowserWindow.fromWebContents(ev.sender) || undefined

    const dialogOptions: Electron.OpenDialogOptions = {
      title: '选择配置备份文件',
      filters: [{ name: 'JSON 备份文件', extensions: ['json'] }],
      properties: ['openFile']
    }

    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true }
    }

    try {
      const content = await fsPromise.readFile(result.filePaths[0], 'utf-8')
      const backupData = JSON.parse(content)
      if (!backupData._meta || backupData._meta.version !== 1) {
        return { success: false, error: '不是有效的 geekgeekrun 备份文件' }
      }

      _lastReadBackupFilePath = result.filePaths[0]

      const availableCategories: Array<{ key: string; label: string }> = []
      if (backupData.config) {
        availableCategories.push({ key: 'config', label: '配置文件' })
      }
      if (backupData.resumes) {
        availableCategories.push({ key: 'resumes', label: '简历内容' })
      }
      if (backupData.storage) {
        availableCategories.push({ key: 'storage', label: '存储文件（登录凭据等）' })
      }
      if (backupData.promptTemplates) {
        availableCategories.push({ key: 'promptTemplates', label: '提示词模板' })
      }
      if (backupData.database) {
        availableCategories.push({ key: 'database', label: '运行记录数据库' })
      }

      return {
        success: true,
        meta: backupData._meta,
        availableCategories
      }
    } catch {
      return { success: false, error: '文件解析失败，请确认文件格式' }
    }
  })

  ipcMain.handle('import-config-apply', async (_ev, selectedCategories: string[]) => {
    if (!_lastReadBackupFilePath) {
      return { success: false, error: '未找到待导入的备份文件，请重新选择' }
    }

    try {
      const content = await fsPromise.readFile(_lastReadBackupFilePath, 'utf-8')
      const backupData = JSON.parse(content)
      const result = await importConfig(backupData, selectedCategories)
      _lastReadBackupFilePath = null
      return { success: true, ...result }
    } catch {
      return { success: false, error: '导入失败' }
    }
  })
}
