import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { serialService } from '../services/serial'

export const useTerminalStore = defineStore('terminal', () => {
  // 当前活跃的标签页
  const activeTabId = ref('')
  
  // 所有标签页
  const tabs = ref([])
  
  // SSH连接配置
  const connections = ref([])
  
  // 串口连接配置
  const serialConnections = ref([])
  
  // 当前主题
  const currentTheme = ref('fresh')
  
  // 侧边栏显示状态
  const showSidebar = ref(false)
  const sidebarMode = ref('terminal') // 'terminal' 或 'config'
  
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
    fresh: {
      // 终端区域保持黑色，但界面使用蓝白配色
      background: '#1e1e1e',  // 终端背景保持黑色
      foreground: '#ffffff',
      cursor: '#ffffff',
      selection: '#264f78',
      black: '#000000',
      red: '#e74c3c',
      green: '#27ae60',
      yellow: '#f39c12',
      blue: '#3498db',
      magenta: '#9b59b6',
      cyan: '#1abc9c',
      white: '#ecf0f1',
      brightBlack: '#7f8c8d',
      brightRed: '#e74c3c',
      brightGreen: '#2ecc71',
      brightYellow: '#f1c40f',
      brightBlue: '#3498db',
      brightMagenta: '#8e44ad',
      brightCyan: '#16a085',
      brightWhite: '#ffffff'
    }
  })

  // 创建新标签页
  const createTab = (connection) => {
    // 要求必须传入 connection 对象
    if (!connection) {
      console.error('创建标签页时必须提供连接信息')
      return null
    }

    const id = uuidv4()
    const tab = {
      id,
      title: `${connection.username}@${connection.host}`, // 直接使用连接信息
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
    const index = tabs.value.findIndex((tab) => tab.id === tabId)
    if (index !== -1) {
      const tab = tabs.value[index]
      // 断开SSH连接
      if (tab.ssh) {
        tab.ssh.end()
      }
      // 断开串口连接
      if (tab.connection && tab.connection.type === 'serial' && tab.connectionId) {
        serialService.disconnect(tab.connectionId)
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

  // 创建串口标签页
  const createSerialTab = async (connection) => {
    const id = uuidv4()
    const tab = {
      id,
      title: connection ? `${connection.name} (${connection.port})` : '串口终端',
      connection: {
        ...connection,
        type: 'serial'
      },
      isConnected: false,
      terminal: null,
      connectionId: null
    }

    tabs.value.push(tab)
    activeTabId.value = id

    try {
      const connectionConfig = JSON.parse(JSON.stringify(connection))
      // connect 成功时返回 { connectionId, ... }, 失败时抛出错误
      const result = await serialService.connect(connectionConfig)

      const { connectionId } = result
      const tabInStore = tabs.value.find(t => t.id === id)
      if (tabInStore) {
        tabInStore.connectionId = connectionId
      }

      serialService.on(connectionId, 'ready', () => {
        const currentTab = tabs.value.find(t => t.id === id)
        if (currentTab) {
          currentTab.isConnected = true
          if (currentTab.terminal) {
            currentTab.terminal.writeln('\r\n\x1b[32m连接成功!\x1b[0m')
          }
        }
      })
      
      serialService.on(connectionId, 'data', (data) => {
        const currentTab = tabs.value.find(t => t.id === id)
        if (currentTab && currentTab.terminal) {
          currentTab.terminal.write(data)
        }
      })
      
      serialService.on(connectionId, 'close', () => {
        const currentTab = tabs.value.find(t => t.id === id)
        if (currentTab) {
          currentTab.isConnected = false
          if (currentTab.terminal) {
            currentTab.terminal.writeln('\r\n\x1b[31m连接已断开\x1b[0m')
          }
        }
      })

      serialService.on(connectionId, 'error', (error) => {
        const currentTab = tabs.value.find(t => t.id === id)
        if (currentTab) {
          currentTab.isConnected = false
          if (currentTab.terminal) {
            currentTab.terminal.writeln(`\r\n\x1b[31m连接错误: ${error}\x1b[0m`)
          }
        }
      })
    } catch (error) {
      console.error('Failed to connect to serial port:', error)
      const tabInStore = tabs.value.find(t => t.id === id)
      if (tabInStore) {
        tabInStore.isConnected = false
        // 延迟执行，确保terminal实例已创建
        setTimeout(() => {
          if (tabInStore.terminal) {
            tabInStore.terminal.writeln(`\r\n\x1b[31m连接失败: ${error.message}\x1b[0m`)
          }
        }, 100)
      }
    }

    return tab
  }

  // 添加串口连接配置
  const addSerialConnection = (config) => {
    const connection = {
      id: uuidv4(),
      ...config,
      type: 'serial',
      createdAt: new Date()
    }
    serialConnections.value.push(connection)
    return connection
  }

  const updateSerialConnection = (config) => {
    const index = serialConnections.value.findIndex(c => c.id === config.id)
    if (index !== -1) {
      serialConnections.value[index] = config
    }
  }

  // 删除串口连接配置
  const removeSerialConnection = (connectionId) => {
    const index = serialConnections.value.findIndex(conn => conn.id === connectionId)
    if (index !== -1) {
      serialConnections.value.splice(index, 1)
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

  // 更新标签页信息
  const updateTab = (tabToUpdate) => {
    const index = tabs.value.findIndex((tab) => tab.id === tabToUpdate.id)
    if (index !== -1) {
      tabs.value[index] = { ...tabs.value[index], ...tabToUpdate }
    }
  }

  // 获取当前主题配置
  const getCurrentTheme = () => {
    return themes[currentTheme.value]
  }

  // 侧边栏控制方法
  const toggleSidebar = () => {
    showSidebar.value = !showSidebar.value
  }

  const setSidebarMode = (mode) => {
    sidebarMode.value = mode
    if (!showSidebar.value) {
      showSidebar.value = true
    }
  }

  const hideSidebar = () => {
    showSidebar.value = false
  }

  return {
    activeTabId,
    tabs,
    connections,
    serialConnections,
    currentTheme,
    themes,
    showSidebar,
    sidebarMode,
    createTab,
    createSerialTab,
    closeTab,
    switchTab,
    addConnection,
    removeConnection,
    addSerialConnection,
    removeSerialConnection,
    updateSerialConnection,
    setTheme,
    getActiveTab,
    getCurrentTheme,
    toggleSidebar,
    setSidebarMode,
    hideSidebar,
    updateTab
  }
}) 