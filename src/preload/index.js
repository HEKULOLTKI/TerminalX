import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  ssh: {
    testConnection: (config) => ipcRenderer.invoke('ssh:test-connection', config),
    connect: (config) => ipcRenderer.invoke('ssh:connect', config),
    write: (connectionId, data) => ipcRenderer.invoke('ssh:write', connectionId, data),
    resize: (connectionId, cols, rows) => ipcRenderer.invoke('ssh:resize', connectionId, cols, rows),
    disconnect: (connectionId) => ipcRenderer.invoke('ssh:disconnect', connectionId),
    
    // 监听SSH事件
    onData: (callback) => ipcRenderer.on('ssh:data', callback),
    onReady: (callback) => ipcRenderer.on('ssh:ready', callback),
    onError: (callback) => ipcRenderer.on('ssh:error', callback),
    onClose: (callback) => ipcRenderer.on('ssh:close', callback),
    
    // 移除监听器
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  }
}

// 窗口控制API
const windowAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  unmaximizeWindow: () => ipcRenderer.invoke('window-unmaximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  getWindowState: () => ipcRenderer.invoke('window-get-state'),
  
  // 监听窗口状态变化
  onWindowStateChange: (callback) => ipcRenderer.on('window-state-changed', callback),
  removeWindowStateListener: (callback) => ipcRenderer.removeListener('window-state-changed', callback)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electronAPI', windowAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
  window.electronAPI = windowAPI
}
