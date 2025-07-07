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
        <input type="text" id="username" v-model="connection.username" placeholder="例如：root" required>
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
import { ref } from 'vue'

const emit = defineEmits(['connect', 'close'])

const connection = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
})

const connect = () => {
  // 在这里可以添加表单验证逻辑
  emit('connect', { ...connection.value })
}
</script>

<style scoped>
.ssh-connection-form {
  padding: 20px;
  background-color: #2d2d2d;
  color: #f0f0f0;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #ccc;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #444;
  border-radius: 4px;
  background-color: #333;
  color: #f0f0f0;
  box-sizing: border-box; /* 保证padding不会影响width */
}

.form-group input::placeholder {
  color: #888;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

button {
  padding: 10px 20px;
  border: 1px solid #555;
  border-radius: 4px;
  background-color: #444;
  color: #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #555;
}

button.primary {
  background-color: #007bff;
  border-color: #007bff;
}

button.primary:hover {
  background-color: #0056b3;
}
</style> 