<template>
  <div class="ssh-connection-form">
    <form @submit.prevent="connect">
      <div class="form-group">
        <label for="name">连接名称</label>
        <input type="text" id="name" v-model="connection.name" placeholder="例如：我的服务器" required>
      </div>
      <div class="form-group">
        <label for="host">主机</label>
        <input type="text" id="host" v-model="connection.host" placeholder="例如：192.168.1.100" required>
      </div>
      <div class="form-group">
        <label for="port">端口</label>
        <input type="number" id="port" v-model="connection.port" placeholder="默认 22" required>
      </div>
      <div class="form-group">
        <label for="username">用户名</label>
        <input type="text" id="username" v-model="connection.username" placeholder="例如：root">
      </div>
      <div class="form-group">
        <label for="password">密码</label>
        <input type="password" id="password" v-model="connection.password" placeholder="请输入密码">
      </div>
      <div class="form-actions">
        <button type="button" @click="$emit('close')">取消</button>
        <button type="submit" class="primary">连接</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      host: '',
      port: 22,
      username: '',
      password: '',
      authType: 'password' // 假设 'password' 是一个默认值
    })
  }
})

const emit = defineEmits(['connect', 'close'])

const connection = ref({})

watch(() => props.initialData, (newData) => {
  connection.value = { ...newData }
}, { deep: true, immediate: true })


const connect = () => {
  // 表单验证逻辑
  if (!connection.value.name || !connection.value.host || !connection.value.port || !connection.value.username) {
    // 可以添加错误提示
    return
  }
  
  // 确保有认证类型，默认为password
  const connectionData = { 
    ...connection.value,
    authType: connection.value.authType || 'password'
  }
  
  emit('connect', connectionData)
}
</script>

<style scoped>
.ssh-connection-form {
  padding: 24px;
  background-color: #ffffff; /* 浅色背景 */
  color: #303133; /* 深灰色文本，易于阅读 */
  border-radius: 8px;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #606266; /* 柔和的标签颜色 */
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dcdfe6; /* 浅灰色边框 */
  border-radius: 4px;
  background-color: #ffffff;
  color: #303133;
  box-sizing: border-box; 
  transition: border-color 0.2s;
}

.form-group input::placeholder {
  color: #a8abb2;
}

.form-group input:focus {
  outline: none;
  border-color: #409eff; /* 使用Element UI的主色调作为焦点颜色 */
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