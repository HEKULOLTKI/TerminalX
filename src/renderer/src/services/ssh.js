// SSH服务 - 渲染进程版本
// 通过IPC与主进程中的SSH服务通信

export class SSHService {
  constructor() {
    this.connections = new Map()
    this.setupEventListeners()
  }

  setupEventListeners() {
    // 监听SSH数据
    window.api.ssh.onData((event, connectionId, data) => {
      const connection = this.connections.get(connectionId)
      if (connection && connection.onData) {
        connection.onData(data)
      }
    })

    // 监听SSH就绪
    window.api.ssh.onReady((event, connectionId) => {
      const connection = this.connections.get(connectionId)
      if (connection && connection.onReady) {
        connection.onReady()
      }
    })

    // 监听SSH错误
    window.api.ssh.onError((event, connectionId, error) => {
      const connection = this.connections.get(connectionId)
      if (connection && connection.onError) {
        connection.onError(new Error(error))
      }
    })

    // 监听SSH关闭
    window.api.ssh.onClose((event, connectionId) => {
      const connection = this.connections.get(connectionId)
      if (connection && connection.onClose) {
        connection.onClose()
      }
      this.connections.delete(connectionId)
    })
  }

  // 创建SSH连接
  async connect(config, onData, onReady, onError, onClose) {
    try {
      const result = await window.api.ssh.connect(config)
      
      if (result.success) {
        const connectionId = result.connectionId
        
        // 保存回调函数
        this.connections.set(connectionId, {
          onData,
          onReady,
          onError,
          onClose,
          config
        })

        return {
          connectionId,
          connection: null, // 在渲染进程中不需要实际的连接对象
          stream: null
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      throw error
    }
  }

  // 发送数据到SSH连接
  async write(connectionId, data) {
    try {
      return await window.api.ssh.write(connectionId, data)
    } catch (error) {
      console.error('写入SSH数据失败:', error)
      return false
    }
  }

  // 调整终端大小
  async resize(connectionId, cols, rows) {
    try {
      return await window.api.ssh.resize(connectionId, cols, rows)
    } catch (error) {
      console.error('调整SSH终端大小失败:', error)
      return false
    }
  }

  // 关闭SSH连接
  async disconnect(connectionId) {
    try {
      const result = await window.api.ssh.disconnect(connectionId)
      this.connections.delete(connectionId)
      return result
    } catch (error) {
      console.error('断开SSH连接失败:', error)
      return false
    }
  }

  // 获取连接信息
  getConnection(connectionId) {
    return this.connections.get(connectionId)
  }

  // 获取所有连接
  getAllConnections() {
    return Array.from(this.connections.values())
  }

  // 测试SSH连接
  async testConnection(config) {
    try {
      const result = await window.api.ssh.testConnection(config)
      
      if (result.success) {
        return { success: true, message: result.message }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      throw error
    }
  }

  // 清理资源
  cleanup() {
    // 移除所有事件监听器
    window.api.ssh.removeAllListeners('ssh:data')
    window.api.ssh.removeAllListeners('ssh:ready')
    window.api.ssh.removeAllListeners('ssh:error')
    window.api.ssh.removeAllListeners('ssh:close')
    
    // 清除所有连接
    this.connections.clear()
  }
}

// 创建单例实例
export const sshService = new SSHService() 