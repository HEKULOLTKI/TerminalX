<template>
  <div class="tab-manager">
    <!-- 标签页导航栏 -->
    <div class="tab-nav">
      <div class="tab-list">
        <div
          v-for="tab in terminalStore.tabs"
          :key="tab.id"
          :class="['tab-item', { active: tab.id === terminalStore.activeTabId }]"
          @click="switchTab(tab.id)"
        >
          <div class="device-card">
            <!-- 设备图片区域 -->
            <div class="device-image">
              <el-image 
                v-if="tab.connection && tab.connection.deviceImage"
                :src="tab.connection.deviceImage" 
                fit="cover"
                class="device-img"
              >
                <template #error>
                  <div class="image-slot">
                    <el-icon class="device-icon">
                      <Monitor v-if="!tab.connection" />
                      <Connection v-else />
                    </el-icon>
                  </div>
                </template>
              </el-image>
              <div v-else class="image-slot">
                <el-icon class="device-icon">
                  <Monitor v-if="!tab.connection" />
                  <Connection v-else />
                </el-icon>
              </div>
            </div>

            <!-- 设备信息区域 -->
            <div class="device-info">
              <div class="device-header">
                <span class="device-name">{{ tab.title }}</span>
                <div class="connection-status-badge">
                  <span 
                    :class="['status-dot', { 
                      connected: tab.isConnected, 
                      disconnected: tab.connection && !tab.isConnected,
                      local: !tab.connection
                    }]"
                  ></span>
                  <span class="status-text">
                    {{ getStatusText(tab) }}
                  </span>
                </div>
              </div>

              <div class="device-details" v-if="tab.connection">
                <div class="detail-row">
                  <span class="detail-label">IP:</span>
                  <span class="detail-value">{{ tab.connection.host || '--' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">端口:</span>
                  <span class="detail-value">
                    {{ tab.connection.type === 'serial' ? tab.connection.port : tab.connection.port || 22 }}
                  </span>
                </div>
                <div class="detail-row" v-if="tab.connection.type === 'serial'">
                  <span class="detail-label">波特率:</span>
                  <span class="detail-value">{{ tab.connection.baudRate || '--' }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">设备厂商:</span>
                  <span class="detail-value">{{ tab.connection.manufacturer || '--' }}</span>
                </div>
              </div>
              
              <div class="device-details" v-else>
                <div class="detail-row">
                  <span class="detail-label">IP:</span>
                  <span class="detail-value">本地主机</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">端口:</span>
                  <span class="detail-value">--</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">波特率:</span>
                  <span class="detail-value">--</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">设备厂商:</span>
                  <span class="detail-value">--</span>
                </div>
              </div>
            </div>
          </div>
          
          <el-icon 
            class="close-btn" 
            @click.stop="closeTab(tab.id)"
            v-show="terminalStore.tabs.length > 1"
          >
            <Close />
          </el-icon>
        </div>
      </div>
    </div>

    <!-- 标签页内容区域 -->
    <div class="tab-content-area">
      <div
        v-for="tab in terminalStore.tabs"
        :key="tab.id"
        v-show="tab.id === terminalStore.activeTabId"
        class="tab-pane"
      >
        <Terminal :tab-id="tab.id" />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="terminalStore.tabs.length === 0" class="empty-state">
      <el-empty description="暂无终端标签页">
      </el-empty>
    </div>

    <!-- SSH连接对话框 -->
    <el-dialog 
      v-model="showNewSSHConnection" 
      title="新建SSH连接" 
      width="500px"
      :close-on-click-modal="false"
    >
      <SSHConnection 
        ref="sshConnectionRef"
        @connected="handleSSHConnectionSuccess"
        @cancelled="showNewSSHConnection = false"
      />
    </el-dialog>

    <!-- 快速连接对话框 -->
    <el-dialog 
      v-model="showQuickConnect" 
      title="快速SSH连接" 
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="quick-connect-form">
        <el-form :model="quickConnectForm" label-width="80px">
          <el-form-item label="主机">
            <el-input 
              v-model="quickConnectForm.host" 
              placeholder="IP地址或域名"
              @keyup.enter="handleQuickConnect"
            />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input 
              v-model="quickConnectForm.username" 
              placeholder="SSH用户名"
              @keyup.enter="handleQuickConnect"
            />
          </el-form-item>
        </el-form>
        <div class="quick-connect-actions">
          <el-button @click="showQuickConnect = false">取消</el-button>
          <el-button type="primary" @click="handleQuickConnect">连接</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { nextTick, ref, reactive } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { 
  Monitor, 
  Connection, 
  Close
} from '@element-plus/icons-vue'
import { useTerminalStore } from '../stores/terminal'
import Terminal from './Terminal.vue'
import SSHConnection from './SSHConnection.vue'

const terminalStore = useTerminalStore()

// 对话框状态
const showNewSSHConnection = ref(false)
const showQuickConnect = ref(false)
const sshConnectionRef = ref(null)

// 快速连接表单
const quickConnectForm = reactive({
  host: '',
  username: ''
})

// 切换标签页
const switchTab = (tabId) => {
  terminalStore.switchTab(tabId)
}

// 关闭标签页
const closeTab = async (tabId) => {
  const tab = terminalStore.tabs.find(t => t.id === tabId)
  
  // 如果是SSH连接且正在连接中，询问用户确认
  if (tab && tab.connection && tab.isConnected) {
    try {
      await ElMessageBox.confirm(
        `是否要关闭连接到 ${tab.connection.host} 的SSH会话？`,
        '确认关闭',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return // 用户取消
    }
  }
  
  terminalStore.closeTab(tabId)
  ElMessage.success('标签页已关闭')
}

// 关闭其他标签页
const closeOtherTabs = async () => {
  const activeTab = terminalStore.getActiveTab()
  if (!activeTab) return

  const hasConnectedTabs = terminalStore.tabs.some(tab => 
    tab.id !== activeTab.id && tab.connection && tab.isConnected
  )

  if (hasConnectedTabs) {
    try {
      await ElMessageBox.confirm(
        '这将关闭所有其他SSH连接，是否继续？',
        '确认关闭',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return
    }
  }

  const tabsToClose = terminalStore.tabs.filter(tab => tab.id !== activeTab.id)
  tabsToClose.forEach(tab => {
    terminalStore.closeTab(tab.id)
  })
  
  ElMessage.success('其他标签页已关闭')
}

// 关闭所有标签页
const closeAllTabs = async () => {
  const hasConnectedTabs = terminalStore.tabs.some(tab => 
    tab.connection && tab.isConnected
  )

  if (hasConnectedTabs) {
    try {
      await ElMessageBox.confirm(
        '这将关闭所有SSH连接，是否继续？',
        '确认关闭',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return
    }
  }

  const allTabs = [...terminalStore.tabs]
  allTabs.forEach(tab => {
    terminalStore.closeTab(tab.id)
  })
  
  ElMessage.success('所有标签页已关闭')
}

// 复制当前标签页
const duplicateCurrentTab = () => {
  const activeTab = terminalStore.getActiveTab()
  if (!activeTab) return

  if (activeTab.connection) {
    // 如果是SSH连接，创建相同配置的新连接
    terminalStore.createTab(activeTab.connection)
    ElMessage.success('已复制SSH连接标签页')
  } else {
    // 如果是本地终端，创建新的本地终端
    terminalStore.createTab(null)
    ElMessage.success('已复制本地终端标签页')
  }
}

// 创建新标签页
const createNewTab = () => {
  terminalStore.createTab(null)
}

// 键盘快捷键处理
const handleKeydown = (event) => {
  // Ctrl+T 新建标签页
  if (event.ctrlKey && event.key === 't') {
    event.preventDefault()
    createNewTab()
  }
  
  // Ctrl+W 关闭当前标签页
  if (event.ctrlKey && event.key === 'w') {
    event.preventDefault()
    const activeTab = terminalStore.getActiveTab()
    if (activeTab) {
      closeTab(activeTab.id)
    }
  }
  
  // Ctrl+Tab 切换到下一个标签页
  if (event.ctrlKey && event.key === 'Tab') {
    event.preventDefault()
    const currentIndex = terminalStore.tabs.findIndex(tab => 
      tab.id === terminalStore.activeTabId
    )
    const nextIndex = (currentIndex + 1) % terminalStore.tabs.length
    if (terminalStore.tabs[nextIndex]) {
      switchTab(terminalStore.tabs[nextIndex].id)
    }
  }
  
  // Ctrl+Shift+Tab 切换到上一个标签页
  if (event.ctrlKey && event.shiftKey && event.key === 'Tab') {
    event.preventDefault()
    const currentIndex = terminalStore.tabs.findIndex(tab => 
      tab.id === terminalStore.activeTabId
    )
    const prevIndex = currentIndex === 0 ? 
      terminalStore.tabs.length - 1 : currentIndex - 1
    if (terminalStore.tabs[prevIndex]) {
      switchTab(terminalStore.tabs[prevIndex].id)
    }
  }
  
  // Ctrl+数字键 切换到指定标签页
  if (event.ctrlKey && /^[1-9]$/.test(event.key)) {
    event.preventDefault()
    const index = parseInt(event.key) - 1
    if (terminalStore.tabs[index]) {
      switchTab(terminalStore.tabs[index].id)
    }
  }
}

// 监听键盘事件
document.addEventListener('keydown', handleKeydown)

// 初始化时创建一个默认标签页
if (terminalStore.tabs.length === 0) {
  nextTick(() => {
    createNewTab()
  })
}

// SSH连接处理
const handleSSHConnectionSuccess = (data) => {
  showNewSSHConnection.value = false
  sshConnectionRef.value?.resetForm()
  ElMessage.success('SSH连接已建立')
}

// 快速连接处理
const handleQuickConnect = () => {
  if (!quickConnectForm.host || !quickConnectForm.username) {
    ElMessage.warning('请填写主机地址和用户名')
    return
  }

  const connectionConfig = {
    name: `${quickConnectForm.username}@${quickConnectForm.host}`,
    host: quickConnectForm.host,
    port: 22,
    username: quickConnectForm.username,
    authType: 'password',
    password: ''
  }

  // 创建新标签页并连接
  terminalStore.createTab(connectionConfig)
  
  // 重置表单并关闭对话框
  quickConnectForm.host = ''
  quickConnectForm.username = ''
  showQuickConnect.value = false
  
  ElMessage.success(`正在连接到 ${connectionConfig.host}...`)
}

// 获取连接状态文本
const getStatusText = (tab) => {
  if (!tab.connection) {
    return '本地终端'
  }
  return tab.isConnected ? '已连接' : '未连接'
}
</script>

<style scoped>
.tab-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--el-bg-color);
}

/* 清心主题下的标签管理器 */
.fresh-theme .tab-manager {
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
}

.tab-nav {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--el-border-color);
  background-color: var(--el-bg-color-page);
  padding: 0 8px;
  min-height: 40px;
}

/* 清心主题下的标签导航栏 */
.fresh-theme .tab-nav {
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%);
  border-bottom: 1px solid #d6e9ff;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.08);
}

.tab-list {
  display: flex;
  flex: 1;
  overflow-x: auto;
  gap: 8px;
  padding: 4px 0;
  align-items: flex-start;
}

.tab-item {
  position: relative;
  display: flex;
  align-items: stretch;
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--el-fill-color-light);
  border: 1px solid transparent;
  min-width: 300px;
  max-width: 400px;
  min-height: 120px;
}

.tab-item:hover {
  background-color: var(--el-fill-color);
}

.tab-item.active {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
}

/* 清心主题下的标签项目 */
.fresh-theme .tab-item {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e3f2fd;
  color: #2c3e50;
  backdrop-filter: blur(5px);
}

.fresh-theme .tab-item:hover {
  background: rgba(240, 247, 255, 0.95);
  border-color: #b3d9ff;
  color: #1565c0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.15);
}

.fresh-theme .tab-item.active {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  border-color: #4285f4;
  color: white;
  box-shadow: 0 4px 16px rgba(66, 133, 244, 0.3);
}

/* 设备卡片样式 */
.device-card {
  display: flex;
  flex: 1;
  gap: 12px;
  overflow: hidden;
}

/* 设备图片区域 */
.device-image {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
}

.device-img {
  width: 100%;
  height: 100%;
}

.image-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--el-fill-color) 0%, var(--el-fill-color-light) 100%);
}

