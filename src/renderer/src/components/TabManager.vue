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
          <div class="tab-content">
            <el-icon class="tab-icon">
              <Monitor v-if="!tab.connection" />
              <Connection v-else />
            </el-icon>
            <span class="tab-title">{{ tab.title }}</span>
            <div 
              v-if="tab.isConnected" 
              class="connection-status connected"
              title="已连接"
            ></div>
            <div 
              v-else-if="tab.connection" 
              class="connection-status disconnected"
              title="未连接"
            ></div>
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
      
      <!-- 新建标签页按钮 -->
      <el-dropdown class="new-tab-dropdown" trigger="click">
        <el-button 
          class="new-tab-btn" 
          size="small" 
          :icon="Plus"
          title="新建标签页"
        >
          新建
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="createNewTab">
              <el-icon><Monitor /></el-icon>
              本地终端
            </el-dropdown-item>
            <el-dropdown-item @click="showNewSSHConnection = true">
              <el-icon><Connection /></el-icon>
              SSH连接
            </el-dropdown-item>
            <el-dropdown-item divided @click="showQuickConnect = true">
              <el-icon><Link /></el-icon>
              快速连接
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      
      <!-- 标签页操作菜单 -->
      <el-dropdown class="tab-actions" trigger="click">
        <el-button size="small" :icon="MoreFilled" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="closeOtherTabs">
              <el-icon><Close /></el-icon>
              关闭其他标签页
            </el-dropdown-item>
            <el-dropdown-item @click="closeAllTabs">
              <el-icon><Close /></el-icon>
              关闭所有标签页
            </el-dropdown-item>
            <el-dropdown-item divided @click="duplicateCurrentTab">
              <el-icon><CopyDocument /></el-icon>
              复制当前标签页
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
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
        <el-dropdown>
          <el-button type="primary">创建新标签页</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="createNewTab">
                <el-icon><Monitor /></el-icon>
                本地终端
              </el-dropdown-item>
              <el-dropdown-item @click="showNewSSHConnection = true">
                <el-icon><Connection /></el-icon>
                SSH连接
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
        @saved="handleSSHConnectionSaved"
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
  Close, 
  Plus, 
  MoreFilled, 
  CopyDocument,
  Link
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

const handleSSHConnectionSaved = (connection) => {
  showNewSSHConnection.value = false
  sshConnectionRef.value?.resetForm()
  ElMessage.success('SSH连接配置已保存')
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
</script>

<style scoped>
.tab-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--el-bg-color);
}

.tab-nav {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--el-border-color);
  background-color: var(--el-bg-color-page);
  padding: 0 8px;
  min-height: 40px;
}

.tab-list {
  display: flex;
  flex: 1;
  overflow-x: auto;
  gap: 2px;
}

.tab-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  margin: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: var(--el-fill-color-light);
  border: 1px solid transparent;
  min-width: 120px;
  max-width: 200px;
  white-space: nowrap;
}

.tab-item:hover {
  background-color: var(--el-fill-color);
}

.tab-item.active {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
}

.tab-content {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.tab-icon {
  margin-right: 6px;
  font-size: 14px;
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}

.connection-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 6px;
}

.connection-status.connected {
  background-color: var(--el-color-success);
}

.connection-status.disconnected {
  background-color: var(--el-color-warning);
}

.close-btn {
  margin-left: 6px;
  padding: 2px;
  border-radius: 3px;
  font-size: 12px;
  opacity: 0.6;
  transition: all 0.2s;
}

.close-btn:hover {
  opacity: 1;
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.new-tab-btn {
  margin-left: 8px;
  border: none;
  background: transparent;
}

.tab-actions {
  margin-left: 8px;
}

.tab-content-area {
  flex: 1;
  overflow: hidden;
  position: relative;
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

.new-tab-dropdown {
  margin-left: 8px;
}
</style> 