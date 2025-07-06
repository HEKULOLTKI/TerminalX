<template>
  <div class="tab-manager">
    <!-- 标签页导航栏 -->
    <div class="tab-nav">
       <el-icon
        class="switch-btn"
        :class="{ disabled: !canSwitchToPrevious }"
        @click="switchToPreviousTab"
        title="上一个标签页"
      >
        <CaretLeft />
      </el-icon>
      <div class="tab-nav-container">
        <div class="tab-list" ref="tabListRef">
          <div
            v-for="tab in terminalStore.tabs"
            :key="tab.id"
            :class="['tab-item', { active: tab.id === terminalStore.activeTabId }]"
            :ref="el => { if (el) tabElements[tab.id] = el }"
          >
            <div class="device-card" @click="switchTab(tab.id)">
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
            >
              <Close />
            </el-icon>
          </div>
        </div>
      </div>
      <el-icon
        class="switch-btn"
        :class="{ disabled: !canSwitchToNext }"
        @click="switchToNextTab"
        title="下一个标签页"
      >
        <CaretRight />
      </el-icon>
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
import { nextTick, ref, reactive, onMounted, onUnmounted, watch, computed, onBeforeUpdate } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { 
  Monitor, 
  Connection, 
  Close,
  CaretLeft,
  CaretRight
} from '@element-plus/icons-vue'
import { useTerminalStore } from '../stores/terminal'
import Terminal from './Terminal.vue'
import SSHConnection from './SSHConnection.vue'

const terminalStore = useTerminalStore()

const switchTab = (tabId) => {
  terminalStore.switchTab(tabId)
}

// 存储对标签页元素的引用
const tabElements = reactive({})

onBeforeUpdate(() => {
  // 在组件更新前，清空引用，以防内存泄漏和旧引用
  Object.keys(tabElements).forEach(key => delete tabElements[key])
})

// 监听活动标签页的变化，并将其滚动到视图中
watch(
  () => terminalStore.activeTabId,
  (newId) => {
    if (newId && tabElements[newId]) {
      nextTick(() => {
        tabElements[newId].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        })
      })
    }
  },
  { flush: 'post' }
)


// 标签页滚动
const tabListRef = ref(null)
const showScrollButtons = ref(false)

const checkScroll = () => {
  nextTick(() => {
    const el = tabListRef.value
    if (el) {
      showScrollButtons.value = el.scrollWidth > el.clientWidth
    }
  })
}

const scrollTabs = (amount) => {
  const el = tabListRef.value
  if (el) {
    el.scrollTo({
      left: el.scrollLeft + amount,
      behavior: 'smooth'
    })
  }
}

onMounted(() => {
  window.addEventListener('resize', checkScroll)
  checkScroll()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScroll)
})

watch(() => terminalStore.tabs, () => {
  checkScroll()
}, { deep: true, flush: 'post' })


// 切换上一个/下一个标签页
const activeIndex = computed(() => terminalStore.tabs.findIndex(t => t.id === terminalStore.activeTabId))

const canSwitchToPrevious = computed(() => activeIndex.value > 0)
const canSwitchToNext = computed(() => activeIndex.value < terminalStore.tabs.length - 1)

const switchToPreviousTab = () => {
  if (canSwitchToPrevious.value) {
    const previousTab = terminalStore.tabs[activeIndex.value - 1]
    switchTab(previousTab.id)
  }
}

const switchToNextTab = () => {
  if (canSwitchToNext.value) {
    const nextTab = terminalStore.tabs[activeIndex.value + 1]
    switchTab(nextTab.id)
  }
}


const closeTab = (tabId) => {
  terminalStore.removeTab(tabId)
}

const getStatusText = (tab) => {
  if (tab.isConnected) return '已连接'
  if (tab.connection) return '未连接'
  return '本地终端'
}

// 新建SSH连接
const showNewSSHConnection = ref(false)
const sshConnectionRef = ref(null)

const newSSHConnection = () => {
  showNewSSHConnection.value = true
}

const handleSSHConnectionSuccess = (connectionInfo) => {
  terminalStore.addTab({
    type: 'ssh',
    title: `${connectionInfo.username}@${connectionInfo.host}`,
    connection: connectionInfo,
    isActive: true
  })
  showNewSSHConnection.value = false
}


// 快速连接
const showQuickConnect = ref(false)
const quickConnectForm = reactive({
  host: '',
  username: ''
})

