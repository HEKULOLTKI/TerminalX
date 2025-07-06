export class SerialService {
  constructor() {
    this.connections = new Map()
    this.listeners = new Map() // 用于存储事件监听器
    this.setupEventListeners()
  }

  setupEventListeners() {
    // 监听串口事件并分发到具体的连接
    window.api.serial.onData((event, connectionId, data) => {
      this.emit(connectionId, 'data', data)
    })

    window.api.serial.onReady((event, connectionId) => {
      this.emit(connectionId, 'ready')
    })

    window.api.serial.onError((event, connectionId, error) => {
      this.emit(connectionId, 'error', new Error(error))
    })

    window.api.serial.onClose((event, connectionId) => {
      this.emit(connectionId, 'close')
      this.connections.delete(connectionId)
      this.listeners.delete(connectionId) // 清理监听器
    })
  }

  // 订阅事件
  on(connectionId, event, callback) {
    if (!this.listeners.has(connectionId)) {
      this.listeners.set(connectionId, new Map())
    }
    if (!this.listeners.get(connectionId).has(event)) {
      this.listeners.get(connectionId).set(event, [])
    }
    this.listeners.get(connectionId).get(event).push(callback)
  }

  // 取消订阅事件
  off(connectionId, event, callback) {
    if (!this.listeners.has(connectionId) || !this.listeners.get(connectionId).has(event)) {
      return
    }
    const listeners = this.listeners.get(connectionId).get(event)
    const index = listeners.indexOf(callback)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }

  // 触发事件
  emit(connectionId, event, ...args) {
    if (this.listeners.has(connectionId) && this.listeners.get(connectionId).has(event)) {
      this.listeners
        .get(connectionId)
        .get(event)
        .forEach((callback) => callback(...args))
    }
  }

  // 获取可用串口列表
  async listPorts() {
    try {
      const result = await window.api.serial.listPorts()
      if (result.success) {
        return result.ports
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('获取串口列表失败:', error)
      throw error
    }
  }

  // 测试串口连接
  async testConnection(config) {
    try {
      const result = await window.api.serial.testConnection(config)
      if (result.success) {
        return result.message
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('测试串口连接失败:', error)
      throw error
    }
  }

  // 创建串口连接
  async connect(config) {
    try {
      const result = await window.api.serial.connect(config)

      if (result.success) {
        const connectionId = result.connectionId

        // 保存连接信息
        this.connections.set(connectionId, {
          config
        })

        return {
          connectionId,
          connection: null, // 在渲染进程中不需要实际的连接对象
          port: null
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('创建串口连接失败:', error)
      throw error
    }
  }

  // 向串口写入数据
  async write(connectionId, data, encoding = 'utf8') {
    try {
      const result = await window.api.serial.write(connectionId, data, encoding)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.success
    } catch (error) {
      console.error('写入串口数据失败:', error)
      throw error
    }
  }

  // 关闭串口连接
  async disconnect(connectionId) {
    try {
      const result = await window.api.serial.disconnect(connectionId)
      this.connections.delete(connectionId)
      this.listeners.delete(connectionId)
      return result.success
    } catch (error) {
      console.error('断开串口连接失败:', error)
      return false
    }
  }

  // 获取连接信息
  getConnection(connectionId) {
    return this.connections.get(connectionId)
  }

  // 清理所有连接
  cleanup() {
    for (const [connectionId] of this.connections) {
      this.disconnect(connectionId)
    }
    this.connections.clear()
    this.listeners.clear()
  }
}

// 导出单例实例
export const serialService = new SerialService() 