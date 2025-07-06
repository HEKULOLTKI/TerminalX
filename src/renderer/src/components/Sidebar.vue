<template>
  <div class="sidebar">
    <!-- 头部 -->
    <div class="sidebar-header">
      <div class="logo">
        <el-icon class="logo-icon">
          <Monitor v-if="props.mode === 'terminal'" />
          <Setting v-else />
        </el-icon>
        <span class="logo-text">{{ props.mode === 'terminal' ? '终端管理' : '应用配置' }}</span>
      </div>
      
      <!-- 主题切换 -->
      <el-tooltip content="切换主题" placement="right">
        <el-button 
          class="theme-toggle" 
          size="small" 
          :icon="terminalStore.currentTheme === 'dark' ? Sunny : Moon"
          @click="toggleTheme"
        />
      </el-tooltip>
    </div>

    <!-- 终端模式内容 -->
    <template v-if="props.mode === 'terminal'">
      <!-- 快速操作 -->
      <!-- <div class="quick-actions">
        <el-button 
          type="primary" 
          :icon="Plus" 
          @click="createNewTab"
          style="width: 100%"
        >
          新建终端
        </el-button>
      </div> -->

      <!-- 标签页列表 -->
      <div class="tabs-section">
        <div class="section-header">
          <span class="section-title">标签页</span>
          <span class="connection-count">{{ terminalStore.tabs.length }}</span>
        </div>

        <div class="tabs-list">
          <div
            v-for="tab in terminalStore.tabs"
            :key="tab.id"
            :class="['tab-item', { current: tab.id === terminalStore.activeTabId }]"
            @click="terminalStore.switchTab(tab.id)"
          >
            <div class="tab-info">
              <div class="tab-name">{{ tab.title }}</div>
              <div class="tab-status" v-if="tab.connection">
                <span :class="['status-dot', { connected: tab.isConnected }]"></span>
                {{ tab.isConnected ? '已连接' : '未连接' }}
              </div>
              <div class="tab-status" v-else>
                <span class="status-dot local"></span>
                本地终端
              </div>
            </div>
            <el-button 
              size="small" 
              :icon="Close" 
              text 
              @click.stop="terminalStore.closeTab(tab.id)"
              v-show="terminalStore.tabs.length > 1"
            />
          </div>

          <div v-if="terminalStore.tabs.length === 0" class="no-tabs">
            <el-empty 
              description="暂无标签页" 
              :image-size="60"
            >
              <!-- <el-button type="primary" @click="createNewTab">
                创建第一个标签页
              </el-button> -->
            </el-empty>
          </div>
        </div>
      </div>

      <!-- SSH 连接 -->
      <div class="connections-section">
        <div class="section-header">
          <span class="section-title">SSH 连接</span>
          <span class="connection-count">{{ terminalStore.connections.length }}</span>
        </div>
        <div class="connection-list">
          <div
            v-for="conn in terminalStore.connections"
            :key="conn.id"
            class="connection-item"
            @click="connectToSsh(conn)"
          >
            <div class="connection-info">
              <div class="connection-name">{{ conn.name }}</div>
              <div class="connection-details">{{ conn.username }}@{{ conn.host }}</div>
            </div>
            <el-button 
              :icon="Connection" 
              size="small" 
              text 
              :disabled="isSshConnectionActive(conn)"
            />
          </div>
          <div v-if="terminalStore.connections.length === 0" class="no-connections">
            <el-text size="small" type="info">无已保存的 SSH 连接</el-text>
          </div>
        </div>
      </div>

      <!-- 串口连接 -->
      <div class="connections-section">
        <div class="section-header">
          <span class="section-title">串口连接</span>
          <span class="connection-count">{{ terminalStore.serialConnections.length }}</span>
        </div>
        <div class="connection-list">
          <div
            v-for="conn in terminalStore.serialConnections"
            :key="conn.id"
            class="connection-item"
            @click="connectToSerial(conn)"
          >
            <div class="connection-info">
              <div class="connection-name">{{ conn.name }}</div>
              <div class="connection-details">{{ conn.port }}</div>
            </div>
            <el-button 
              :icon="Connection" 
              size="small" 
              text 
              :disabled="isSerialConnectionActive(conn)"
            />
          </div>
          <div v-if="terminalStore.serialConnections.length === 0" class="no-connections">
            <el-text size="small" type="info">无已保存的串口连接</el-text>
          </div>
        </div>
      </div>
    </template>

    <!-- 配置模式内容 -->
    <template v-else>
      <div class="config-content">
        <div class="config-section">
          <h3>连接管理</h3>
          
          <!-- 连接类型选择 -->
          <div class="connection-type-tabs">
            <el-tabs v-model="activeConnectionType" type="border-card">
              <el-tab-pane label="SSH连接" name="ssh">
                <SSHConnectionManager />
              </el-tab-pane>
              <el-tab-pane label="串口连接" name="serial">
                <SerialConnectionManager />
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </div>
    </template>


  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Monitor,
  Plus,
  Close,
  Setting,
  Sunny,
  Moon,
  Connection,
} from '@element-plus/icons-vue'
import { useTerminalStore } from '../stores/terminal'
import SSHConnectionManager from './SSHConnectionManager.vue'
import SerialConnectionManager from './SerialConnectionManager.vue'

