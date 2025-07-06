<template>
  <div class="serial-connection-wrapper">
    <div class="connection-header">
      <span class="status-indicator" :class="status"></span>
      <span class="connection-name">{{ session.name }}</span>
      <div class="header-controls">
        <el-select v-model="encoding" placeholder="编码" size="small" style="width: 100px;">
          <el-option label="UTF-8" value="utf8" />
          <el-option label="Hex" value="hex" />
          <el-option label="Base64" value="base64" />
        </el-select>
        <el-switch v-model="dtr" active-text="DTR" @change="handleDtrChange" />
        <el-switch v-model="rts" active-text="RTS" @change="handleRtsChange" />
      </div>
      <div class="header-actions">
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
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { serialService } from './services/serial'

const props = defineProps({
  session: {
    type: Object,
    required: true
  }
})

defineEmits(['disconnect'])

const terminalContainer = ref(null)
const status = ref('connecting') // connecting, connected, disconnected
const encoding = ref('utf8')
const dtr = ref(false)
const rts = ref(false)

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
    },
    convertEol: true // 自动将\n转为\r\n
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(terminalContainer.value)
  fitAddon.fit()

  term.onData((data) => {
    if (props.session.connectionId) {
      window.serial.write(props.session.connectionId, data, encoding.value)
    }
  })

  window.addEventListener('resize', resizeTerminal)
}

const resizeTerminal = () => {
  if (fitAddon) {
    fitAddon.fit()
  }
}

const handleDtrChange = async (value) => {
  if (props.session.connectionId) {
    const result = await window.serial.setControlLines(props.session.connectionId, { dtr: value })
    if (!result.success) {
      ElMessage.error(`设置DTR失败: ${result.error}`)
      dtr.value = !value // 恢复原状
    }
  }
}

const handleRtsChange = async (value) => {
  if (props.session.connectionId) {
    const result = await window.serial.setControlLines(props.session.connectionId, { rts: value })
    if (!result.success) {
      ElMessage.error(`设置RTS失败: ${result.error}`)
      rts.value = !value // 恢复原状
    }
  }
}

// IPC 监听器
const handleSerialData = (data) => {
  if (term) {
    term.write(data)
  }
}

const handleSerialReady = () => {
  status.value = 'connected'
  nextTick(() => {
    resizeTerminal()
  })
}

const handleSerialClose = () => {
  status.value = 'disconnected'
  if (term) {
    term.writeln('\r\n\x1b[31m连接已断开\x1b[0m')
  }
}

const handleSerialError = (error) => {
  status.value = 'disconnected'
  if (term) {
    term.writeln(`\r\n\x1b[31m连接错误: ${error}\x1b[0m`)
  }
}

onMounted(() => {
  setupTerminal()

  // 注册IPC监听
  if (props.session.connectionId) {
    serialService.on(props.session.connectionId, 'data', handleSerialData)
    serialService.on(props.session.connectionId, 'ready', handleSerialReady)
    serialService.on(props.session.connectionId, 'close', handleSerialClose)
    serialService.on(props.session.connectionId, 'error', handleSerialError)

    // 如果连接已经就绪，手动触发一次状态更新
    const connectionInfo = serialService.getConnection(props.session.connectionId)
    if (connectionInfo) {
      status.value = 'connected'
       nextTick(() => {
        resizeTerminal()
      })
    }
  }
})

onUnmounted(() => {
  // 移除IPC监听
  if (props.session.connectionId) {
    serialService.off(props.session.connectionId, 'data', handleSerialData)
    serialService.off(props.session.connectionId, 'ready', handleSerialReady)
    serialService.off(props.session.connectionId, 'close', handleSerialClose)
    serialService.off(props.session.connectionId, 'error', handleSerialError)
  }

  window.removeEventListener('resize', resizeTerminal)

  if (term) {
    term.dispose()
  }
})
</script>

<style scoped>
.serial-connection-wrapper {
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
  gap: 16px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: -8px; 
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

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
}

.terminal-container {
  flex-grow: 1;
  overflow: hidden;
  padding: 5px;
}

:deep(.el-switch__label) {
  color: #fff !important;
}

</style> 