.device-icon {
  font-size: 24px;
  color: var(--el-text-color-placeholder);
}

/* 设备信息区域 */
.device-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.connection-status-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--el-fill-color);
  flex-shrink: 0;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--el-color-info);
}

.status-dot.connected {
  background-color: var(--el-color-success);
  box-shadow: 0 0 4px rgba(103, 194, 58, 0.5);
}

.status-dot.disconnected {
  background-color: var(--el-color-warning);
  box-shadow: 0 0 4px rgba(230, 162, 60, 0.5);
}

.status-dot.local {
  background-color: var(--el-color-primary);
  box-shadow: 0 0 4px rgba(64, 158, 255, 0.5);
}

.status-text {
  font-size: 10px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.device-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  min-width: 40px;
}

.detail-value {
  font-size: 11px;
  color: var(--el-text-color-primary);
  font-weight: 600;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

/* 清心主题下的设备卡片 */
.fresh-theme .device-image {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 247, 255, 0.9) 100%);
  border-color: #d6e9ff;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.1);
}

.fresh-theme .image-slot {
  background: linear-gradient(135deg, rgba(240, 247, 255, 0.8) 0%, rgba(227, 242, 253, 0.8) 100%);
}

.fresh-theme .device-icon {
  color: #4285f4;
  text-shadow: 0 0 10px rgba(66, 133, 244, 0.3);
}

