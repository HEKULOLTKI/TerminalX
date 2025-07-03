<template>
  <div class="app" :class="{ 'dark-theme': terminalStore.currentTheme === 'dark' }">
    <!-- 自定义标题栏 -->
    <TitleBar />
    
    <!-- 主应用内容 -->
    <div class="app-content">
      <!-- 左侧终端区域 -->
      <div class="terminal-section">
      <!-- 侧边栏 -->
      <Sidebar class="app-sidebar" />
      
      <!-- 终端主内容 -->
      <div class="terminal-main">
        <TabManager />
      </div>
    </div>
    
    <!-- 右侧AI聊天区域 -->
    <div class="ai-section" :class="{ 'collapsed': isChatCollapsed }">
      <!-- AI聊天区域头部控制按钮 -->
      <div class="ai-header">
        <button @click="toggleChat" class="toggle-chat-btn">
          <span v-if="isChatCollapsed">展开AI助手</span>
          <span v-else>收起AI助手</span>
          <i :class="isChatCollapsed ? 'icon-expand' : 'icon-collapse'">
            {{ isChatCollapsed ? '◀' : '▶' }}
          </i>
        </button>
      </div>
      
      <!-- AI聊天组件 -->
      <div class="ai-content" v-show="!isChatCollapsed">
        <AIChat />
      </div>
    </div>
    
      <!-- 分隔条 -->
      <div 
        class="resize-handle" 
        @mousedown="startResize"
        v-show="!isChatCollapsed"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive } from 'vue'
import { useTerminalStore } from './stores/terminal'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import TabManager from './components/TabManager.vue'
import AIChat from './components/AIChat.vue'
import './assets/layout.css'

const terminalStore = useTerminalStore()
const isChatCollapsed = ref(false)
const isResizing = ref(false)

// 布局尺寸
const layout = reactive({
  terminalWidth: 60, // 百分比
  aiWidth: 40,       // 百分比
  minTerminalWidth: 30,
  maxTerminalWidth: 85
})

onMounted(() => {
  // 设置初始主题
  document.documentElement.classList.toggle('dark', terminalStore.currentTheme === 'dark')
  
  // 监听主题变化
  const observer = new MutationObserver(() => {
    document.documentElement.classList.toggle('dark', terminalStore.currentTheme === 'dark')
  })
  
  observer.observe(document.documentElement, { 
    attributes: true, 
    attributeFilter: ['class'] 
  })

  // 从本地存储恢复布局设置
  const savedLayout = localStorage.getItem('terminalx-layout')
  if (savedLayout) {
    try {
      const parsed = JSON.parse(savedLayout)
      Object.assign(layout, parsed)
    } catch (e) {
      console.warn('Failed to parse saved layout:', e)
    }
  }

  // 从本地存储恢复聊天收起状态
  const savedChatState = localStorage.getItem('terminalx-chat-collapsed')
  if (savedChatState !== null) {
    isChatCollapsed.value = JSON.parse(savedChatState)
  }

  updateLayout()
})

// 切换聊天面板
const toggleChat = () => {
  isChatCollapsed.value = !isChatCollapsed.value
  localStorage.setItem('terminalx-chat-collapsed', JSON.stringify(isChatCollapsed.value))
  updateLayout()
}

// 开始调整大小
const startResize = (e) => {
  if (isChatCollapsed.value) return
  
  isResizing.value = true
  const startX = e.clientX
  const startTerminalWidth = layout.terminalWidth
  
  const handleMouseMove = (e) => {
    if (!isResizing.value) return
    
    const deltaX = e.clientX - startX
    const containerWidth = window.innerWidth
    const deltaPercent = (deltaX / containerWidth) * 100
    
    let newTerminalWidth = startTerminalWidth + deltaPercent
    newTerminalWidth = Math.max(layout.minTerminalWidth, Math.min(layout.maxTerminalWidth, newTerminalWidth))
    
    layout.terminalWidth = newTerminalWidth
    layout.aiWidth = 100 - newTerminalWidth
    
    updateLayout()
  }
  
  const handleMouseUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    
    // 保存布局设置
    localStorage.setItem('terminalx-layout', JSON.stringify({
      terminalWidth: layout.terminalWidth,
      aiWidth: layout.aiWidth
    }))
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  
  e.preventDefault()
}

// 更新布局
const updateLayout = () => {
  const root = document.documentElement
  if (isChatCollapsed.value) {
    root.style.setProperty('--terminal-width', '100%')
    root.style.setProperty('--ai-width', '0%')
  } else {
    root.style.setProperty('--terminal-width', `${layout.terminalWidth}%`)
    root.style.setProperty('--ai-width', `${layout.aiWidth}%`)
  }
}
</script>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
}

#app {
  display: flex;
  flex-direction: column;
}

