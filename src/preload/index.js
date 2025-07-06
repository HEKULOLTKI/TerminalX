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
    startTunnel: (connectionId, tunnelConfig) => ipcRenderer.invoke('ssh:start-tunnel', connectionId, tunnelConfig),
    stopTunnel: (tunnelId) => ipcRenderer.invoke('ssh:stop-tunnel', tunnelId),
    
    // 监听SSH事件
    onData: (callback) => ipcRenderer.on('ssh:data', callback),
    onReady: (callback) => ipcRenderer.on('ssh:ready', callback),
    onError: (callback) => ipcRenderer.on('ssh:error', callback),
    onClose: (callback) => ipcRenderer.on('ssh:close', callback),
    
    // 移除监听器
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  },
  serial: {
    // 获取可用串口列表
    listPorts: () => ipcRenderer.invoke('serial:list-ports'),
    
    // 测试串口连接
    testConnection: (config) => ipcRenderer.invoke('serial:test-connection', config),
    
    // 连接到串口
    connect: (config) => ipcRenderer.invoke('serial:connect', config),
    
    // 向串口写入数据
    write: (connectionId, data, encoding) => ipcRenderer.invoke('serial:write', connectionId, data, encoding),
    
    // 断开串口连接
    disconnect: (connectionId) => ipcRenderer.invoke('serial:disconnect', connectionId),
    
    // 监听串口事件
    onData: (callback) => ipcRenderer.on('serial:data', callback),
    onRawData: (callback) => ipcRenderer.on('serial:raw-data', callback),
    onReady: (callback) => ipcRenderer.on('serial:ready', callback),
    onError: (callback) => ipcRenderer.on('serial:error', callback),
    onClose: (callback) => ipcRenderer.on('serial:close', callback),
    
    // 移除监听器
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    setControlLines: (connectionId, options) => ipcRenderer.invoke('serial:set-control-lines', connectionId, options)
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
