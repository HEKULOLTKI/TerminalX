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
      
      <!-- 中间空白区域（可拖拽） -->
      <div class="title-bar-center"></div>
      
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
import { ref, onMounted, onUnmounted } from 'vue'

const isMaximized = ref(false)

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
  position: relative;
  z-index: 9999;
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
  flex: 1;
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
}

/* 深色主题适配 */
.dark .title-bar {
  background: #2d2d30;
  border-bottom-color: #3c3c3c;
}

.dark .control-btn:hover {
  background: #3e3e42;
}

.dark .control-btn:active {
  background: #4a4a4f;
}
</style> 