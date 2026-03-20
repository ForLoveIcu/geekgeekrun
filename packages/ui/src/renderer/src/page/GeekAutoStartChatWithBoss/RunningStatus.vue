<template>
  <div class="geek-auto-start-chat-with-boss__running-status">
    <FlyingCompanyLogoList class="flying-company-logo-list" />
    <div class="tip">
      <article>
        <h1>👋 自动开聊正在运行</h1>
        <p>💬 正在为你开聊BOSS，请静候佳音</p>
        <p>📱 你可以在<b>手机</b> / <b>平板电脑</b>上，使用BOSS直聘App与为你开聊的BOSS聊天</p>
        <p>🍀 祝你求职顺利！</p>
      </article>
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
      <el-button :disabled="isStopping" @click="handleStopButtonClick">停止开聊</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import FlyingCompanyLogoList from '../../features/FlyingCompanyLogoList/index.vue'
import { ElMessage } from 'element-plus';
import { gtagRenderer } from '@renderer/utils/gtag'

const { ipcRenderer } = electron
const router = useRouter()

const handleStopButtonClick = async () => {
  gtagRenderer('gascwb_stop_button_clicked')
  ipcRenderer.invoke('stop-geek-auto-start-chat-with-boss')
}

const isStopping = ref(false)
const handleStopping = () => {
  gtagRenderer('gascwb_become_stopping')
  isStopping.value = true
}
ipcRenderer.once('geek-auto-start-chat-with-boss-stopping', handleStopping)

const handleStopped = () => {
  gtagRenderer('gascwb_become_stopped')
  router.replace('/main-layout/GeekAutoStartChatWithBoss')
}
ipcRenderer.once('geek-auto-start-chat-with-boss-stopped', handleStopped)

onUnmounted(() => {
  ipcRenderer.removeListener('geek-auto-start-chat-with-boss-stopped', handleStopped)
  ipcRenderer.removeListener('geek-auto-start-chat-with-boss-stopping', handleStopping)
})

const todayChatCount = ref(0)
const remainCount = ref<number | null>(null)
const hitDailyLimit = ref(false)
const dailyStatsHistory = ref<Array<{ date: string; sessionChatCount: number; hitLimitAt: string }>>([])
const estimatedDailyLimit = computed(() => {
  if (!dailyStatsHistory.value.length) return null
  const counts = dailyStatsHistory.value.map(it => it.sessionChatCount)
  return Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
})
function handleWorkerMessage(_ev, { data }) {
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
ipcRenderer.on('worker-to-gui-message', handleWorkerMessage)
onBeforeUnmount(() => {
  ipcRenderer.removeListener('worker-to-gui-message', handleWorkerMessage)
})

onMounted(async () => {
  try {
    await electron.ipcRenderer.invoke('run-geek-auto-start-chat-with-boss')
  } catch (err) {
    if (err instanceof Error && err.message.includes('NEED_TO_CHECK_RUNTIME_DEPENDENCIES')) {
      gtagRenderer('gascwb_cannot_run_for_corrupt')
      ElMessage.error({
        message: `核心组件损坏，正在尝试修复`
      })
      router.replace('/')
    }
    console.error(err)
    gtagRenderer('gascwb_cannot_run_for_unknown_error', { err })
  }
})
</script>

<style scoped lang="scss">
.geek-auto-start-chat-with-boss__running-status {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  .tip {
    margin: 0 auto;
    margin-top: -15vh;
    max-width: 640px;
  }
  .chat-greet-stats {
    margin-top: 16px;
    padding: 10px 16px;
    background: rgba(0, 164, 128, 0.08);
    border-radius: 8px;
    font-size: 14px;
    color: #333;
    b {
      color: #00a480;
    }
    .hit-limit-tip {
      margin-top: 6px;
      color: #e6a23c;
      font-weight: 500;
    }
    .estimated-limit {
      margin-top: 6px;
      .hint {
        font-size: 12px;
        color: #999;
      }
    }
  }
  .flying-company-logo-list {
    position: absolute;
    inset: 0;
    z-index: -1;
    opacity: 0.25;
  }
}
</style>
