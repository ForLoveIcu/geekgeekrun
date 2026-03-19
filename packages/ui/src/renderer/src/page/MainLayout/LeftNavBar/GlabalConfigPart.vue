<template>
  <div class="group-item">
    <div class="group-title">全局设置</div>
    <div flex flex-col class="link-list">
      <a href="javascript:void(0)" @click="handleClickConfigCommonJobCondition">
        公共职位筛选条件
      </a>
      <a href="javascript:void(0)" @click="handleClickBrowserSetting">
        编辑浏览器偏好<TopRight w-1em h-1em mr10px />
      </a>
      <a href="javascript:void(0)" @click="handleClickConfigLlm">
        配置大语言模型
        <div>
          <el-tooltip
            placement="right"
            :enterable="false"
            @show="gtagRenderer('tooltip_show_for_rnrr_entry')"
          >
            <template #content>
              <div class="font-size-12px">
                支持
                <span
                  class="pl6px pr6px pt4px pb2px color-white border-rd-full font-size-0.8em"
                  style="background-color: #3c4efd"
                  >DeepSeek-V3</span
                >
                <span
                  class="ml4px pl6px pr6px pt4px pb2px color-black border-rd-full font-size-0.8em"
                  style="background-color: #fff"
                  >GPT-4o mini</span
                >
                <span
                  class="ml4px pl6px pr6px pt4px pb2px color-white border-rd-full font-size-0.8em"
                  style="background-color: #462ac4"
                  >Qwen2.5</span
                >
                模型<br />支持多个"服务商-模型"组合按权重搭配使用
              </div>
            </template>
            <QuestionFilled w-1em h-1em mr10px />
          </el-tooltip>
          <TopRight w-1em h-1em mr10px />
        </div>
      </a>
      <a href="javascript:void(0)" @click="handleClickExportConfig">
        导出配置
      </a>
      <a href="javascript:void(0)" @click="handleClickImportConfig">
        导入配置
      </a>
    </div>
  </div>

  <el-dialog
    v-model="exportDialogVisible"
    title="导出配置"
    width="420px"
    :close-on-click-modal="false"
  >
    <div class="font-size-14px mb12px">请选择要导出的内容：</div>
    <el-checkbox-group v-model="exportSelectedKeys">
      <div v-for="item in exportableItemsList" :key="item.key" class="mb8px">
        <el-checkbox :label="item.key">{{ item.label }}</el-checkbox>
      </div>
    </el-checkbox-group>
    <template #footer>
      <el-button @click="exportDialogVisible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="exportSelectedKeys.length === 0"
        :loading="exportLoading"
        @click="handleConfirmExport"
      >导出</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="importDialogVisible"
    title="导入配置"
    width="420px"
    :close-on-click-modal="false"
  >
    <template v-if="importStep === 'select'">
      <div class="font-size-14px mb8px">
        备份时间：{{ importMeta?.exportTime ? new Date(importMeta.exportTime).toLocaleString() : '未知' }}
      </div>
      <div class="font-size-14px mb12px">请选择要导入的内容：</div>
      <el-checkbox-group v-model="importSelectedKeys">
        <div v-for="item in importAvailableCategories" :key="item.key" class="mb8px">
          <el-checkbox :label="item.key">{{ item.label }}</el-checkbox>
        </div>
      </el-checkbox-group>
    </template>
    <template v-else-if="importStep === 'result'">
      <div v-if="importResult">
        <div v-if="importResult.imported?.length" class="mb8px">
          <div class="font-size-14px font-bold mb4px" style="color: #67c23a">成功导入：</div>
          <div v-for="f in importResult.imported" :key="f" class="font-size-12px ml12px">{{ f }}</div>
        </div>
        <div v-if="importResult.errors?.length" class="mb8px">
          <div class="font-size-14px font-bold mb4px" style="color: #f56c6c">导入失败：</div>
          <div v-for="f in importResult.errors" :key="f" class="font-size-12px ml12px">{{ f }}</div>
        </div>
      </div>
    </template>
    <template #footer>
      <template v-if="importStep === 'select'">
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="importSelectedKeys.length === 0"
          :loading="importLoading"
          @click="handleConfirmImport"
        >导入</el-button>
      </template>
      <template v-else>
        <el-button type="primary" @click="importDialogVisible = false">确定</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { gtagRenderer } from '@renderer/utils/gtag'
