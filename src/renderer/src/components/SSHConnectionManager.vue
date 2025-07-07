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
        <el-button 
          :icon="Refresh"
          @click="refreshConnections"
          title="刷新连接状态"
        />
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

      <div v-else class="connections-list">
        <div
          v-for="connection in terminalStore.connections"
          :key="connection.id"
          class="connection-row"
        >
          <div class="connection-main">
            <div class="connection-left">
              <div class="connection-name">{{ connection.name }}</div>
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
            </div>
            
            <div class="connection-right">
              <el-tag 
                :type="isConnectionActive(connection) ? 'success' : 'info'" 
                size="small"
                class="status-tag"
              >
                {{ isConnectionActive(connection) ? '已连接' : '未连接' }}
              </el-tag>
              
              <div class="connection-actions">
                <el-button 
                  type="primary" 
                  size="small" 
                  :icon="Connection"
                  @click="connectToHost(connection)"
                  :disabled="isConnectionActive(connection)"
                >
                  {{ isConnectionActive(connection) ? '已连接' : '连接' }}
                </el-button>
                
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
            </div>
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
      <SSHConnectionForm
        @connect="handleSaveConnection"
        @close="showNewConnection = false"
      />
    </el-dialog>

    <!-- 编辑连接对话框 -->
    <el-dialog 
      v-model="showEditConnection" 
      title="编辑SSH连接" 
      width="500px"
      :close-on-click-modal="false"
    >
      <SSHConnectionForm 
        v-if="editingConnection"
        :initial-data="editingConnection"
        @connect="handleSaveConnection"
        @close="showEditConnection = false"
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
  Key,
  Refresh
} from '@element-plus/icons-vue'
import { useTerminalStore } from '../stores/terminal'
import SSHConnectionForm from './SSHConnectionForm.vue'

const terminalStore = useTerminalStore()

// 对话框状态
const showNewConnection = ref(false)
const showEditConnection = ref(false)

// 编辑连接相关
const editingConnection = ref(null)
const newConnectionRef = ref(null)
const editConnectionRef = ref(null)

const handleSaveConnection = async (connectionData) => {
  // 确保连接数据是可序列化的
  const safeProps = [
    'host', 'port', 'username', 'password', 'privateKey', 'passphrase',
    'authType', 'name', 'keepaliveInterval', 'readyTimeout', 'timeout'
  ];
  
  const safeConnection = {};
  for (const prop of safeProps) {
    if (connectionData[prop] !== undefined) {
      safeConnection[prop] = connectionData[prop];
    }
  }

  let savedConnection;
  if (editingConnection.value) {
    savedConnection = { ...editingConnection.value, ...safeConnection };
    terminalStore.updateSshConnection(savedConnection)
    ElMessage.success('连接已更新')
  } else {
    savedConnection = terminalStore.addSshConnection(safeConnection)
    ElMessage.success('连接已保存')
  }
  
  // 连接到主机
  try {
    await terminalStore.addTab({
      type: 'ssh',
      label: savedConnection.name,
      connection: savedConnection,
      active: true
    });
    
    showNewConnection.value = false
    showEditConnection.value = false
    editingConnection.value = null
  } catch (error) {
    console.error('连接失败:', error)
    ElMessage.error(`连接失败: ${error.message}`)
  }
}

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
const connectToHost = async (connection) => {
  try {
    await terminalStore.addTab({
      type: 'ssh',
      label: connection.name,
      connection: connection,
      active: true
    })
  } catch (error) {
    console.error('连接失败:', error)
    ElMessage.error(`连接失败: ${error.message}`)
  }
}

const editConnection = (connection) => {
  editingConnection.value = connection;
  showEditConnection.value = true;
};

const duplicateConnection = (c) => {
  const newConn = { ...c, id: Date.now().toString(), name: `${c.name} (copy)` };
  terminalStore.addSshConnection(newConn);
  ElMessage.success('Connection duplicated.');
};

// 删除连接
const deleteConnection = (connection) => {
  ElMessageBox.confirm(`Are you sure you want to delete "${connection.name}"?`, 'Warning', {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    type: 'warning'
  })
    .then(() => {
      terminalStore.removeSshConnection(connection.id)
      ElMessage({
        type: 'success',
        message: 'Delete completed'
      })
    })
    .catch(() => {
      /* no-op */
    })
}

const handleConnectionSuccess = () => {
  showNewConnection.value = false
  showEditConnection.value = false
  ElMessage.success('连接已保存')
}

const refreshConnections = () => {
  // Mock refresh
  ElMessage.info('刷新状态...')
}

const importConnections = () => {
  ElMessage.info('导入功能待开发...')
}

const exportConnections = () => {
  ElMessage.info('导出功能待开发...')
}
</script>

<style scoped>
.ssh-connection-manager {
  padding: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.connection-list {
  margin-top: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.connections-list {
  /* No specific grid layout here, as it's now a list */
}

.connection-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  transition: all 0.2s;
}

.connection-row:last-child {
  border-bottom: none;
}

.connection-row:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.connection-main {
  display: flex;
  align-items: center;
  flex: 1;
}

.connection-left {
  flex: 1;
  margin-right: 16px;
}

.connection-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.connection-details {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-icon {
  margin-right: 8px;
  color: var(--el-color-primary);
  width: 16px;
}

.connection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-tag {
  flex-shrink: 0;
}

/* 深色主题适配 */
.dark .connection-row {
  background: #2d2d30;
  border-color: #3c3c3c;
}

.dark .connection-row:hover {
  background: #363639;
  border-color: var(--el-color-primary);
}

/* 清心主题适配 */
.fresh .connection-row {
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid #e3f2fd;
}

.fresh .connection-row:hover {
  border-color: #4285f4;
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%);
  box-shadow: 0 4px 20px rgba(66, 133, 244, 0.15);
}

.fresh .connection-name {
  color: #1565c0;
}

.fresh .info-icon {
  color: #4285f4;
}

.fresh .connection-actions .el-button--primary {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  border-color: #4285f4;
  box-shadow: 0 2px 6px rgba(66, 133, 244, 0.3);
}

.fresh .connection-actions .el-button--primary:hover {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-color: #1976d2;
  box-shadow: 0 4px 8px rgba(66, 133, 244, 0.4);
}

.fresh .connection-actions .el-button--primary:disabled {
  background: #e3f2fd;
  border-color: #d6e9ff;
  color: #90a4ae;
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