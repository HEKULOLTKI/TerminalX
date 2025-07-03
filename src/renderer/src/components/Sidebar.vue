<template>
  <div class="sidebar">
    <!-- 头部 -->
    <div class="sidebar-header">
      <div class="logo">
        <el-icon class="logo-icon"><Monitor /></el-icon>
        <span class="logo-text">TerminalX</span>
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

    <!-- 快速操作 -->
    <div class="quick-actions">
      <el-button 
        type="primary" 
        :icon="Plus" 
        @click="createNewTab"
        style="width: 100%"
      >
        新建终端
      </el-button>
    </div>

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
            <el-button type="primary" @click="createNewTab">
              创建第一个标签页
            </el-button>
          </el-empty>
        </div>
      </div>
    </div>

    <!-- 底部工具 -->
    <div class="sidebar-footer">
      <el-button 
        :icon="Setting" 
        text 
        @click="showSettings = true"
        title="设置"
      />
      <el-button 
        :icon="QuestionFilled" 
        text 
        @click="showHelp = true"
        title="帮助"
      />
      <el-button 
        :icon="InfoFilled" 
        text 
        @click="showAbout = true"
        title="关于"
      />
    </div>

    <!-- 设置对话框 -->
    <el-dialog v-model="showSettings" title="设置" width="800px">
      <div class="settings-content">
        <el-tabs v-model="activeSettingsTab" type="border-card">
          <!-- 常规设置 -->
          <el-tab-pane label="常规" name="general">
            <el-form label-width="120px">
              <el-form-item label="默认主题">
                <el-radio-group v-model="terminalStore.currentTheme" @change="terminalStore.setTheme">
                  <el-radio label="dark">深色主题</el-radio>
                  <el-radio label="light">浅色主题</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          
          <!-- SSH连接管理 -->
          <el-tab-pane label="SSH连接" name="ssh">
            <SSHConnectionManager />
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>

    <!-- 帮助对话框 -->
    <el-dialog v-model="showHelp" title="帮助" width="600px">
      <div class="help-content">
        <h3>快捷键</h3>
        <ul>
          <li><code>Ctrl + T</code> - 新建标签页</li>
          <li><code>Ctrl + W</code> - 关闭当前标签页</li>
          <li><code>Ctrl + Tab</code> - 切换到下一个标签页</li>
          <li><code>Ctrl + Shift + Tab</code> - 切换到上一个标签页</li>
          <li><code>Ctrl + 1-9</code> - 切换到指定标签页</li>
        </ul>
        
        <h3>支持的协议</h3>
        <ul>
          <li>SSH - 安全外壳协议</li>
          <li>本地终端 - 模拟终端环境</li>
        </ul>
      </div>
    </el-dialog>

    <!-- 关于对话框 -->
    <el-dialog v-model="showAbout" title="关于 TerminalX" width="400px">
      <div class="about-content">
        <div class="about-logo">
          <el-icon class="about-icon"><Monitor /></el-icon>
          <h2>TerminalX</h2>
          <p>v1.0.0</p>
        </div>
        <p>基于 Electron + Vue 的现代化终端模拟器</p>
        <p>支持 SSH 连接、多标签页管理、主题切换等功能</p>
      </div>
    </el-dialog>
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
  QuestionFilled,
  InfoFilled,
  Sunny,
  Moon
} from '@element-plus/icons-vue'
import { useTerminalStore } from '../stores/terminal'
import SSHConnectionManager from './SSHConnectionManager.vue'

const terminalStore = useTerminalStore()

// 对话框状态
const showSettings = ref(false)
const showHelp = ref(false)
const showAbout = ref(false)
const activeSettingsTab = ref('general')

// 切换主题
const toggleTheme = () => {
  const newTheme = terminalStore.currentTheme === 'dark' ? 'light' : 'dark'
  terminalStore.setTheme(newTheme)
  ElMessage.success(`已切换到${newTheme === 'dark' ? '深色' : '浅色'}主题`)
}

// 创建新标签页
const createNewTab = () => {
  terminalStore.createTab()
  ElMessage.success('已创建新标签页')
}
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

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.theme-toggle {
  border: none;
  background: transparent;
}

.quick-actions {
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
}

.tabs-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

.no-tabs {
  padding: 20px;
  text-align: center;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--el-border-color);
  display: flex;
  justify-content: space-around;
}

.settings-content {
  min-height: 400px;
}

.help-content h3 {
  margin-bottom: 16px;
  color: var(--el-text-color-primary);
}

.help-content ul {
  margin-bottom: 24px;
  padding-left: 20px;
}

.help-content li {
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
}

.help-content code {
  background-color: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}

.about-content {
  text-align: center;
}

.about-logo {
  margin-bottom: 24px;
}

.about-icon {
  font-size: 48px;
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.about-content h2 {
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.about-content p {
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}
</style> 