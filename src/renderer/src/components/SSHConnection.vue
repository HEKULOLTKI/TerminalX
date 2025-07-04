<template>
  <div class="ssh-connection">
    <el-form :model="connectionForm" ref="formRef" :rules="rules" label-width="80px">
      <el-form-item label="名称" prop="name">
        <el-input v-model="connectionForm.name" placeholder="连接名称" />
      </el-form-item>
      
      <el-form-item label="主机" prop="host">
        <el-input v-model="connectionForm.host" placeholder="IP地址或域名" />
      </el-form-item>
      
      <el-form-item label="端口" prop="port">
        <el-input-number v-model="connectionForm.port" :min="1" :max="65535" />
      </el-form-item>
      
      <el-form-item label="用户名" prop="username">
        <el-input v-model="connectionForm.username" placeholder="SSH用户名" />
      </el-form-item>
      
      <el-form-item label="认证方式" prop="authType">
        <el-radio-group v-model="connectionForm.authType">
          <el-radio label="password">密码</el-radio>
          <el-radio label="privateKey">私钥</el-radio>
        </el-radio-group>
      </el-form-item>
      
      <el-form-item v-if="connectionForm.authType === 'password'" label="密码" prop="password">
        <el-input 
          v-model="connectionForm.password" 
          type="password" 
          placeholder="SSH密码"
          show-password 
        />
      </el-form-item>
      
      <el-form-item v-if="connectionForm.authType === 'privateKey'" label="私钥" prop="privateKey">
        <el-input 
          v-model="connectionForm.privateKey" 
          type="textarea" 
          :rows="4"
          placeholder="私钥内容或私钥文件路径" 
        />
      </el-form-item>
      
      <el-form-item v-if="connectionForm.authType === 'privateKey'" label="密码短语">
        <el-input 
          v-model="connectionForm.passphrase" 
          type="password" 
          placeholder="私钥密码短语（可选）"
          show-password 
        />
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
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTerminalStore } from '../stores/terminal'
import { sshService } from '../services/ssh'

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

// 连接表单数据
const connectionForm = reactive({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKey: '',
  passphrase: ''
})

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入连接名称', trigger: 'blur' }
  ],
  host: [
    { required: true, message: '请输入主机地址', trigger: 'blur' }
  ],
  port: [
    { required: true, message: '请输入端口号', trigger: 'blur' },
    { type: 'number', min: 1, max: 65535, message: '端口号必须在1-65535之间', trigger: 'blur' }
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { 
      validator: (rule, value, callback) => {
        if (connectionForm.authType === 'password' && !value) {
          callback(new Error('请输入密码'))
        } else {
          callback()
        }
      }, 
      trigger: 'blur' 
    }
  ],
  privateKey: [
    { 
      validator: (rule, value, callback) => {
        if (connectionForm.authType === 'privateKey' && !value) {
          callback(new Error('请输入私钥'))
        } else {
          callback()
        }
      }, 
      trigger: 'blur' 
    }
  ]
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
    
    // 测试SSH连接
    await sshService.testConnection(connectionForm)
    
    // 自动保存配置（如果不是编辑模式）
    let savedConnection = connectionForm
    if (!props.editing) {
      savedConnection = terminalStore.addConnection(connectionForm)
      ElMessage.success('配置已保存并开始连接...')
    } else {
      // 编辑模式下更新现有连接
      if (props.connection && props.connection.id) {
        const index = terminalStore.connections.findIndex(conn => conn.id === props.connection.id)
        if (index !== -1) {
          Object.assign(terminalStore.connections[index], connectionForm)
        }
      }
      ElMessage.success('配置已更新并开始连接...')
    }
    
    // 创建新标签页
    const tab = terminalStore.createTab(savedConnection)
    
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
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: ''
  })
  formRef.value?.resetFields()
}

defineExpose({
  resetForm
})
</script>

<style scoped>
.ssh-connection {
  padding: 20px;
}

.el-form {
  max-width: 400px;
}

.el-textarea :deep(.el-textarea__inner) {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
}
</style> 