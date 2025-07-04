<template>
  <div class="app" :class="[terminalStore.currentTheme + '-theme', terminalStore.currentTheme]">
    <!-- 自定义标题栏 -->
    <TitleBar />
    
    <!-- 主应用内容 -->
    <div class="app-content" :class="{ 'resizing': isResizing }">
      <!-- 左侧终端区域 -->
      <div class="terminal-section" :style="{ width: terminalWidth }">
        <!-- 顶部控制栏 - 只在终端区域显示 -->
        <div class="top-controls">
          <div class="control-tabs">
            <!-- 滑动指示器 -->
            <div 
              class="tab-indicator" 
              :class="{ 'move-right': terminalStore.sidebarMode === 'config' }"
            ></div>
            
            <button 
              :class="['control-tab', { active: terminalStore.sidebarMode === 'terminal' }]"
              @click="switchToTerminal"
            >
              <el-icon><Monitor /></el-icon>
              <span>终端</span>
            </button>
            <button 
              :class="['control-tab', { active: terminalStore.sidebarMode === 'config' }]"
              @click="switchToConfig"
            >
              <el-icon><Setting /></el-icon>
              <span>配置</span>
            </button>
          </div>
        </div>
        
        <!-- 侧边栏 - 只在配置模式下显示 -->
        <Sidebar 
          v-show="terminalStore.sidebarMode === 'config'" 
          class="app-sidebar" 
          :mode="terminalStore.sidebarMode"
        />
        
        <!-- 终端主内容 - 只在终端模式下显示 -->
        <div 
          class="terminal-main" 
          v-show="terminalStore.sidebarMode === 'terminal'"
        >
          <TabManager />
        </div>
      </div>
      
      <!-- 分隔条 -->
      <div 
        class="resize-handle" 
        @mousedown="startResize"
        v-show="!isChatCollapsed"
        :class="{ 'resizing': isResizing }"
      >
        <div class="resize-handle-indicator"></div>
      </div>
      
      <!-- 右侧AI聊天区域 -->
      <div class="ai-section" :class="{ 'collapsed': isChatCollapsed }" :style="{ width: aiWidth }">
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
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, reactive, computed } from 'vue'
import { useTerminalStore } from './stores/terminal'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import TabManager from './components/TabManager.vue'
import AIChat from './components/AIChat.vue'
import { Monitor, Setting } from '@element-plus/icons-vue'
import './assets/layout.css'

const terminalStore = useTerminalStore()
const isChatCollapsed = ref(false)
const isResizing = ref(false)

// 布局尺寸
const layout = reactive({
  terminalWidth: 60, // 百分比
  aiWidth: 40,       // 百分比
  minTerminalWidth: 25,
  maxTerminalWidth: 80,
  minAiWidth: 20
})

// 计算样式
const terminalWidth = computed(() => {
  if (isChatCollapsed.value) return '100%'
  return `${layout.terminalWidth}%`
})

const aiWidth = computed(() => {
  if (isChatCollapsed.value) return '50px'
  return `${layout.aiWidth}%`
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

  // 添加键盘快捷键支持
  const handleKeyDown = (e) => {
    // Ctrl+1 切换到终端模式
    if (e.ctrlKey && e.key === '1') {
      e.preventDefault()
      terminalStore.setSidebarMode('terminal')
    }
    // Ctrl+2 切换到配置模式
    else if (e.ctrlKey && e.key === '2') {
      e.preventDefault()
      terminalStore.setSidebarMode('config')
    }
    // Ctrl+B 切换AI助手
    else if (e.ctrlKey && e.key === 'b') {
      e.preventDefault()
      toggleChat()
    }
  }

  document.addEventListener('keydown', handleKeyDown)

  // 在组件卸载时清理事件监听器
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })
})

// 切换聊天面板
const toggleChat = () => {
  isChatCollapsed.value = !isChatCollapsed.value
  localStorage.setItem('terminalx-chat-collapsed', JSON.stringify(isChatCollapsed.value))
}

// 添加波纹效果
const addRippleEffect = (element) => {
  element.classList.add('ripple')
  setTimeout(() => {
    element.classList.remove('ripple')
  }, 600)
}

// 切换到终端模式
const switchToTerminal = (event) => {
  addRippleEffect(event.currentTarget)
  terminalStore.setSidebarMode('terminal')
}

// 切换到配置模式
const switchToConfig = (event) => {
  addRippleEffect(event.currentTarget)
  terminalStore.setSidebarMode('config')
}



// 保存布局设置
const saveLayoutSettings = () => {
  localStorage.setItem('terminalx-layout', JSON.stringify({
    terminalWidth: layout.terminalWidth,
    aiWidth: layout.aiWidth
  }))
}