import { ElMessage } from 'element-plus'
import { TopRight, QuestionFilled } from '@element-plus/icons-vue'

const handleClickBrowserSetting = async () => {
  gtagRenderer('browser_setting_clicked')
  try {
    await electron.ipcRenderer.invoke('config-with-browser-assistant')
    ElMessage({
      type: 'success',
      message: '浏览器偏好保存成功'
    })
  } catch {
    //
  }
}

const handleClickConfigLlm = async () => {
  gtagRenderer('config_llm_clicked')
  try {
    await electron.ipcRenderer.invoke('llm-config')
  } catch (err) {
    console.log(err)
  }
}

const handleClickConfigCommonJobCondition = async () => {
  gtagRenderer('config_cjc_clicked', { entry: 'left-nav' })
  try {
    await electron.ipcRenderer.invoke('common-job-condition-config')
  } catch (err) {
    console.log(err)
  }
}

// ===== Export config =====
const exportDialogVisible = ref(false)
const exportLoading = ref(false)
const exportSelectedKeys = ref<string[]>([])
const exportableItemsList = ref<Array<{ key: string; label: string }>>([])

const handleClickExportConfig = async () => {
  gtagRenderer('export_config_clicked')
  try {
    const items = await electron.ipcRenderer.invoke('get-exportable-items')
    exportableItemsList.value = Object.entries(items).map(([key, val]: [string, any]) => ({
      key,
      label: val.label
    }))
    exportSelectedKeys.value = exportableItemsList.value.map((it) => it.key)
    exportDialogVisible.value = true
  } catch (err) {
    ElMessage({ type: 'error', message: '获取导出项失败' })
    console.log(err)
  }
}

const handleConfirmExport = async () => {
  exportLoading.value = true
  try {
    const options: Record<string, boolean> = {}
    for (const item of exportableItemsList.value) {
      options[item.key] = exportSelectedKeys.value.indexOf(item.key) !== -1
    }
    const result = await electron.ipcRenderer.invoke('export-config', options)
    if (result.canceled) {
      return
    }
    if (result.success) {
      ElMessage({ type: 'success', message: '配置导出成功' })
      exportDialogVisible.value = false
    } else {
      ElMessage({ type: 'error', message: '导出失败' })
    }
  } catch (err) {
    ElMessage({ type: 'error', message: '导出失败' })
    console.log(err)
  } finally {
    exportLoading.value = false
  }
}

// ===== Import config =====
const importDialogVisible = ref(false)
const importLoading = ref(false)
const importStep = ref<'select' | 'result'>('select')
const importSelectedKeys = ref<string[]>([])
const importAvailableCategories = ref<Array<{ key: string; label: string }>>([])
const importMeta = ref<{ exportTime?: string } | null>(null)
const importResult = ref<{ imported?: string[]; errors?: string[] } | null>(null)

const handleClickImportConfig = async () => {
  gtagRenderer('import_config_clicked')
  try {
    const result = await electron.ipcRenderer.invoke('import-config-read-file')
    if (result.canceled) {
      return
    }
    if (!result.success) {
      ElMessage({ type: 'error', message: result.error || '读取备份文件失败' })
      return
    }
    importMeta.value = result.meta
    importAvailableCategories.value = result.availableCategories
    importSelectedKeys.value = result.availableCategories.map((it: any) => it.key)
    importStep.value = 'select'
    importResult.value = null
    importDialogVisible.value = true
  } catch (err) {
    ElMessage({ type: 'error', message: '读取备份文件失败' })
    console.log(err)
  }
}

const handleConfirmImport = async () => {
  importLoading.value = true
  try {
    const result = await electron.ipcRenderer.invoke('import-config-apply', importSelectedKeys.value)
    if (result.success) {
      importResult.value = { imported: result.imported, errors: result.errors }
      importStep.value = 'result'
      if (!result.errors?.length) {
        ElMessage({ type: 'success', message: '配置导入成功' })
      } else {
        ElMessage({ type: 'warning', message: '部分配置导入失败，请查看详情' })
      }
    } else {
      ElMessage({ type: 'error', message: result.error || '导入失败' })
    }
  } catch (err) {
    ElMessage({ type: 'error', message: '导入失败' })
    console.log(err)
  } finally {
    importLoading.value = false
  }
}
</script>

<style scoped lang="scss" src="./style.scss"></style>