// 接收props
const props = defineProps({
  mode: {
    type: String,
    default: 'terminal',
    validator: (value) => ['terminal', 'config'].includes(value)
  }
})

const terminalStore = useTerminalStore()

// 连接类型选择
const activeConnectionType = ref('ssh')

// 检查SSH连接是否已在标签页中打开且处于连接状态
const isSshConnectionActive = (connection) => {
  return terminalStore.tabs.some(tab => 
    tab.connection?.type !== 'serial' &&
    tab.connection?.host === connection.host && 
    tab.connection?.port === connection.port && 
    tab.connection?.username === connection.username &&
    tab.isConnected
  )
}

// 检查串口连接是否已在标签页中打开且处于连接状态
const isSerialConnectionActive = (connection) => {
  return terminalStore.tabs.some(tab => 
    tab.connection?.type === 'serial' &&
    tab.connection?.port === connection.port &&
    tab.isConnected
  )
}

// 连接到SSH主机
const connectToSsh = (connection) => {
  if (isSshConnectionActive(connection)) {
    ElMessage.info('该连接已在标签页中打开')
    return
  }
  terminalStore.createTab(connection)
  terminalStore.hideSidebar()
  ElMessage.success(`正在连接到 ${connection.name}...`)
}

// 连接到串口
const connectToSerial = (connection) => {
  if (isSerialConnectionActive(connection)) {
    ElMessage.info('该连接已在标签页中打开')
    return
  }
  terminalStore.createSerialTab(connection)
  terminalStore.hideSidebar()
  ElMessage.success(`正在连接到 ${connection.name}...`)
}

// 切换主题
const toggleTheme = () => {
  const newTheme = terminalStore.currentTheme === 'dark' ? 'fresh' : 'dark'
  terminalStore.setTheme(newTheme)
  
  const themeNames = {
    fresh: '清心',
    dark: '深色'
  }
  ElMessage.success(`已切换到${themeNames[newTheme]}主题`)
}

// 创建新标签页
// const createNewTab = () => {
//   terminalStore.createTab()
//   ElMessage.success('已创建新标签页')
// }
</script>

<style scoped>
.sidebar {
  width: 280px;
  height: 100%;
  background-color: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 清心主题下的侧边栏样式 */
.fresh-theme .sidebar {
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border-right: 1px solid #d6e9ff;
  box-shadow: 2px 0 10px rgba(66, 133, 244, 0.08);
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 清心主题下的侧边栏头部 */
.fresh-theme .sidebar-header {
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%);
  border-bottom: 1px solid #e3f2fd;
  box-shadow: 0 2px 4px rgba(66, 133, 244, 0.05);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 20px;
  color: var(--el-color-primary);
}

.logo-text {
  font-size: 16px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

/* 清心主题下的Logo样式 */
.fresh-theme .logo-icon {
  color: #4285f4;
  text-shadow: 0 0 10px rgba(66, 133, 244, 0.3);
}

.fresh-theme .logo-text {
  color: #1565c0;
  font-weight: 600;
}

/* 清心主题下的按钮样式 */
.fresh-theme .el-button--primary {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  border-color: #4285f4;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.fresh-theme .el-button--primary:hover {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border-color: #1976d2;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(66, 133, 244, 0.4);
}

.fresh-theme .theme-toggle {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #d6e9ff;
  color: #4285f4;
  backdrop-filter: blur(10px);
}

.fresh-theme .theme-toggle:hover {
  background: rgba(240, 247, 255, 0.9);
  border-color: #4285f4;
  color: #1565c0;
}

.quick-actions {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
}

/* 清心主题下的快速操作区域 */
.fresh-theme .quick-actions {
  background: rgba(248, 251, 255, 0.8);
  backdrop-filter: blur(5px);
}

.tabs-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 清心主题下的标签页区域 */
.fresh-theme .tabs-section {
  background: rgba(255, 255, 255, 0.6);
}

.fresh-theme .section-header {
  background: rgba(240, 247, 255, 0.8);
  border-bottom: 1px solid #e3f2fd;
}

.fresh-theme .section-title {
  color: #1565c0;
  font-weight: 600;
}

.fresh-theme .connection-count {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  color: white;
  box-shadow: 0 2px 6px rgba(66, 133, 244, 0.3);
}

.section-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color);
}

