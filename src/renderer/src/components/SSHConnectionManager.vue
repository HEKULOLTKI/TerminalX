<template>
  <div class="ssh-connection-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button 
        type="primary" 
        :icon="Plus" 
        @click="showNewConnection = true"
      >
        新建SSH连接
      </el-button>
      
      <div class="toolbar-actions">
        <el-dropdown trigger="click">
          <el-button :icon="MoreFilled">
            更多操作
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="importConnections">
                <el-icon><Upload /></el-icon>
                导入连接
              </el-dropdown-item>
              <el-dropdown-item @click="exportConnections">
                <el-icon><Download /></el-icon>
                导出连接
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 连接列表 -->
    <div class="connection-list">
      <div v-if="terminalStore.connections.length === 0" class="empty-state">
        <el-empty 
          description="暂无已保存的SSH连接" 
          :image-size="80"
        >
          <el-button type="primary" @click="showNewConnection = true">
            创建第一个SSH连接
          </el-button>
        </el-empty>
      </div>

      <div v-else class="connections-grid">
        <div
          v-for="connection in terminalStore.connections"
          :key="connection.id"
          class="connection-card"
          @click="connectToHost(connection)"
        >
          <div class="connection-header">
            <div class="connection-name">{{ connection.name }}</div>
            <el-dropdown trigger="click" @click.stop>
              <el-button size="small" :icon="MoreFilled" text />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="editConnection(connection)">
                    <el-icon><Edit /></el-icon>
                    编辑
                  </el-dropdown-item>
                  <el-dropdown-item @click="duplicateConnection(connection)">
                    <el-icon><CopyDocument /></el-icon>
                    复制
                  </el-dropdown-item>
                  <el-dropdown-item @click="connectToHost(connection)">
                    <el-icon><Connection /></el-icon>
                    连接
                  </el-dropdown-item>
                  <el-dropdown-item 
                    @click="deleteConnection(connection)"
                    divided
                  >
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          
          <div class="connection-details">
            <div class="connection-info">
              <el-icon class="info-icon"><User /></el-icon>
              <span>{{ connection.username }}@{{ connection.host }}</span>
            </div>
            <div class="connection-info">
              <el-icon class="info-icon"><Link /></el-icon>
              <span>端口: {{ connection.port }}</span>
            </div>
            <div class="connection-info">
              <el-icon class="info-icon"><Key /></el-icon>
              <span>{{ connection.authType === 'password' ? '密码认证' : '私钥认证' }}</span>
            </div>
          </div>

          <div class="connection-status">
            <el-tag 
              :type="isConnectionActive(connection) ? 'success' : 'info'" 
              size="small"
            >
              {{ isConnectionActive(connection) ? '已连接' : '未连接' }}
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建连接对话框 -->
    <el-dialog 
      v-model="showNewConnection" 
      title="新建SSH连接" 
      width="500px"
      :close-on-click-modal="false"
    >
      <SSHConnection 
        ref="newConnectionRef"
        @connected="handleConnectionSuccess"
        @saved="handleConnectionSaved"
        @cancelled="showNewConnection = false"
      />
    </el-dialog>

    <!-- 编辑连接对话框 -->
    <el-dialog 
      v-model="showEditConnection" 
      title="编辑SSH连接" 
      width="500px"
      :close-on-click-modal="false"
    >
      <SSHConnection 
        ref="editConnectionRef"
        :connection="editingConnection"
        :editing="true"
        @connected="handleConnectionSuccess"
        @saved="handleConnectionSaved"
        @cancelled="showEditConnection = false"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  MoreFilled,
  Upload,
  Download,
  Edit,
  CopyDocument,
  Delete,
  Connection,
  User,
  Link,
  Key
} from '@element-plus/icons-vue'
import { useTerminalStore } from '../stores/terminal'
import SSHConnection from './SSHConnection.vue'

const terminalStore = useTerminalStore()

// 对话框状态
const showNewConnection = ref(false)
const showEditConnection = ref(false)

// 编辑连接相关
const editingConnection = ref(null)
const newConnectionRef = ref(null)
const editConnectionRef = ref(null)

// 检查连接是否处于活跃状态
const isConnectionActive = (connection) => {
  return terminalStore.tabs.some(tab => 
    tab.connection && 
    tab.connection.host === connection.host && 
    tab.connection.port === connection.port && 
    tab.connection.username === connection.username &&
    tab.isConnected
  )
}

// 连接到主机
const connectToHost = (connection) => {
  terminalStore.createTab(connection)
  ElMessage.success(`正在连接到 ${connection.host}...`)
}

// 编辑连接
const editConnection = (connection) => {
  editingConnection.value = { ...connection }
  showEditConnection.value = true
}

// 复制连接
const duplicateConnection = (connection) => {
  const newConnection = {
    ...connection,
    name: `${connection.name} - 副本`,
    id: undefined // 让store生成新ID
  }
  delete newConnection.id
  terminalStore.addConnection(newConnection)
  ElMessage.success('连接已复制')
}

// 删除连接
const deleteConnection = async (connection) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除连接 "${connection.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    terminalStore.removeConnection(connection.id)
    ElMessage.success('连接已删除')
  } catch {
    // 用户取消
  }
}

// 处理连接成功
const handleConnectionSuccess = (data) => {
  showNewConnection.value = false
  showEditConnection.value = false
  newConnectionRef.value?.resetForm()
  editConnectionRef.value?.resetForm()
}

// 处理连接保存
const handleConnectionSaved = (connection) => {
  showNewConnection.value = false
  showEditConnection.value = false
  newConnectionRef.value?.resetForm()
  editConnectionRef.value?.resetForm()
}

// 导入连接
const importConnections = () => {
  // TODO: 实现导入连接功能
  ElMessage.info('导入功能开发中...')
}

// 导出连接
const exportConnections = () => {
  if (terminalStore.connections.length === 0) {
    ElMessage.warning('暂无连接可导出')
    return
  }
  
  // TODO: 实现导出连接功能
  ElMessage.info('导出功能开发中...')
}
</script>

<style scoped>
.ssh-connection-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 16px 0;
  border-bottom: 1px solid var(--el-border-color);
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.connection-list {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.connections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 16px 0;
}

.connection-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.connection-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px var(--el-color-primary-light-8);
}

.connection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.connection-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.connection-details {
  margin-bottom: 12px;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.info-icon {
  font-size: 14px;
  color: var(--el-color-primary);
  width: 16px;
}

.connection-status {
  display: flex;
  justify-content: flex-end;
}

/* 滚动条样式 */
.connection-list::-webkit-scrollbar {
  width: 6px;
}

.connection-list::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
  border-radius: 3px;
}

.connection-list::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;
}

.connection-list::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-darker);
}
</style> 