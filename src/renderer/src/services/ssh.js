// SSH服务 - 渲染进程版本
// 通过IPC与主进程中的SSH服务通信

export class SSHService {
  constructor() {
    this.connections = new Map()
    this.connectionStats = new Map()
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
      this.connectionStats.delete(connectionId)
    })
  }

  // 创建SSH连接
  async connect(config, onData, onReady, onError, onClose) {
    try {
      // 创建可序列化的配置对象副本，移除任何不可序列化的属性
      const serializableConfig = this.createSerializableConfig(config)
      
      const result = await window.api.ssh.connect(serializableConfig)
      
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

        // 获取连接统计信息
        this.updateConnectionStats(connectionId)

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
  
  // 创建可序列化的配置对象副本
  createSerializableConfig(config) {
    // 基本属性，这些通常是可序列化的
    const safeProps = [
      'host', 'port', 'username', 'password', 'privateKey', 'passphrase',
      'authType', 'name', 'keepaliveInterval', 'readyTimeout', 'timeout'
    ];
    
    // 创建一个新的空对象
    const serializableConfig = {};
    
    // 只复制安全的基本属性
    for (const prop of safeProps) {
      if (config[prop] !== undefined) {
        serializableConfig[prop] = config[prop];
      }
    }
    
    return serializableConfig;
  }

  // 发送数据到SSH连接
  async write(connectionId, data) {
    try {
      const result = await window.api.ssh.write(connectionId, data)
      
      // 更新统计信息
      if (result) {
        this.updateConnectionStats(connectionId)
      }
      
      return result
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
      this.connectionStats.delete(connectionId)
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
      // 同样确保传递可序列化的配置
      const serializableConfig = this.createSerializableConfig(config)
      const result = await window.api.ssh.testConnection(serializableConfig)
      
      if (result.success) {
        return { success: true, message: result.message }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      throw error
    }
  }

  // 获取连接统计信息
  async getConnectionStats(connectionId) {
    try {
      const result = await window.api.ssh.getStats(connectionId)
      if (result) {
        this.connectionStats.set(connectionId, result)
      }
      return result
    } catch (error) {
      console.error('获取连接统计信息失败:', error)
      return null
    }
  }

  // 获取所有连接统计信息
  async getAllConnectionStats() {
    try {
      const results = await window.api.ssh.getStats()
      if (results && Array.isArray(results)) {
        results.forEach(stats => {
          if (stats && stats.id) {
            this.connectionStats.set(stats.id, stats)
          }
        })
      }
      return results
    } catch (error) {
      console.error('获取所有连接统计信息失败:', error)
      return []
    }
  }

  // 更新连接统计信息
  async updateConnectionStats(connectionId) {
    try {
      const stats = await this.getConnectionStats(connectionId)
      return stats
    } catch (error) {
      console.error('更新连接统计信息失败:', error)
      return null
    }
  }

  // 获取缓存的连接统计信息
  getCachedConnectionStats(connectionId) {
    return this.connectionStats.get(connectionId)
  }

  // 获取所有缓存的连接统计信息
  getAllCachedConnectionStats() {
    return Array.from(this.connectionStats.values())
  }

  // 连接健康检查
  async performHealthCheck() {
    const connections = Array.from(this.connections.keys())
    const healthStatus = new Map()
    
    for (const connectionId of connections) {
      try {
        const stats = await this.getConnectionStats(connectionId)
        if (stats) {
          const isHealthy = this.isConnectionHealthy(stats)
          healthStatus.set(connectionId, {
            isHealthy,
            stats,
            lastChecked: Date.now()
          })
        }
      } catch (error) {
        healthStatus.set(connectionId, {
          isHealthy: false,
          error: error.message,
          lastChecked: Date.now()
        })
      }
    }
    
    return healthStatus
  }

  // 检查连接是否健康
  isConnectionHealthy(stats) {
    if (!stats) return false
    
    const now = Date.now()
    const timeSinceLastActivity = now - stats.lastActivity
    const maxInactivityTime = 60000 // 1分钟
    
    // 检查连接状态
    if (stats.state !== 'connected') {
      return false
    }
    
    // 检查是否长时间无活动
    if (timeSinceLastActivity > maxInactivityTime) {
      return false
    }
    
    // 检查错误率
    if (stats.stats.errors > 10) {
      return false
    }
    
    return true
  }

  // 获取连接性能指标
  getConnectionPerformanceMetrics(connectionId) {
    const stats = this.connectionStats.get(connectionId)
    if (!stats) return null
    
    const now = Date.now()
    
    return {
      latency: stats.latency || 0,
      uptime: now - stats.createdAt,
      lastActivity: now - stats.lastActivity,
      bytesReceived: stats.stats?.bytesReceived || 0,
      bytesSent: stats.stats?.bytesSent || 0,
      errors: stats.stats?.errors || 0
    }
  }

  // 清理资源
  cleanup() {
    // 断开所有连接
    for (const connectionId of this.connections.keys()) {
      this.disconnect(connectionId).catch(error => {
        console.error(`清理连接 ${connectionId} 失败:`, error)
      })
    }
    
    this.connections.clear()
    this.connectionStats.clear()
  }
}

// 导出SSH服务实例
export const sshService = new SSHService() 