/* Element Plus主题定制 */
:root {
  --el-color-primary: #409eff;
  --el-color-primary-light-3: #79bbff;
  --el-color-primary-light-5: #a0cfff;
  --el-color-primary-light-7: #c6e2ff;
  --el-color-primary-light-8: #d9ecff;
  --el-color-primary-light-9: #ecf5ff;
  --el-color-primary-dark-2: #337ecc;
}

/* 深色主题变量 */
.dark {
  --el-bg-color: #1e1e1e;
  --el-bg-color-page: #252526;
  --el-bg-color-overlay: #2d2d30;
  --el-text-color-primary: #cccccc;
  --el-text-color-regular: #a3a3a3;
  --el-text-color-secondary: #909399;
  --el-text-color-placeholder: #6c6c6c;
  --el-border-color: #3c3c3c;
  --el-border-color-light: #414243;
  --el-border-color-lighter: #363637;
  --el-border-color-extra-light: #2b2b2c;
  --el-border-color-dark: #58585b;
  --el-border-color-darker: #636366;
  --el-fill-color: #303133;
  --el-fill-color-light: #262727;
  --el-fill-color-lighter: #1d1d1f;
  --el-fill-color-extra-light: #191919;
  --el-fill-color-dark: #39393a;
  --el-fill-color-darker: #424243;
  --el-fill-color-blank: transparent;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--el-fill-color-light);
}

::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

::-webkit-scrollbar-corner {
  background: var(--el-fill-color-light);
}
</style>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  transition: background-color 0.3s, color 0.3s;
  position: relative;
}

.app-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧终端区域 */
.terminal-section {
  width: var(--terminal-width, 60%);
  display: flex;
  background-color: var(--el-bg-color);
  transition: width 0.3s ease;
}

.app-sidebar {
  flex-shrink: 0;
}

.terminal-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 右侧AI聊天区域 */
.ai-section {
  width: var(--ai-width, 40%);
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
  transition: width 0.3s ease;
  min-width: 300px;
}

.ai-section.collapsed {
  width: 50px;
  min-width: 50px;
}

/* AI聊天头部 */
.ai-header {
  padding: 8px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color-page);
}

.toggle-chat-btn {
  width: 100%;
  padding: 8px 12px;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  transition: all 0.3s;
}

.toggle-chat-btn:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.ai-section.collapsed .toggle-chat-btn {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 12px 4px;
  height: 120px;
  width: auto;
  font-size: 11px;
}

.ai-section.collapsed .toggle-chat-btn span {
  display: none;
}

.ai-content {
  flex: 1;
  overflow: hidden;
}

/* 分隔条 */
.resize-handle {
  position: absolute;
  left: var(--terminal-width, 60%);
  top: 0;
  bottom: 0;
  width: 4px;
  background: transparent;
  cursor: col-resize;
  z-index: 1000;
  transition: left 0.3s ease;
}

.resize-handle:hover {
  background: var(--el-color-primary);
}

.resize-handle::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  width: 8px;
  background: transparent;
}

/* 深色主题样式 */
.app.dark-theme {
  background-color: var(--el-bg-color);
}

/* 确保终端背景色正确 */
.app :deep(.terminal-container) {
  --terminal-bg: var(--el-bg-color);
}

.app.dark-theme :deep(.terminal-container) {
  --terminal-bg: #1e1e1e;
}

/* Element Plus组件深色主题适配 */
.app.dark-theme :deep(.el-dialog) {
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
}

.app.dark-theme :deep(.el-dialog__header) {
  border-bottom: 1px solid var(--el-border-color);
}

.app.dark-theme :deep(.el-form-item__label) {
  color: var(--el-text-color-regular);
}

.app.dark-theme :deep(.el-input__inner) {
  background-color: var(--el-fill-color-light);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

.app.dark-theme :deep(.el-input__inner:focus) {
  border-color: var(--el-color-primary);
}

.app.dark-theme :deep(.el-textarea__inner) {
  background-color: var(--el-fill-color-light);
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);
}

.app.dark-theme :deep(.el-radio__label) {
  color: var(--el-text-color-regular);
}

.app.dark-theme :deep(.el-dropdown-menu) {
  background-color: var(--el-bg-color-overlay);
  border-color: var(--el-border-color);
}

.app.dark-theme :deep(.el-dropdown-menu__item) {
  color: var(--el-text-color-regular);
}

.app.dark-theme :deep(.el-dropdown-menu__item:hover) {
  background-color: var(--el-fill-color);
}

.app.dark-theme :deep(.el-empty__description) {
  color: var(--el-text-color-secondary);
}

.app.dark-theme :deep(.el-message-box) {
  background-color: var(--el-bg-color-overlay);
  border-color: var(--el-border-color);
}
</style>