.fresh-theme .device-name {
  color: #1565c0;
  font-weight: 700;
}

.fresh-theme .connection-status-badge {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #e3f2fd;
  backdrop-filter: blur(5px);
}

.fresh-theme .status-dot.connected {
  background: #2ecc71;
  box-shadow: 0 0 8px rgba(46, 204, 113, 0.6);
}

.fresh-theme .status-dot.disconnected {
  background: #f39c12;
  box-shadow: 0 0 8px rgba(243, 156, 18, 0.6);
}

.fresh-theme .status-dot.local {
  background: #4285f4;
  box-shadow: 0 0 8px rgba(66, 133, 244, 0.6);
}

.fresh-theme .status-text {
  color: #34495e;
  font-weight: 600;
}

.fresh-theme .detail-label {
  color: #5f6368;
  font-weight: 600;
}

.fresh-theme .detail-value {
  color: #1565c0;
  font-weight: 700;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0.6;
  transition: all 0.2s;
  background-color: var(--el-fill-color);
  z-index: 1;
}

.close-btn:hover {
  opacity: 1;
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  transform: scale(1.1);
}

/* 关闭按钮在清心主题下的样式 */
.fresh-theme .close-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e3f2fd;
  backdrop-filter: blur(5px);
}

.fresh-theme .close-btn:hover {
  background-color: rgba(244, 67, 54, 0.1);
  color: #f44336;
  border-color: #f44336;
}



.tab-content-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 清心主题下的标签内容区域 - 终端区域保持黑色 */
.fresh-theme .tab-content-area {
  background: #1e1e1e;
}

.tab-pane {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* 滚动条样式 */
.tab-list::-webkit-scrollbar {
  height: 4px;
}

.tab-list::-webkit-scrollbar-track {
  background: transparent;
}

.tab-list::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 2px;
}

.tab-list::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-darker);
}

/* 快速连接样式 */
.quick-connect-form {
  padding: 20px 0;
}

.quick-connect-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color);
}


</style> 