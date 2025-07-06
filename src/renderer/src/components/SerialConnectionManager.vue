<template>
  <div class="serial-connection-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button 
        type="primary" 
        :icon="Plus" 
        @click="showNewConnection = true"
      >
        新建串口连接
      </el-button>
      
      <div class="toolbar-actions">
        <el-button 
          :icon="Refresh"
          @click="refreshSerialPorts"
          title="刷新串口列表"
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
      <div v-if="terminalStore.serialConnections.length === 0" class="empty-state">
        <el-empty 
          description="暂无已保存的串口连接" 
          :image-size="80"
        >
          <el-button type="primary" @click="showNewConnection = true">
            创建第一个串口连接
          </el-button>
        </el-empty>
      </div>

      <div v-else class="connections-list">
        <div
          v-for="connection in terminalStore.serialConnections"
          :key="connection.id"
          class="connection-row"
        >
          <div class="connection-main">
            <div class="connection-left">
              <div class="connection-name">{{ connection.name }}</div>
              <div class="connection-details">
                <div class="connection-info">
                  <el-icon class="info-icon"><Monitor /></el-icon>
                  <span>{{ connection.port }}</span>
                </div>
                <div class="connection-info">
                  <el-icon class="info-icon"><Timer /></el-icon>
                  <span>{{ connection.baudRate }} bps</span>
                </div>
                <div class="connection-info">
                  <el-icon class="info-icon"><Setting /></el-icon>
                  <span>{{ connection.dataBits }}{{ connection.parity.charAt(0).toUpperCase() }}{{ connection.stopBits }}</span>
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
                  @click="connectToSerial(connection)"
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
                      <el-dropdown-item @click="connectToSerial(connection)">
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
      title="新建串口连接" 
      width="500px"
      :close-on-click-modal="false"
    >
      <SerialConnectionForm
        :session="{}"
        @saved="handleSave"
        @cancelled="showNewConnection = false"
      />
    </el-dialog>

    <!-- 编辑连接对话框 -->
    <el-dialog 
      v-model="showEditConnection" 
      title="编辑串口连接" 
      width="500px"
      :close-on-click-modal="false"
    >
      <SerialConnectionForm
        :session="editingConnection"
        :editing="true"
        @saved="handleSave"
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
  Monitor,
  Timer,
  Setting,
  Refresh
} from '@element-plus/icons-vue'
import { useTerminalStore } from '../stores/terminal'
import SerialConnectionForm from './SerialConnectionForm.vue'

const terminalStore = useTerminalStore()

// 对话框状态
const showNewConnection = ref(false)
const showEditConnection = ref(false)

// 编辑连接相关
const editingConnection = ref(null)

// 检查连接是否处于活跃状态
const isConnectionActive = (connection) => {
  return terminalStore.tabs.some(tab => 
    tab.connection && 
    tab.connection.type === 'serial' &&
    tab.connection.port === connection.port && 
    tab.isConnected
  )
}

// 连接到串口
const connectToSerial = (connection) => {
  terminalStore.createSerialTab(connection)
  ElMessage.success(`正在连接到串口 ${connection.port}...`)
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
    id: undefined
  }
  terminalStore.addSerialConnection(newConnection)
  ElMessage.success('连接已复制')
}

// 删除连接
const deleteConnection = async (connection) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除连接 "${connection.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    terminalStore.removeSerialConnection(connection.id)
    ElMessage.success('连接已删除')
  } catch {
    // 用户取消删除
  }
}

// 处理连接成功
const handleSave = () => {
  showNewConnection.value = false
  showEditConnection.value = false
}

// 刷新串口列表
const refreshSerialPorts = () => {
  ElMessage.info('正在刷新串口列表...')
  // 这里可以添加刷新串口的逻辑
}

// 导入连接配置
const importConnections = () => {
  ElMessage.info('导入功能开发中...')
}

// 导出连接配置
const exportConnections = () => {
  if (terminalStore.serialConnections.length === 0) {
    ElMessage.warning('没有可导出的串口连接')
    return
  }
  
  const dataStr = JSON.stringify(terminalStore.serialConnections, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = 'serial-connections.json'
  link.click()
  
  URL.revokeObjectURL(url)
  ElMessage.success('串口连接配置已导出')
}
</script>

<style scoped>
.serial-connection-manager {
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
  /* No specific grid or flex layout here, as it's now a list */
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
</style> 