// 开始调整大小
const startResize = (e) => {
  if (isChatCollapsed.value) return
  
  isResizing.value = true
  const startX = e.clientX
  const startTerminalWidth = layout.terminalWidth
  
  // 添加全局样式防止选择文本
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  
  const handleMouseMove = (e) => {
    if (!isResizing.value) return
    
    const containerWidth = window.innerWidth
    const currentX = e.clientX
    const deltaX = currentX - startX
    const deltaPercent = (deltaX / containerWidth) * 100
    
    let newTerminalWidth = startTerminalWidth + deltaPercent
    
    // 应用限制
    newTerminalWidth = Math.max(layout.minTerminalWidth, newTerminalWidth)
    newTerminalWidth = Math.min(layout.maxTerminalWidth, newTerminalWidth)
    
    // 确保AI区域也有最小宽度
    const newAiWidth = 100 - newTerminalWidth
    if (newAiWidth < layout.minAiWidth) {
      newTerminalWidth = 100 - layout.minAiWidth
    }
    
    layout.terminalWidth = newTerminalWidth
    layout.aiWidth = 100 - newTerminalWidth
  }
  
  const handleMouseUp = () => {
    isResizing.value = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    
    // 保存布局设置
    saveLayoutSettings()
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  
  e.preventDefault()
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

/* 清心主题变量 - 蓝白配色 */
.fresh {
  --el-bg-color: #f8fbff;
  --el-bg-color-page: #ffffff;
  --el-bg-color-overlay: #f0f7ff;
  --el-text-color-primary: #2c3e50;
  --el-text-color-regular: #34495e;
  --el-text-color-secondary: #7f8c8d;
  --el-text-color-placeholder: #95a5a6;
  --el-border-color: #d6e9ff;
  --el-border-color-light: #e3f2fd;
  --el-border-color-lighter: #ecf5ff;
  --el-border-color-extra-light: #f5faff;
  --el-border-color-dark: #b3d9ff;
  --el-border-color-darker: #90caf9;
  --el-fill-color: #f0f7ff;
  --el-fill-color-light: #f8fbff;
  --el-fill-color-lighter: #fafcff;
  --el-fill-color-extra-light: #fcfdff;
  --el-fill-color-dark: #e3f2fd;
  --el-fill-color-darker: #d1e9ff;
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

/* 顶部控制栏 */
.top-controls {
  display: flex;
  align-items: center;
  padding: 4px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);
  min-height: 48px;
  position: relative;
  z-index: 1;
  animation: slideInFromTop 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 控制栏进入动画 */
@keyframes slideInFromTop {
  0% {
    transform: translateY(-20px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.control-tabs {
  display: flex;
  width: 100%;
  gap: 0;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  padding: 4px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

/* 滑动指示器 */
.tab-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 2px);
  height: calc(100% - 8px);
  background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
  border-radius: 6px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.25);
  z-index: 1;
  opacity: 0.9;
}

.tab-indicator::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
  border-radius: 6px;
  opacity: 0.8;
}

.tab-indicator.move-right {
  transform: translateX(100%);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

/* 滑动指示器动画增强 */
@keyframes pulse {
  0% {
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.25);
  }
  50% {
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.4);
  }
  100% {
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.25);
  }
}

.tab-indicator:hover {
  animation: pulse 2s ease-in-out infinite;
}

/* 滑动指示器边缘光效 */
.tab-indicator::after {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%, rgba(255, 255, 255, 0.1) 100%);
  border-radius: 7px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.control-tabs:hover .tab-indicator::after {
  opacity: 1;
}

/* 控制栏背景动画 */
.control-tabs::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
  border-radius: 8px;
}

.control-tabs:hover::before {
  left: 100%;
}

/* 控制栏悬浮时的阴影动画 */
.control-tabs:hover {
  transform: translateY(-1px);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 过渡效果优化 */
.control-tabs {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, box-shadow;
}

/* 硬件加速优化 */
.tab-indicator,
.control-tab,
.control-tab::before,
.control-tab::after {
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

/* 减少动画时的重绘 */
.control-tab:hover,
.control-tab.active,
.tab-indicator {
  contain: layout style paint;
}

.control-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--el-text-color-regular);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  position: relative;
  z-index: 2;
  overflow: hidden;
}

/* 按钮波纹效果 */
.control-tab::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
  pointer-events: none;
}

.control-tab:hover {
  color: var(--el-text-color-primary);
  transform: translateY(-1px);
}

.control-tab:hover::before {
  width: 100px;
  height: 100px;
  opacity: 0.6;
}

.control-tab.active {
  color: #ffffff;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.control-tab.active::before {
  width: 120px;
  height: 120px;
  opacity: 0.8;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
}

