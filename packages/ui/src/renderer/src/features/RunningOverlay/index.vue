<template>
  <el-dialog
    modal-class="running-overlay__modal"
    :model-value="isDialogVisible"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    width="400px"
    @closed="fillEmptySteps"
  >
    <div flex flex-col flex-items-center>
      <div class="dialog-header" w-full>
        <div
          h160px
          w-full
          :style="{
            backgroundImage: 'linear-gradient(#666, #666)'
          }"
        ></div>
      </div>
      <div class="dialog-main" w-full mt--20px>
        <!-- v-if="stepsForRender.some(it => ['todo', 'pending', 'rejected'].includes(it.status))" -->
        <div>
          <ul m0 pl0>
            <li
              v-for="(item, index) in stepsForRender"
              :key="index"
              list-style-none
              flex
              justify-start
              pt4px
              pb4px
            >
              <div>
                <span v-if="item.status === 'todo'">🕐</span>
                <span v-if="item.status === 'pending'">👉</span>
                <span v-if="item.status === 'fulfilled'">✅</span>
                <span v-if="item.status === 'rejected'">⛔️</span>
              </div>
              <span ml8px>{{ item.describe }}</span>
            </li>
          </ul>
        </div>
        <div v-if="todayChatCount > 0 || hitDailyLimit" class="chat-greet-stats">
          <div v-if="todayChatCount > 0">
            <span>📊 今日已开聊 <b>{{ todayChatCount }}</b> 次</span>
            <span v-if="remainCount !== null"> · 今日剩余 <b>{{ remainCount }}</b> 次</span>
          </div>
          <div v-if="hitDailyLimit" class="hit-limit-tip">⚠️ 今日沟通人数已达上限</div>
          <div v-if="estimatedDailyLimit !== null" class="estimated-limit">
            <span>📈 推测每日上限约 <b>{{ estimatedDailyLimit }}</b> 次</span>
            <span class="hint">(基于 {{ dailyStatsHistory.length }} 次历史达上限记录)</span>
          </div>
        </div>
        <div v-if="cityStatus" class="city-status-panel">
          <div class="city-status-header">🏙️ 城市轮换状态</div>
          <div class="city-status-row">
            <span class="city-status-label">阶段</span>
            <span class="city-status-value">{{ cityStatus.phase }}</span>
          </div>
          <div v-if="cityStatus.sleepSec !== null" class="city-status-row">
            <span class="city-status-label">休息</span>
            <span class="city-status-value">{{ cityStatus.sleepSec }} 秒</span>
          </div>
          <div class="city-status-row">
            <span class="city-status-label">当前城市</span>
            <span class="city-status-value city-status-city">{{ cityStatus.currentCity }}</span>
          </div>
          <div class="city-status-row">
            <span class="city-status-label">策略</span>
            <span class="city-status-value">{{ cityStatus.strategy }}</span>
          </div>
          <div class="city-status-row">
            <span class="city-status-label">下一个</span>
            <span class="city-status-value city-status-city">{{ cityStatus.nextCity }}</span>
          </div>
          <div v-if="cityStatus.roundRobinInfo" class="city-status-row">
            <span class="city-status-label">轮换</span>
            <span class="city-status-value">本轮 {{ cityStatus.roundRobinInfo.visitedThisRound }}/{{ cityStatus.roundRobinInfo.totalSources }}</span>
          </div>
          <div v-if="Object.keys(cityStatus.cityVisitCount || {}).length" class="city-status-stats">
            <span v-for="(count, city) in cityStatus.cityVisitCount" :key="city" class="city-stat-tag">
              {{ city }}: {{ count }}次
            </span>
          </div>
        </div>
        <div flex justify-between items-center w-full>
          <div>
            {{ runningStatusTextMapByCode[currentRunningStatus] }}
          </div>
          <div>
            <slot name="op-buttons" :current-running-status="currentRunningStatus" />
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
// import { useTaskManagerStore } from '@renderer/store'
import { getAutoStartChatSteps } from '../../../../common/prerequisite-step-by-step-check'
import { computed, onUnmounted, onBeforeUnmount, ref, watch } from 'vue'
import {
  AUTO_CHAT_ERROR_EXIT_CODE,
  RUNNING_STATUS_ENUM
} from '../../../../common/enums/auto-start-chat'
import { gtagRenderer } from '@renderer/utils/gtag'
const props = defineProps({
  workerId: {
    type: String
  },
  runRecordId: {
    type: Number
  }
})
// const taskManagerStore = useTaskManagerStore()
// const runningTaskInfo = computed(() => {
//   return taskManagerStore.runningTasks?.find((it) => {
//     return it.workerId === props.workerId
//   })
// })
const steps = ref([])
const stepsForRender = computed(() => {
  const clonedSteps = JSON.parse(JSON.stringify(steps.value))
  if (clonedSteps.some((it) => it.status === 'rejected')) {
    return clonedSteps
  }
  const lastFulfilledIndex = clonedSteps.findLastIndex((it) => it.status === 'fulfilled')
  if (lastFulfilledIndex + 1 < clonedSteps.length) {
    clonedSteps[lastFulfilledIndex + 1].status = 'pending'
  }
  return clonedSteps
})
const runningStatusTextMapByCode = {
  [RUNNING_STATUS_ENUM.RUNNING]: '正在运行中',
  [RUNNING_STATUS_ENUM.NORMAL_EXITED]: '程序已正常退出',
  [RUNNING_STATUS_ENUM.ERROR_EXITED]: '程序异常退出'
}
const currentRunningStatus = ref(RUNNING_STATUS_ENUM.RUNNING)
function fillEmptySteps() {
  const arr = getAutoStartChatSteps()
  arr.forEach((it) => (it.status = 'todo'))
  steps.value = arr
  currentRunningStatus.value = RUNNING_STATUS_ENUM.RUNNING
}
watch(() => props.runRecordId, fillEmptySteps, {
  immediate: true
})
watch(
  () => stepsForRender.value,
  (v) => {
    const rejectedItems = v?.filter((it) => it.status === 'rejected')
    if (!rejectedItems.length) {
      return
    }
    gtagRenderer('running_overlay_rejected', {
      stepId: rejectedItems.map((it) => it.id).join(','),
      workerId: props.workerId
    })
  },
  { deep: true }
)