.section-title {
  font-size: 12px;
  font-weight: bold;
  color: var(--el-text-color-regular);
  text-transform: uppercase;
}

.connection-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background-color: var(--el-color-primary-light-9);
  padding: 2px 6px;
  border-radius: 10px;
}

.tabs-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tab-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.tab-item:hover {
  background-color: var(--el-fill-color);
}

.tab-item.current {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}

.tab-info {
  flex: 1;
  min-width: 0;
}

.tab-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.tab-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--el-color-info);
}

.status-dot.connected {
  background-color: var(--el-color-success);
}

.status-dot.local {
  background-color: var(--el-color-primary);
}

.theme-toggle {
  border: none;
  background: transparent;
}

/* 清心主题下的标签页项目 */
.fresh-theme .tab-item {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #e3f2fd;
  backdrop-filter: blur(5px);
}

.fresh-theme .tab-item:hover {
  background: rgba(240, 247, 255, 0.9);
  border-color: #b3d9ff;
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.15);
}

.fresh-theme .tab-item.current {
  background: linear-gradient(135deg, #e3f2fd 0%, #f0f7ff 100%);
  border-color: #4285f4;
  color: #1565c0;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.2);
}

.fresh-theme .tab-name {
  color: inherit;
  font-weight: 500;
}

.fresh-theme .status-dot.connected {
  background: #2ecc71;
  box-shadow: 0 0 6px rgba(46, 204, 113, 0.5);
}

.fresh-theme .status-dot.local {
  background: #4285f4;
  box-shadow: 0 0 6px rgba(66, 133, 244, 0.5);
}

.no-tabs {
  padding: 20px;
  text-align: center;
}

/* 配置内容样式 */
.config-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.config-section {
  margin-bottom: 24px;
}

.config-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color);
}

.config-item {
  margin-bottom: 16px;
}

.config-item label {
  display: block;
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

/* 清心主题下的配置样式 */
.fresh-theme .config-section h3 {
  color: #1565c0;
  border-bottom-color: #d6e9ff;
}

.fresh-theme .config-item label {
  color: #2c3e50;
}



/* 连接类型选择标签页样式 */
.connection-type-tabs {
  margin-top: 16px;
}

.connection-type-tabs :deep(.el-tabs) {
  background: transparent;
}

.connection-type-tabs :deep(.el-tabs__header) {
  margin: 0 0 16px 0;
}

.connection-type-tabs :deep(.el-tabs__item) {
  padding: 0 20px;
  height: 36px;
  line-height: 36px;
  font-size: 14px;
}

.connection-type-tabs :deep(.el-tabs__content) {
  padding: 0;
}

/* 清心主题适配 */
.fresh .connection-type-tabs :deep(.el-tabs__item) {
  color: #5f6368;
}

.fresh .connection-type-tabs :deep(.el-tabs__item.is-active) {
  color: #1565c0;
}

.fresh .connection-type-tabs :deep(.el-tabs__active-bar) {
  background-color: #4285f4;
}

.connections-section {
  padding: 0 16px;
  border-top: 1px solid var(--el-border-color);
}

.connection-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  max-height: 200px; /* 限制最大高度，超出则滚动 */
  overflow-y: auto;
}

.connection-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.connection-item:hover {
  background-color: var(--el-fill-color-light);
}

.connection-info .connection-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.connection-info .connection-details {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.no-connections {
  padding: 16px;
  text-align: center;
}

.tabs-section, .connections-section {
  padding: 12px 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.connection-count {
  font-size: 12px;
  background-color: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  padding: 2px 6px;
  border-radius: 8px;
}
</style> 