.control-tab .el-icon {
  font-size: 16px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.control-tab:hover .el-icon {
  transform: scale(1.1) rotate(3deg);
}

.control-tab.active .el-icon {
  transform: scale(1.15) rotate(0deg);
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
}

/* 图标特定的动画效果 */
.control-tab:hover .el-icon svg {
  animation: iconPulse 0.6s ease-in-out;
}

@keyframes iconPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

/* 焦点状态 */
.control-tab:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.control-tab.active:focus {
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3), 0 0 0 2px rgba(64, 158, 255, 0.4);
}

/* 按钮点击时的反馈 */
.control-tab:active {
  transform: translateY(0px) scale(0.98);
  transition: transform 0.1s ease;
}

.control-tab.active:active {
  transform: translateY(0px) scale(0.98);
}

/* 按钮点击波纹效果 */
@keyframes ripple {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0.8;
  }
  50% {
    opacity: 0.4;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
  }
}

.control-tab.ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: ripple 0.6s ease-out;
  pointer-events: none;
  z-index: 1;
}

/* 无障碍支持 */
.control-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.control-tab:disabled:hover {
  transform: none;
  box-shadow: none;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .control-tab {
    padding: 8px 12px;
    font-size: 12px;
    gap: 6px;
  }
  
  .control-tab .el-icon {
    font-size: 14px;
  }
  
  .control-tab span {
    display: none;
  }
  
  .top-controls {
    min-height: 40px;
  }
  
  .tab-indicator {
    height: calc(100% - 6px);
    top: 3px;
  }
}

@media (max-width: 480px) {
  .control-tab {
    padding: 6px 8px;
  }
  
  .control-tab .el-icon {
    font-size: 16px;
  }
  
  .control-tabs {
    padding: 3px;
  }
  
  .control-tab:hover .el-icon {
    transform: scale(1.2);
  }
  
  .control-tab.active .el-icon {
    transform: scale(1.3);
  }
}



.app-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.app-content.resizing {
  cursor: col-resize;
  user-select: none;
}

.app-content.resizing * {
  user-select: none;
  pointer-events: none;
}

/* 左侧终端区域 */
.terminal-section {
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  transition: width 0.2s ease;
  overflow: hidden;
  min-width: 200px;
  margin-top: 32px; /* 为固定的标题栏留出空间 */
}

.app-sidebar {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%; /* 配置模式下侧边栏占据全部左侧空间 */
  transition: transform 0.3s ease;
  overflow: hidden;
  min-height: 0; /* 确保能够收缩 */
}

.terminal-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%; /* 终端模式下占据全部左侧空间 */
  min-height: 0; /* 确保能够收缩 */
}

/* 分隔条样式 */
.resize-handle {
  width: 6px;
  background: transparent;
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resize-handle:hover {
  background: var(--el-color-primary-light-8);
}

.resize-handle.resizing {
  background: var(--el-color-primary-light-6);
}

.resize-handle-indicator {
  width: 2px;
  height: 40px;
  background: var(--el-border-color);
  border-radius: 1px;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.resize-handle:hover .resize-handle-indicator {
  background: var(--el-color-primary);
  height: 60px;
  opacity: 1;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.3);
}

.resize-handle.resizing .resize-handle-indicator {
  background: var(--el-color-primary);
  height: 100%;
  opacity: 1;
  box-shadow: 0 0 12px rgba(64, 158, 255, 0.5);
}

/* 右侧AI聊天区域 */
.ai-section {
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
  transition: width 0.2s ease;
  overflow: hidden;
  position: relative;
  border-left: 1px solid var(--el-border-color);
  margin-top: 32px; /* 为固定的标题栏留出空间 */
}

.ai-section.collapsed {
  min-width: 50px !important;
  width: 50px !important;
  border-left: none;
}

/* AI聊天头部 */
.ai-header {
  padding: 8px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color-page);
  flex-shrink: 0;
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

/* 深色主题样式 */
.app.dark-theme {
  background-color: var(--el-bg-color);
}

.app.dark-theme .control-tabs {
  background: linear-gradient(135deg, #2d2d30 0%, #3c3c3c 100%);
  border: 1px solid #4a4a4a;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

.app.dark-theme .tab-indicator {
  background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.4);
}

.app.dark-theme .tab-indicator.move-right {
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.5);
}

.app.dark-theme .tab-indicator::before {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
}

/* 深色主题的脉冲动画 */
@keyframes pulse-dark {
  0% {
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.4);
  }
  50% {
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.6);
  }
  100% {
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.4);
  }
}

.app.dark-theme .tab-indicator:hover {
  animation: pulse-dark 2s ease-in-out infinite;
}

.app.dark-theme .control-tab {
  color: var(--el-text-color-regular);
}

.app.dark-theme .control-tab::before {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
}

.app.dark-theme .control-tab:hover {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(64, 158, 255, 0.05) 100%);
  color: var(--el-text-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.app.dark-theme .control-tab.active {
  background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
}

.app.dark-theme .control-tab.active::before {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
}

.app.dark-theme .control-tab:focus {
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.4);
}

