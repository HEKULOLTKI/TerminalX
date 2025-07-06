<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
    <el-form-item label="连接名称" prop="name">
      <el-input v-model="form.name" placeholder="例如：我的 Arduino" />
    </el-form-item>

    <el-form-item label="串口" prop="port">
      <el-select v-model="form.port" placeholder="请选择串口" filterable allow-create>
        <el-option
          v-for="port in availablePorts"
          :key="port.path"
          :label="port.path"
          :value="port.path"
        />
      </el-select>
      <el-button :icon="Refresh" @click="refreshPorts" :loading="isRefreshingPorts" class="refresh-button" />
    </el-form-item>

    <el-form-item label="波特率" prop="baudRate">
      <el-select v-model="form.baudRate" placeholder="请选择波特率" filterable allow-create>
        <el-option v-for="rate in baudRates" :key="rate" :label="rate" :value="rate" />
      </el-select>
    </el-form-item>

    <el-form-item label="数据位" prop="dataBits">
      <el-select v-model="form.dataBits">
        <el-option v-for="bits in [8, 7, 6, 5]" :key="bits" :label="bits" :value="bits" />
      </el-select>
    </el-form-item>

    <el-form-item label="停止位" prop="stopBits">
      <el-select v-model="form.stopBits">
        <el-option label="1" :value="1" />
        <el-option label="2" :value="2" />
      </el-select>
    </el-form-item>

    <el-form-item label="校验位" prop="parity">
      <el-select v-model="form.parity">
        <el-option label="none" value="none" />
        <el-option label="even" value="even" />
        <el-option label="odd" value="odd" />
        <el-option label="mark" value="mark" />
        <el-option label="space" value="space" />
      </el-select>
    </el-form-item>
    
    <el-form-item>
      <el-button type="primary" @click="submitForm">保存</el-button>
      <el-button @click="$emit('cancelled')">取消</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { serialService } from '@/services/serial'
import { useTerminalStore } from '../stores/terminal'

const props = defineProps({
  session: {
    type: Object,
    default: () => ({})
  },
  editing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['saved', 'cancelled'])

const terminalStore = useTerminalStore()
const formRef = ref(null)

const form = ref({
  id: null,
  name: '',
  port: '',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
})

const rules = {
  name: [{ required: true, message: '请输入连接名称', trigger: 'blur' }],
  port: [{ required: true, message: '请选择或输入串口', trigger: 'blur' }],
  baudRate: [{ required: true, message: '请选择或输入波特率', trigger: 'blur' }],
}

const availablePorts = ref([])
const isRefreshingPorts = ref(false)
const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

const refreshPorts = async () => {
  isRefreshingPorts.value = true
  try {
    availablePorts.value = await serialService.listPorts()
  } catch (error) {
    ElMessage.error(`刷新串口列表失败: ${error.message}`)
  } finally {
    isRefreshingPorts.value = false
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (valid) {
      if (props.editing) {
        terminalStore.updateSerialConnection(form.value)
      } else {
        terminalStore.addSerialConnection(form.value)
      }
      emit('saved')
    } else {
      ElMessage.error('请检查表单输入')
    }
  })
}

watch(() => props.session, (newSession) => {
  if (newSession) {
    form.value = { ...form.value, ...newSession }
  }
}, { immediate: true })

onMounted(() => {
  refreshPorts()
})

</script>

<style scoped>
.refresh-button {
  margin-left: 10px;
}
</style> 