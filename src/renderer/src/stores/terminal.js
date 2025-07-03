import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { v4 as uuidv4 } from 'uuid'

export const useTerminalStore = defineStore('terminal', () => {
  // 当前活跃的标签页
  const activeTabId = ref('')
  
  // 所有标签页
  const tabs = ref([])
  
  // SSH连接配置
  const connections = ref([])
  
  // 当前主题
  const currentTheme = ref('dark')
  
  // 主题配置
  const themes = reactive({
    dark: {
      background: '#1e1e1e',
      foreground: '#ffffff',
      cursor: '#ffffff',
      selection: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff'
    },
    light: {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      selection: '#c1dbfc',
      black: '#000000',
      red: '#cd3131',
      green: '#00bc00',
      yellow: '#949800',
      blue: '#0451a5',
      magenta: '#bc05bc',
      cyan: '#0598bc',
      white: '#555555',
      brightBlack: '#666666',
      brightRed: '#cd3131',
      brightGreen: '#14ce14',
      brightYellow: '#b5ba00',
      brightBlue: '#0451a5',
      brightMagenta: '#bc05bc',
      brightCyan: '#0598bc',
      brightWhite: '#a5a5a5'
    }
  })

  // 创建新标签页
  const createTab = (connection) => {
    const id = uuidv4()
    const tab = {
      id,
      title: connection ? `${connection.username}@${connection.host}` : '本地终端',
      connection,
      isConnected: false,
      terminal: null,
      ssh: null
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  // 关闭标签页
  const closeTab = (tabId) => {
    const index = tabs.value.findIndex(tab => tab.id === tabId)
    if (index !== -1) {
      const tab = tabs.value[index]
      // 断开SSH连接
      if (tab.ssh) {
        tab.ssh.end()
      }
      // 销毁终端实例
      if (tab.terminal) {
        tab.terminal.dispose()
      }
      tabs.value.splice(index, 1)
      
      // 如果关闭的是当前活跃标签，切换到其他标签
      if (activeTabId.value === tabId) {
        if (tabs.value.length > 0) {
          activeTabId.value = tabs.value[Math.max(0, index - 1)].id
        } else {
          activeTabId.value = ''
        }
      }
    }
  }

  // 切换标签页
  const switchTab = (tabId) => {
    activeTabId.value = tabId
  }

  // 添加SSH连接配置
  const addConnection = (config) => {
    const connection = {
      id: uuidv4(),
      ...config,
      createdAt: new Date()
    }
    connections.value.push(connection)
    return connection
  }

  // 删除连接配置
  const removeConnection = (connectionId) => {
    const index = connections.value.findIndex(conn => conn.id === connectionId)
    if (index !== -1) {
      connections.value.splice(index, 1)
    }
  }

  // 切换主题
  const setTheme = (theme) => {
    currentTheme.value = theme
  }

  // 获取当前活跃标签
  const getActiveTab = () => {
    return tabs.value.find(tab => tab.id === activeTabId.value)
  }

  // 获取当前主题配置
  const getCurrentTheme = () => {
    return themes[currentTheme.value]
  }

  return {
    activeTabId,
    tabs,
    connections,
    currentTheme,
    themes,
    createTab,
    closeTab,
    switchTab,
    addConnection,
    removeConnection,
    setTheme,
    getActiveTab,
    getCurrentTheme
  }
}) 