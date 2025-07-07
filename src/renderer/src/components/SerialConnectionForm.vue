<template>
  <div class="serial-connection-form">
    <form @submit.prevent="connect">
      <div class="form-group">
        <label for="name">连接名称</label>
        <input type="text" id="name" v-model="connection.name" placeholder="例如：我的设备">
      </div>
      <div class="form-group">
        <label for="port">串口</label>
        <select id="port" v-model="connection.port" required>
          <option v-if="ports.length === 0" disabled value="">正在加载端口...</option>
          <option v-for="port in ports" :key="port.path" :value="port.path">
            {{ port.path }} {{ port.displayName ? `(${port.displayName})` : '' }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label for="baudRate">波特率</label>
        <select id="baudRate" v-model="connection.baudRate" required>
          <option v-for="rate in baudRates" :key="rate" :value="rate">{{ rate }}</option>
        </select>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="dataBits">数据位</label>
          <select id="dataBits" v-model="connection.dataBits">
            <option>8</option>
            <option>7</option>
          </select>
        </div>
        <div class="form-group">
          <label for="stopBits">停止位</label>
          <select id="stopBits" v-model="connection.stopBits">
            <option>1</option>
            <option>2</option>
          </select>
        </div>
        <div class="form-group">
          <label for="parity">校验位</label>
          <select id="parity" v-model="connection.parity">
            <option value="none">无</option>
            <option value="even">偶校验</option>
            <option value="odd">奇校验</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" @click="$emit('close')">取消</button>
        <button type="submit" class="primary">连接</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      port: '',
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    })
  },
  editing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['connect', 'close'])

const connection = ref({})

watch(() => props.initialData, (newData) => {
  connection.value = { ...newData }
}, { deep: true, immediate: true })

const ports = ref([])
const baudRates = ref([
  9600,
  19200,
  38400,
  57600,
  115200,
  230400,
  460800,
  921600
])

onMounted(async () => {
  try {
    const result = await window.api.serial.listPorts()
    if (result.success) {
      ports.value = result.ports
      if (ports.value.length > 0 && !connection.value.port) {
        connection.value.port = ports.value[0].path
      }
    } else {
      console.error('获取串口列表失败:', result.error)
    }
  } catch (error) {
    console.error('获取串口列表失败:', error)
    // 可以在这里处理错误，例如显示一个提示
  }
})

const connect = () => {
  if (!connection.value.port) {
    alert('请选择一个串口')
    return
  }
  const connectionToEmit = { ...connection.value }
  if (!connectionToEmit.name) {
    connectionToEmit.name = connectionToEmit.port
  }
  emit('connect', connectionToEmit)
}
</script>

<style scoped>
.serial-connection-form {
  padding: 24px;
  background-color: #ffffff;
  color: #303133;
  border-radius: 8px;
  min-width: 350px;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #606266;
  font-size: 14px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #ffffff;
  color: #303133;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-group select:focus,
.form-group input:focus {
  outline: none;
  border-color: #409eff;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

button {
  padding: 9px 20px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #ffffff;
  color: #606266;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

button:hover {
  background-color: #ecf5ff;
  color: #409eff;
  border-color: #c6e2ff;
}

button.primary {
  background-color: #409eff;
  border-color: #409eff;
  color: #ffffff;
}

button.primary:hover {
  background-color: #79bbff;
  border-color: #79bbff;
}
</style> 