<template>
  <div class="title-bar">
    <!-- 拖拽区域 -->
    <div class="title-bar-drag-region">
      <!-- 应用图标和标题 -->
      <div class="title-bar-left">
        <div class="app-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <span class="app-title">TerminalX</span>
      </div>
      
      <!-- 中间标题区域 -->
      <div class="title-bar-center">
        <!-- 终端标题部分 -->
        <div class="title-section terminal-title">
          <div class="title-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17l-4-4 4-4v2h6v4H9v2z"/>
            </svg>
          </div>
          <span class="title-text">{{ terminalTitle }}</span>
        </div>
        
        <!-- 分隔线 -->
        <div class="title-separator"></div>
        
        <!-- AI助手标题部分 -->
        <div class="title-section ai-title">
          <div class="title-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <span class="title-text">{{ aiTitle }}</span>
        </div>
      </div>
      
      <!-- 右侧窗口控制按钮 -->
      <div class="title-bar-controls">
        <button 
          class="control-btn minimize-btn" 
          @click="minimizeWindow"
          title="最小化"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect width="10" height="1" x="1" y="6" fill="currentColor"/>
          </svg>
        </button>
        
        <button 
          class="control-btn maximize-btn" 
          @click="toggleMaximize"
          :title="isMaximized ? '还原' : '最大化'"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" v-if="!isMaximized">
            <rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
          <svg width="12" height="12" viewBox="0 0 12 12" v-else>
            <rect width="7" height="7" x="3" y="1" fill="none" stroke="currentColor" stroke-width="1"/>
            <rect width="7" height="7" x="1" y="3" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
        </button>
        
        <button 
          class="control-btn close-btn" 
          @click="closeWindow"
          title="关闭"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path stroke="currentColor" stroke-width="1" d="M1 1 L11 11 M11 1 L1 11"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useTerminalStore } from '../stores/terminal'

const terminalStore = useTerminalStore()
const isMaximized = ref(false)

// 计算终端标题
const terminalTitle = computed(() => {
  const activeTab = terminalStore.getActiveTab()
  if (activeTab) {
    return activeTab.title
  }
  return '终端'
})

// AI助手标题
const aiTitle = computed(() => {
  return 'AI助手'
})

// 窗口控制方法
const minimizeWindow = () => {
  window.electronAPI.minimizeWindow()
}

const toggleMaximize = () => {
  if (isMaximized.value) {
    window.electronAPI.unmaximizeWindow()
  } else {
    window.electronAPI.maximizeWindow()
  }
}

const closeWindow = () => {
  window.electronAPI.closeWindow()
}

// 监听窗口状态变化
const handleWindowStateChange = (event, state) => {
  isMaximized.value = state.isMaximized
}

onMounted(() => {
  // 获取初始窗口状态
  window.electronAPI.getWindowState().then(state => {
    isMaximized.value = state.isMaximized
  })
  
  // 监听窗口状态变化
  window.electronAPI.onWindowStateChange(handleWindowStateChange)
})

onUnmounted(() => {
  window.electronAPI.removeWindowStateListener(handleWindowStateChange)
})
</script>

<style scoped>
.title-bar {
  height: 32px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);
  user-select: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
}

.title-bar-drag-region {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: drag;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  flex-shrink: 0;
}

.app-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--el-color-primary);
}

.app-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.title-bar-center {
  display: flex;
  align-items: center;
  flex: 1;
  padding: 0 16px;
  gap: 12px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.terminal-title .title-icon {
  color: var(--el-color-primary);
}

.ai-title .title-icon {
  color: var(--el-color-success);
}

.title-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.title-separator {
  width: 1px;
  height: 18px;
  background: var(--el-border-color);
  flex-shrink: 0;
}

.title-bar-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  pointer-events: auto;
  position: relative;
  z-index: 1;
}

.control-btn:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.control-btn:active {
  background: var(--el-fill-color-dark);
}

.close-btn:hover {
  background: #e81123;
  color: #ffffff;
}

.close-btn:active {
  background: #c50e1f;
  color: #ffffff;
}

/* Windows样式的控制按钮 */
@media (max-width: 768px) {
  .title-bar-controls {
    gap: 1px;
  }
  
  .control-btn {
    width: 40px;
  }
  
  .title-bar-center {
    padding: 0 8px;
    gap: 8px;
  }
  
  .title-text {
    font-size: 11px;
  }
}
</style> 