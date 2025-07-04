<template>
  <div class="serial-connection">
    <el-form :model="connectionForm" ref="formRef" :rules="rules" label-width="80px">
      <el-form-item label="名称" prop="name">
        <el-input v-model="connectionForm.name" placeholder="连接名称" />
      </el-form-item>
      
      <el-form-item label="串口" prop="port">
        <el-select 
          v-model="connectionForm.port" 
          placeholder="选择串口"
          style="width: 100%"
          @focus="refreshPorts"
        >
          <el-option
            v-for="port in availablePorts"
            :key="port.path"
            :label="`${port.path} - ${port.manufacturer || '未知设备'}`"
            :value="port.path"
          />
        </el-select>
      </el-form-item>
      
      <el-form-item label="波特率" prop="baudRate">
        <el-select v-model="connectionForm.baudRate" placeholder="选择波特率">
          <el-option label="9600" :value="9600" />
          <el-option label="19200" :value="19200" />
          <el-option label="38400" :value="38400" />
          <el-option label="57600" :value="57600" />
          <el-option label="115200" :value="115200" />
          <el-option label="230400" :value="230400" />
          <el-option label="460800" :value="460800" />
          <el-option label="921600" :value="921600" />
        </el-select>
      </el-form-item>
      
      <el-form-item label="数据位" prop="dataBits">
        <el-select v-model="connectionForm.dataBits">
          <el-option label="5" :value="5" />
          <el-option label="6" :value="6" />
          <el-option label="7" :value="7" />
          <el-option label="8" :value="8" />
        </el-select>
      </el-form-item>
      
      <el-form-item label="停止位" prop="stopBits">
        <el-select v-model="connectionForm.stopBits">
          <el-option label="1" :value="1" />
          <el-option label="1.5" :value="1.5" />
          <el-option label="2" :value="2" />
        </el-select>
      </el-form-item>
      
      <el-form-item label="校验位" prop="parity">
        <el-select v-model="connectionForm.parity">
          <el-option label="无" value="none" />
          <el-option label="奇校验" value="odd" />
          <el-option label="偶校验" value="even" />
          <el-option label="标记" value="mark" />
          <el-option label="空格" value="space" />
        </el-select>
      </el-form-item>
      
      <el-form-item label="流控制" prop="flowControl">
        <el-select v-model="connectionForm.flowControl">
          <el-option label="无" value="none" />
          <el-option label="硬件(RTS/CTS)" value="hardware" />
          <el-option label="软件(XON/XOFF)" value="software" />
        </el-select>
      </el-form-item>
      
      <el-form-item>
        <el-button type="primary" @click="handleConnect" :loading="connecting">
          {{ editing ? '更新并连接' : '连接' }}
        </el-button>
        <el-button @click="handleCancel">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTerminalStore } from '../stores/terminal'

const props = defineProps({
  connection: {
    type: Object,
    default: null
  },
  editing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['connected', 'cancelled'])

const terminalStore = useTerminalStore()
const formRef = ref(null)
const connecting = ref(false)
const availablePorts = ref([])

// 连接表单数据
const connectionForm = reactive({
  name: '',
  port: '',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none'
})

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入连接名称', trigger: 'blur' }
  ],
  port: [
    { required: true, message: '请选择串口', trigger: 'change' }
  ],
  baudRate: [
    { required: true, message: '请选择波特率', trigger: 'change' }
  ]
}

// 刷新可用串口列表
const refreshPorts = async () => {
  try {
    // 这里应该调用主进程的API获取串口列表
    // 暂时模拟一些常见的串口
    availablePorts.value = [
      { path: 'COM1', manufacturer: '内置串口' },
      { path: 'COM3', manufacturer: 'USB转串口' },
      { path: '/dev/ttyUSB0', manufacturer: 'USB转串口' },
      { path: '/dev/ttyACM0', manufacturer: 'Arduino' }
    ]
  } catch (error) {
    ElMessage.error('获取串口列表失败')
  }
}

// 监听编辑模式下的连接数据变化
watch(() => props.connection, (newConnection) => {
  if (newConnection && props.editing) {
    Object.assign(connectionForm, newConnection)
  }
}, { immediate: true })

// 处理连接
const handleConnect = async () => {
  try {
    const valid = await formRef.value.validate()
    if (!valid) return

    connecting.value = true
    
    // 自动保存配置（如果不是编辑模式）
    let savedConnection = connectionForm
    if (!props.editing) {
      savedConnection = terminalStore.addSerialConnection(connectionForm)
      ElMessage.success('配置已保存并开始连接...')
    } else {
      // 编辑模式下更新现有连接
      if (props.connection && props.connection.id) {
        const index = terminalStore.serialConnections.findIndex(conn => conn.id === props.connection.id)
        if (index !== -1) {
          Object.assign(terminalStore.serialConnections[index], connectionForm)
        }
      }
      ElMessage.success('配置已更新并开始连接...')
    }
    
    // 创建新标签页
    const tab = terminalStore.createSerialTab(savedConnection)
    
    emit('connected', { tab, connection: savedConnection })
    
  } catch (error) {
    ElMessage.error(`连接失败: ${error.message}`)
  } finally {
    connecting.value = false
  }
}

// 取消操作
const handleCancel = () => {
  emit('cancelled')
}

// 重置表单
const resetForm = () => {
  Object.assign(connectionForm, {
    name: '',
    port: '',
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  })
}

onMounted(() => {
  refreshPorts()
})

defineExpose({
  resetForm
})
</script>

<style scoped>
.serial-connection {
  padding: 20px;
}

.el-form-item {
  margin-bottom: 20px;
}

.el-select {
  width: 100%;
}
</style> 