.app.dark-theme .control-tab.active:focus {
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4), 0 0 0 2px rgba(64, 158, 255, 0.6);
}



/* 清心主题样式 */
.app.fresh-theme {
  background-color: var(--el-bg-color);
}

.app.fresh-theme .ai-section {
  background: linear-gradient(135deg, #f8fbff 0%, #e3f2fd 100%);
  box-shadow: -2px 0 10px rgba(66, 133, 244, 0.1);
}

.app.fresh-theme .toggle-chat-btn {
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%);
  border-color: #d6e9ff;
  color: #2c3e50;
  box-shadow: 0 2px 4px rgba(66, 133, 244, 0.1);
}

.app.fresh-theme .toggle-chat-btn:hover {
  background: linear-gradient(135deg, #f0f7ff 0%, #e3f2fd 100%);
  border-color: #4285f4;
  color: #1565c0;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(66, 133, 244, 0.15);
}

/* 清心主题下的分隔条 */
.app.fresh-theme .resize-handle:hover {
  background: linear-gradient(135deg, rgba(66, 133, 244, 0.1) 0%, rgba(25, 118, 210, 0.1) 100%);
}

.app.fresh-theme .resize-handle-indicator {
  background: #d6e9ff;
}

.app.fresh-theme .resize-handle:hover .resize-handle-indicator {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  box-shadow: 0 0 12px rgba(66, 133, 244, 0.4);
}

.app.fresh-theme .resize-handle.resizing .resize-handle-indicator {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  box-shadow: 0 0 16px rgba(66, 133, 244, 0.6);
}



/* 深色主题下的分隔条 */
.app.dark-theme .resize-handle:hover {
  background: rgba(64, 158, 255, 0.2);
}

.app.dark-theme .resize-handle-indicator {
  background: var(--el-border-color-dark);
}

.app.dark-theme .resize-handle:hover .resize-handle-indicator {
  background: var(--el-color-primary);
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
}

.app.dark-theme .resize-handle.resizing .resize-handle-indicator {
  background: var(--el-color-primary);
  box-shadow: 0 0 12px rgba(64, 158, 255, 0.6);
}



/* 确保终端背景色正确 */
.app :deep(.terminal-container) {
  --terminal-bg: var(--el-bg-color);
}

.app.dark-theme :deep(.terminal-container) {
  --terminal-bg: #1e1e1e;
}

.app.fresh-theme :deep(.terminal-container) {
  --terminal-bg: #1e1e1e;  /* 终端区域保持黑色 */
}

/* 清心主题下的顶部控制栏 */
.app.fresh-theme .top-controls {
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%);
  border-bottom: 1px solid #d6e9ff;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.06);
}

.app.fresh-theme .control-tabs {
  background: linear-gradient(135deg, #f8fbff 0%, #e8f4ff 100%);
  border: 1px solid #d6e9ff;
  box-shadow: inset 0 1px 3px rgba(66, 133, 244, 0.1);
}

.app.fresh-theme .tab-indicator {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
}

.app.fresh-theme .tab-indicator.move-right {
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.4);
}

.app.fresh-theme .tab-indicator::before {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%);
}

/* 清心主题的脉冲动画 */
@keyframes pulse-fresh {
  0% {
    box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
  }
  50% {
    box-shadow: 0 4px 16px rgba(66, 133, 244, 0.5);
  }
  100% {
    box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
  }
}

.app.fresh-theme .tab-indicator:hover {
  animation: pulse-fresh 2s ease-in-out infinite;
}

.app.fresh-theme .control-tab {
  color: #5f6368;
}

.app.fresh-theme .control-tab::before {
  background: linear-gradient(135deg, rgba(66, 133, 244, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%);
}

.app.fresh-theme .control-tab:hover {
  background: linear-gradient(135deg, rgba(66, 133, 244, 0.08) 0%, rgba(25, 118, 210, 0.05) 100%);
  color: #1565c0;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.15);
}

.app.fresh-theme .control-tab.active {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.35);
}

.app.fresh-theme .control-tab.active::before {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.1) 100%);
}

.app.fresh-theme .control-tab:focus {
  box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3);
}

.app.fresh-theme .control-tab.active:focus {
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.35), 0 0 0 2px rgba(66, 133, 244, 0.5);
}

.app.fresh-theme .toggle-sidebar-btn {
  background: rgba(255, 255, 255, 0.9);
  border-color: #d6e9ff;
  color: #4285f4;
  backdrop-filter: blur(5px);
}

.app.fresh-theme .toggle-sidebar-btn:hover {
  background: rgba(66, 133, 244, 0.1);
  border-color: #4285f4;
  color: #1565c0;
  transform: scale(1.05);
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
