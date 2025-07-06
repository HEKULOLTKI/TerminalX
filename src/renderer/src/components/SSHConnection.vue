<template>
  <div class="ssh-connection-wrapper">
    <div class="connection-header">
      <span class="status-indicator" :class="status"></span>
      <span class="connection-name">{{ session.name }}</span>
      <div class="header-actions">
        <el-tooltip content="隧道管理" placement="top">
          <el-button
            type="primary"
            :icon="Share"
            circle
            size="small"
            @click="showTunnelManager = true"
          />
        </el-tooltip>
        <el-button
          type="danger"
          :icon="Close"
          circle
          size="small"
          @click="$emit('disconnect')"
        />
      </div>
    </div>
    <div class="terminal-container" ref="terminalContainer"></div>

    <!-- 隧道管理器 -->
    <SSHTunnelManager
      v-if="session.connectionId"
      :visible="showTunnelManager"
      :connection-id="session.connectionId"
      @update:visible="showTunnelManager = $event"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Close, Share } from '@element-plus/icons-vue'
import SSHTunnelManager from './SSHTunnelManager.vue'

const props = defineProps({
  session: {
    type: Object,
    required: true
  }
})

defineEmits(['disconnect'])

const terminalContainer = ref(null)
const status = ref('connecting') // connecting, connected, disconnected
const showTunnelManager = ref(false)

let term = null
let fitAddon = null

const setupTerminal = () => {
  if (!terminalContainer.value) return

  term = new Terminal({
    cursorBlink: true,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 14,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4'
    }
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(terminalContainer.value)
  fitAddon.fit()

  term.onData((data) => {
    if (props.session.connectionId) {
      window.api.ssh.write(props.session.connectionId, data)
    }
  })

  // 监听窗口大小变化
  window.addEventListener('resize', resizeTerminal)
}

const resizeTerminal = () => {
  if (fitAddon && term) {
    fitAddon.fit()
    if (props.session.connectionId) {
      window.api.ssh.resize(props.session.connectionId, term.cols, term.rows)
    }
  }
}

// IPC 监听器
const handleSshData = (connectionId, data) => {
  if (connectionId === props.session.connectionId && term) {
    term.write(data)
  }
}

const handleSshReady = (connectionId) => {
  if (connectionId === props.session.connectionId) {
    status.value = 'connected'
    nextTick(() => {
      resizeTerminal()
    })
  }
}

const handleSshClose = (connectionId) => {
  if (connectionId === props.session.connectionId) {
    status.value = 'disconnected'
    if (term) {
      term.writeln('\r\n\x1b[31m连接已断开\x1b[0m')
    }
  }
}

const handleSshError = (connectionId, error) => {
  if (connectionId === props.session.connectionId) {
    status.value = 'disconnected'
    if (term) {
      term.writeln(`\r\n\x1b[31m连接错误: ${error}\x1b[0m`)
    }
  }
}

onMounted(() => {
  setupTerminal()

  // 注册IPC监听
  window.api.ssh.onData((event, connectionId, data) => handleSshData(connectionId, data))
  window.api.ssh.onReady((event, connectionId) => handleSshReady(connectionId))
  window.api.ssh.onClose((event, connectionId) => handleSshClose(connectionId))
  window.api.ssh.onError((event, connectionId, error) => handleSshError(connectionId, error))

  if (props.session.connectionId) {
    status.value = 'connected'
     nextTick(() => {
      resizeTerminal()
    })
  }
})

onUnmounted(() => {
  // 移除IPC监听
  window.api.ssh.removeAllListeners('ssh:data')
  window.api.ssh.removeAllListeners('ssh:ready')
  window.api.ssh.removeAllListeners('ssh:close')
  window.api.ssh.removeAllListeners('ssh:error')

  window.removeEventListener('resize', resizeTerminal)

  if (term) {
    term.dispose()
  }
})
</script>

<style scoped>
.ssh-connection-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
}

.connection-header {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background-color: #333;
  color: #fff;
  font-size: 12px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: #f1c40f; /* connecting */
}
.status-indicator.connected {
  background-color: #2ecc71; /* connected */
}
.status-indicator.disconnected {
  background-color: #e74c3c; /* disconnected */
}

.connection-name {
  flex-grow: 1;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.terminal-container {
  flex-grow: 1;
  overflow: hidden;
  padding: 5px;
}
</style> 