const { ipcRenderer } = electron
function messageHandler(ev, { data }) {
  if (
    data.type !== 'prerequisite-step-by-step-checkstep-by-step-check' ||
    data.runRecordId !== props.runRecordId
  ) {
    return
  }
  const { id: stepId, status: stepStatus } = data.step
  const targetStep = steps.value.find((it) => it.id === stepId)
  if (!targetStep) {
    return
  }
  targetStep.status = stepStatus
}
const unListenMessage = ipcRenderer.on('worker-to-gui-message', messageHandler)
onUnmounted(unListenMessage)

// Chat greet count stats
const todayChatCount = ref(0)
const remainCount = ref<number | null>(null)
const hitDailyLimit = ref(false)
const dailyStatsHistory = ref<Array<{ date: string; sessionChatCount: number; hitLimitAt: string }>>([])
const estimatedDailyLimit = computed(() => {
  if (!dailyStatsHistory.value.length) return null
  const counts = dailyStatsHistory.value.map(it => it.sessionChatCount)
  return Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
})
// Load initial today count from persisted file
async function loadTodayCount() {
  try {
    const data = await ipcRenderer.invoke('read-storage-file', { fileName: 'chat-greet-today-count.json' })
    const todayStr = new Date().toISOString().slice(0, 10)
    if (data?.date === todayStr) {
      todayChatCount.value = data.count ?? 0
    } else {
      todayChatCount.value = 0
    }
  } catch {
    todayChatCount.value = 0
  }
  try {
    const stats = await ipcRenderer.invoke('read-storage-file', { fileName: 'chat-greet-daily-stats.json' })
    if (Array.isArray(stats)) {
      dailyStatsHistory.value = stats
    }
  } catch {}
}
loadTodayCount()
function handleChatGreetMessage(_ev, { data }) {
  if (data.type === 'chat-greet-count-updated') {
    todayChatCount.value = data.countInfo.todayChatCount ?? todayChatCount.value
    remainCount.value = data.countInfo.remainCount ?? remainCount.value
    if (data.countInfo.hitDailyLimit) {
      hitDailyLimit.value = true
    }
    if (Array.isArray(data.countInfo.dailyStatsHistory)) {
      dailyStatsHistory.value = data.countInfo.dailyStatsHistory
    }
  }
}
ipcRenderer.on('worker-to-gui-message', handleChatGreetMessage)