const quickConnect = () => {
  showQuickConnect.value = true
}

const handleQuickConnect = () => {
  if (!quickConnectForm.host || !quickConnectForm.username) {
    ElMessage.warning('请输入主机和用户名')
    return
  }
  
  const connectionInfo = { 
    id: `quick_${Date.now()}`,
    type: 'ssh', 
    host: quickConnectForm.host, 
    username: quickConnectForm.username,
    // 使用默认端口
    port: 22 
  }

  terminalStore.addTab({
    title: `${connectionInfo.username}@${connectionInfo.host}`,
    connection: connectionInfo,
    type: 'ssh',
    isActive: true
  })

  showQuickConnect.value = false
  quickConnectForm.host = ''
  quickConnectForm.username = ''
}


// 暴露给父组件
defineExpose({
  newSSHConnection,
  quickConnect
})

</script>

<style scoped>
.tab-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f0f2f5;
  overflow: hidden;
}

/* 标签页导航栏 */
.tab-nav {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 8px;
  background-color: #e9eef3;
  border-bottom: 1px solid #dcdfe6;
}

.tab-nav-container {
  flex-grow: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
  position: relative;
}

.scroll-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  cursor: pointer;
  color: #606266;
  z-index: 10;
  background-color: rgba(233, 238, 243, 0.8);
  border-radius: 50%;
  padding: 4px;
}
.scroll-btn.left { left: 0; }
.scroll-btn.right { right: 0; }
.scroll-btn:hover { color: #409eff; }

.switch-btn {
  font-size: 24px;
  cursor: pointer;
  margin: 0 5px;
  color: #606266;
}
.switch-btn:hover {
  color: #409eff;
}
.switch-btn.disabled {
  cursor: not-allowed;
  color: #c0c4cc;
}


.tab-list {
  display: flex;
  flex-direction: row;
  align-items: stretch; /* 确保子项高度一致 */
  padding-bottom: 5px; /* 为滚动条留出空间 */
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: #c5c5c5 #f1f1f1; /* Firefox */
}

/* Chrome/Safari aA */
.tab-list::-webkit-scrollbar {
  height: 8px;
}
.tab-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}
.tab-list::-webkit-scrollbar-thumb {
  background: #c5c5c5;
  border-radius: 4px;
}
.tab-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.tab-item {
  position: relative;
  display: flex;
  flex-direction: column; /* 保持内部垂直布局 */
  flex-shrink: 0;
  width: 280px; /* 固定宽度 */
  margin-right: 10px;
  border-radius: 8px;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.tab-item:last-child {
  margin-right: 0;
}

.tab-item.active {
  border-color: #409eff;
  background-color: #ecf5ff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}
.tab-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  padding: 2px;
  transition: all 0.2s;
}
.close-btn:hover {
  color: #fff;
  background-color: #f56c6c;
}
.active .close-btn {
   background-color: rgba(236, 245, 255, 0.5);
}
.active .close-btn:hover {
  color: #fff;
  background-color: #f56c6c;
}


/* 设备卡片 */
.device-card {
  display: flex;
  padding: 12px;
  flex-grow: 1;
}

.device-image {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  margin-right: 12px;
  border-radius: 6px;
  background-color: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.device-img {
  width: 100%;
  height: 100%;
}
.image-slot {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e9eef3;
}
.device-icon {
  font-size: 40px;
  color: #a8abb2;
}


.device-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-grow: 1;
  min-width: 0; /* 防止flex item溢出 */
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.device-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
}

.connection-status-badge {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: #f0f2f5;
  font-size: 12px;
  flex-shrink: 0;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}
.status-dot.connected { background-color: #67c23a; }
.status-dot.disconnected { background-color: #f56c6c; }
.status-dot.local { background-color: #409eff; }

.status-text {
  color: #606266;
}

.device-details {
  font-size: 13px;
  color: #606266;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  white-space: nowrap;
}
.detail-label {
  color: #909399;
  margin-right: 8px;
}
.detail-value {
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
}


/* 标签页内容 */
.tab-content-area {
  flex-grow: 1;
  position: relative;
  background-color: #fff;
}
.tab-pane {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  width: 100%;
}


.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.quick-connect-form {
  padding: 0 20px;
}
.quick-connect-actions {
  text-align: right;
  margin-top: 20px;
}
</style> 