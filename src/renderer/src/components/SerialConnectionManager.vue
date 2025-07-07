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
                  <span>{{ connection.path }}</span>
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
        @connect="handleConnectionSave"
        @close="showNewConnection = false"
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
        v-if="showEditConnection"
        :initial-data="editingConnection"
        :editing="true"
        @connect="handleConnectionSave"
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

// 处理连接成功
const handleConnectionSave = (connectionData) => {
  // 确保连接对象有 path 属性用于显示（与 port 属性保持一致）
  const processedData = {
    ...connectionData,
    path: connectionData.port // 将 port 复制到 path 用于显示
  };
  
  let savedConnection;
  if (editingConnection.value) {
    // 更新现有连接
    savedConnection = { ...processedData, id: editingConnection.value.id };
    terminalStore.updateSerialConnection(savedConnection)
    ElMessage.success('连接已更新')
  } else {
    // 添加新连接
    savedConnection = terminalStore.addSerialConnection(processedData)
    ElMessage.success('连接已保存')
  }

  // 立即连接
  terminalStore.addTab({
    type: 'serial',
    connection: savedConnection
  });

  showNewConnection.value = false
  showEditConnection.value = false
  editingConnection.value = null
}

// 检查连接是否处于活跃状态
const isConnectionActive = (connection) => {
  return terminalStore.tabs.some(tab => 
    tab.connection && 
    tab.connection.type === 'serial' &&
    tab.connection.path === connection.path && 
    tab.isConnected
  )
}

// 连接到串口
const connectToSerial = (connection) => {
  terminalStore.addTab({
    type: 'serial',
    connection: connection
  })
  ElMessage.success(`正在连接到串口 ${connection.path}...`)
}

// 编辑连接
const editConnection = (connection) => {
  editingConnection.value = { 
    ...connection,
    port: connection.path || connection.port // 确保有 port 属性用于表单
  }
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
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: #ffffff;
  border-bottom: 1px solid #e4e7ed;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.connection-list {
  flex-grow: 1;
  overflow-y: auto;
  padding: 8px;
}

.connections-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
  padding: 12px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100% - 60px); 
}

.connection-row {
  background-color: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  transition: box-shadow 0.3s;
  overflow: hidden;
}

.connection-row:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.connection-main {
  padding: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.connection-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.connection-details {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
}

.info-icon {
  font-size: 14px;
  color: #909399;
}

.connection-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.status-tag {
  min-width: 50px;
  text-align: center;
}

.connection-actions {
  display: flex;
  gap: 8px;
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