// City status listener
const cityStatus = ref<{
  phase: string
  sleepSec: number | null
  currentCity: string
  nextCity: string
  strategy: string
  cityVisitCount: Record<string, number>
  roundRobinInfo: { counter: number; visitedThisRound: number; totalSources: number } | null
} | null>(null)
function handleCityStatusMessage(_ev, { data }) {
  if (data.type === 'city-status-updated') {
    cityStatus.value = data.statusInfo
  }
}
ipcRenderer.on('worker-to-gui-message', handleCityStatusMessage)
onBeforeUnmount(() => {
  ipcRenderer.removeListener('worker-to-gui-message', handleChatGreetMessage)
  ipcRenderer.removeListener('worker-to-gui-message', handleCityStatusMessage)
})
// Reload today count when dialog re-opens (new run)
watch(() => props.runRecordId, () => {
  loadTodayCount()
  hitDailyLimit.value = false
  cityStatus.value = null
})

const isDialogVisible = ref(false)
const show = () => {
  isDialogVisible.value = true
}
const hide = () => {
  isDialogVisible.value = false
}
watch(
  () => isDialogVisible.value,
  (newVal) => {
    if (!newVal) {
      gtagRenderer('running_overlay_shown')
    } else {
      gtagRenderer('running_overlay_hidden')
    }
  }
)
defineExpose({
  show,
  hide
})
ipcRenderer.on('worker-exited', (ev, payload) => {
  const { workerId, code } = payload
  if (
    workerId !== props.workerId
    // || runRecordId !== props.runRecordId
  ) {
    return
  }
  if (code !== AUTO_CHAT_ERROR_EXIT_CODE.NORMAL) {
    currentRunningStatus.value = RUNNING_STATUS_ENUM.ERROR_EXITED
    gtagRenderer('running_overlay_error_exited', {
      exitCode: code,
      workerId: props.workerId
    })
  } else {
    currentRunningStatus.value = RUNNING_STATUS_ENUM.NORMAL_EXITED
    gtagRenderer('running_overlay_normal_exited', {
      exitCode: code,
      workerId: props.workerId
    })
  }
})
</script>

<style lang="scss">
.el-overlay.running-overlay__modal {
  position: absolute;
  width: 100%;
  height: 100%;
  backdrop-filter: blur(3px);

  background-color: transparent;
  background-image: radial-gradient(transparent 1px, #fff 1px);
  background-size: 4px 4px;

  .el-overlay-dialog {
    position: absolute;
    pointer-events: all;
  }
  .el-dialog {
    margin: 0;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    .el-dialog__header {
      display: none;
    }
    .el-dialog__body {
      // overflow: hidden;
    }
    .dialog-header {
      display: none;
      // display: flex;
      // justify-content: center;
      // border-radius: 20px 20px 0 0;
      // overflow: hidden;
    }
    background-color: transparent;
    box-shadow: none;
    padding: 0;
    border-radius: 0;
    .dialog-main {
      box-sizing: border-box;
      background: var(--el-dialog-bg-color);
      box-shadow: var(--el-dialog-box-shadow);
      padding: var(--el-dialog-padding-primary);
      //border-radius: 0 0 20px 20px;
      border-radius: 20px;
      .chat-greet-stats {
        margin-top: 12px;
        margin-bottom: 8px;
        padding: 10px 14px;
        background: rgba(0, 164, 128, 0.08);
        border-radius: 8px;
        font-size: 13px;
        color: #333;
        b {
          color: #00a480;
        }
        .hit-limit-tip {
          margin-top: 4px;
          color: #e6a23c;
          font-weight: 500;
        }
        .estimated-limit {
          margin-top: 4px;
          .hint {
            font-size: 12px;
            color: #999;
          }
        }
      }
      .city-status-panel {
        margin-top: 8px;
        margin-bottom: 8px;
        padding: 10px 14px;
        background: rgba(64, 158, 255, 0.06);
        border-radius: 8px;
        font-size: 13px;
        color: #333;
        .city-status-header {
          font-weight: 600;
          margin-bottom: 6px;
          color: #409eff;
        }
        .city-status-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          .city-status-label {
            color: #999;
            min-width: 60px;
          }
          .city-status-value {
            text-align: right;
            flex: 1;
          }
          .city-status-city {
            color: #409eff;
            font-weight: 500;
          }
        }
        .city-status-stats {
          margin-top: 6px;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          .city-stat-tag {
            background: rgba(64, 158, 255, 0.1);
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 12px;
            color: #409eff;
          }
        }
      }
    }
  }
}
</style>
