import { Client } from 'ssh2'
import { ipcMain } from 'electron'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'

// SSH连接状态枚举
const ConnectionState = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
  CLOSED: 'closed'
}

// SSH连接配置管理器
class SSHConfigManager {
  constructor() {
    this.defaultConfig = {
      // 连接配置
      port: 22,
      timeout: 15000,
      readyTimeout: 10000,
      keepaliveInterval: 0,
      keepaliveCountMax: 3,
      
      // 重连配置
      maxRetries: 3,
      retryDelay: 2000,
      retryBackoff: 1.5,
      
      // 认证配置
      authTimeout: 10000,
      
      // 终端配置
      terminalCols: 80,
      terminalRows: 24,
      
      // 安全配置
      allowHalfOpen: false,
      debug: false,
      
      // 连接池配置
      poolSize: 5,
      poolTimeout: 300000 // 5分钟
    }
  }

  mergeConfig(userConfig) {
    return {
      ...this.defaultConfig,
      ...userConfig
    }
  }

  validateConfig(config) {
    const errors = []
    
    if (!config.host) {
      errors.push('主机地址不能为空')
    }
    
    if (!config.username) {
      errors.push('用户名不能为空')
    }
    
    if (!config.authType) {
      errors.push('认证类型不能为空')
    }
    
    if (config.authType === 'password' && !config.password) {
      errors.push('密码认证时密码不能为空')
    }
    
    if (config.authType === 'privateKey') {
      if (!config.privateKey) {
        errors.push('私钥认证时私钥内容或文件路径不能为空')
      } else if (fs.existsSync(config.privateKey) && fs.statSync(config.privateKey).isFile()) {
        // 检查文件是否可读
        try {
          fs.accessSync(config.privateKey, fs.constants.R_OK)
        } catch (err) {
          errors.push(`私钥文件不可读: ${config.privateKey}`)
        }
      }
    }
    
    if (config.port && (config.port < 1 || config.port > 65535)) {
      errors.push('端口号必须在1-65535范围内')
    }
    
    return errors
  }
}

// SSH连接管理器
class SSHConnectionManager extends EventEmitter {
  constructor() {
    super()
    this.connections = new Map()
    this.configManager = new SSHConfigManager()
    this.connectionPool = new Map()
    this.healthCheckInterval = 30000 // 30秒
    this.startHealthMonitor()
    // 初始化日志
    this.logger = {
      info: (message) => console.log(`[SSH Service] ${new Date().toISOString()} INFO: ${message}`),
      warn: (message) => console.warn(`[SSH Service] ${new Date().toISOString()} WARN: ${message}`),
      error: (message) => console.error(`[SSH Service] ${new Date().toISOString()} ERROR: ${message}`)
    }
    // 添加IPC监听器处理用户输入
    ipcMain.on('ssh:write', (event, connectionId, data) => {
      this.write(connectionId, data)
    })
  }

  // 创建连接
  async createConnection(config, webContents) {
    const poolKey = `${config.host}_${config.port}_${config.username}`
    // 检查连接池是否有可用连接
    if (this.connectionPool.has(poolKey)) {
      const pooledConnection = this.connectionPool.get(poolKey)
      if (pooledConnection.state === ConnectionState.CONNECTED) {
        this.logger.info(`复用连接池中的SSH连接: ${poolKey}`)
        this.connectionPool.delete(poolKey)
        // 更新webContents
        pooledConnection.webContents = webContents
        this.connections.set(pooledConnection.id, pooledConnection)
        return pooledConnection.id
      }
    }

    const connectionId = this.generateConnectionId(config)
    const fullConfig = this.configManager.mergeConfig(config)
    
    // 验证配置
    const validationErrors = this.configManager.validateConfig(fullConfig)
    if (validationErrors.length > 0) {
      throw new Error(`配置验证失败: ${validationErrors.join(', ')}`)
    }

    const connectionInfo = {
      id: connectionId,
      config: fullConfig,
      state: ConnectionState.IDLE,
      connection: null,
      stream: null,
      webContents: webContents,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      retryCount: 0,
      reconnectTimer: null,
      stats: {
        bytesReceived: 0,
        bytesSent: 0,
        errors: 0,
        reconnects: 0
      },
      poolKey: poolKey
    }

    this.connections.set(connectionId, connectionInfo)
    this.emit('connection-created', connectionId, connectionInfo)

    try {
      await this.establishConnection(connectionInfo)
      return connectionId
    } catch (error) {
      this.handleConnectionError(connectionInfo, error)
      throw error
    }
  }

  // 建立连接
  async establishConnection(connectionInfo) {
    connectionInfo.state = ConnectionState.CONNECTING
    this.emit('connection-state-changed', connectionInfo.id, ConnectionState.CONNECTING)

    return new Promise((resolve, reject) => {
      const conn = new Client()
      const config = connectionInfo.config
      
      // 设置连接超时
      const timeout = setTimeout(() => {
        conn.end()
        reject(new Error('连接超时'))
      }, config.timeout)

      // 连接就绪事件
      conn.on('ready', () => {
        clearTimeout(timeout)
        console.log(`SSH连接已建立: ${connectionInfo.id}`)
        
        connectionInfo.state = ConnectionState.CONNECTED
        connectionInfo.connection = conn
        connectionInfo.lastActivity = Date.now()
        connectionInfo.retryCount = 0
        
        this.emit('connection-state-changed', connectionInfo.id, ConnectionState.CONNECTED)
        
        // 启动shell
        this.startShell(connectionInfo)
          .then(() => {
            this.sendToRenderer(connectionInfo.webContents, 'ssh:ready', connectionInfo.id)
            resolve()
          })
          .catch(reject)
      })

      // 连接错误事件
      conn.on('error', (err) => {
        clearTimeout(timeout)
        console.error(`SSH连接错误 [${connectionInfo.id}]:`, err.message)
        
        connectionInfo.stats.errors++
        this.handleConnectionError(connectionInfo, err)
        reject(err)
      })

      // 连接关闭事件
      conn.on('close', () => {
        clearTimeout(timeout)
        console.log(`SSH连接已关闭: ${connectionInfo.id}`)
        
        connectionInfo.state = ConnectionState.CLOSED
        connectionInfo.connection = null
        connectionInfo.stream = null
        
        this.emit('connection-state-changed', connectionInfo.id, ConnectionState.CLOSED)
        this.sendToRenderer(connectionInfo.webContents, 'ssh:close', connectionInfo.id)
        
        // 如果是意外关闭，尝试重连
        if (connectionInfo.retryCount < config.maxRetries) {
          this.scheduleReconnect(connectionInfo)
        }
      })

      // 建立连接
      const connectionOptions = this.buildConnectionOptions(config)
      try {
        conn.connect(connectionOptions)
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
      }
    })
  }

  // 构建连接选项
  buildConnectionOptions(config) {
    const options = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: config.readyTimeout,
      keepaliveInterval: config.keepaliveInterval,
      keepaliveCountMax: config.keepaliveCountMax,
      debug: config.debug ? (msg) => console.log(`[SSH Debug] ${msg}`) : undefined,
      // 尝试多种认证方法
      authMethods: ['password', 'publickey', 'keyboard-interactive']
    }

    // 认证配置
    if (config.authType === 'password') {
      options.password = config.password
    } else if (config.authType === 'privateKey') {
      // 如果是文件路径，则读取文件内容
      if (fs.existsSync(config.privateKey) && fs.statSync(config.privateKey).isFile()) {
        try {
          options.privateKey = fs.readFileSync(config.privateKey, 'utf8')
        } catch (err) {
          throw new Error(`读取私钥文件失败: ${err.message}`)
        }
      } else {
        options.privateKey = config.privateKey
      }
      if (config.passphrase) {
        options.passphrase = config.passphrase
      }
    } else if (config.authType === 'agent') {
      options.agent = process.env.SSH_AUTH_SOCK
    }

    return options
  }

  // 启动shell
  async startShell(connectionInfo) {
    return new Promise((resolve, reject) => {
      const conn = connectionInfo.connection
      const config = connectionInfo.config
      
      conn.shell({
        cols: config.terminalCols,
        rows: config.terminalRows,
        term: 'xterm-256color'
      }, (err, stream) => {
        if (err) {
          reject(new Error(`启动shell失败: ${err.message}`))
          return
        }

        connectionInfo.stream = stream
        
        // 设置数据处理
        stream.on('data', (data) => {
          connectionInfo.lastActivity = Date.now()
          connectionInfo.stats.bytesReceived += data.length
          this.sendToRenderer(connectionInfo.webContents, 'ssh:data', connectionInfo.id, data.toString('utf8'))
        })

        stream.on('close', () => {
          console.log(`SSH流已关闭: ${connectionInfo.id}`)
          connectionInfo.stream = null
          this.sendToRenderer(connectionInfo.webContents, 'ssh:close', connectionInfo.id)
        })

        stream.on('error', (err) => {
          console.error(`SSH流错误 [${connectionInfo.id}]:`, err.message)
          connectionInfo.stats.errors++
          this.sendToRenderer(connectionInfo.webContents, 'ssh:error', connectionInfo.id, err.message)
        })

        resolve()
      })
    })
  }

  // 处理连接错误
  handleConnectionError(connectionInfo, error) {
    connectionInfo.state = ConnectionState.FAILED
    connectionInfo.stats.errors++
    
    // 错误分类
    let errorType = 'unknown'
    if (error.message.includes('Authentication failed')) {
      errorType = 'auth_failed'
    } else if (error.message.includes('Connection timed out')) {
      errorType = 'timeout'
    } else if (error.message.includes('Host unreachable')) {
      errorType = 'host_unreachable'
    } else if (error.message.includes('Permission denied')) {
      errorType = 'permission_denied'
    }
    
    // 只发送可序列化的错误信息，避免传递整个error对象
    const serializableError = {
      message: error.message,
      type: errorType,
      // 移除originalError，避免序列化问题
    }
    
    this.emit('connection-error', connectionInfo.id, serializableError)
    this.sendToRenderer(connectionInfo.webContents, 'ssh:error', connectionInfo.id, serializableError)
    
    // 如果还有重试机会，安排重连
    if (connectionInfo.retryCount < connectionInfo.config.maxRetries) {
      // 认证错误不重试
      if (errorType !== 'auth_failed') {
        this.scheduleReconnect(connectionInfo)
      }
    }
  }

  // 安排重连
  scheduleReconnect(connectionInfo) {
    if (connectionInfo.reconnectTimer) {
      clearTimeout(connectionInfo.reconnectTimer)
    }

    const delay = connectionInfo.config.retryDelay * Math.pow(connectionInfo.config.retryBackoff, connectionInfo.retryCount)
    
    console.log(`将在${delay}ms后重连SSH: ${connectionInfo.id}`)
    
    connectionInfo.reconnectTimer = setTimeout(() => {
      this.attemptReconnect(connectionInfo)
    }, delay)
  }

  // 尝试重连
  async attemptReconnect(connectionInfo) {
    if (connectionInfo.state === ConnectionState.CLOSED) {
      return // 连接已被手动关闭
    }

    connectionInfo.retryCount++
    connectionInfo.stats.reconnects++
    connectionInfo.state = ConnectionState.RECONNECTING
    
    console.log(`开始重连SSH [${connectionInfo.retryCount}/${connectionInfo.config.maxRetries}]: ${connectionInfo.id}`)
    
    this.emit('connection-state-changed', connectionInfo.id, ConnectionState.RECONNECTING)
    
    try {
      await this.establishConnection(connectionInfo)
      console.log(`SSH重连成功: ${connectionInfo.id}`)
    } catch (error) {
      console.error(`SSH重连失败: ${connectionInfo.id}`, error.message)
      
      if (connectionInfo.retryCount < connectionInfo.config.maxRetries) {
        this.scheduleReconnect(connectionInfo)
      } else {
        console.error(`SSH重连达到最大次数，放弃重连: ${connectionInfo.id}`)
        connectionInfo.state = ConnectionState.FAILED
        this.emit('connection-state-changed', connectionInfo.id, ConnectionState.FAILED)
      }
    }
  }

  // 写入数据
  write(connectionId, data) {
    const connectionInfo = this.connections.get(connectionId)
    if (connectionInfo && connectionInfo.stream && connectionInfo.state === ConnectionState.CONNECTED) {
      connectionInfo.stream.write(data)
      connectionInfo.stats.bytesSent += data.length
      connectionInfo.lastActivity = Date.now()
      return true
    }
    return false
  }

  // 调整终端大小
  resize(connectionId, cols, rows) {
    const connectionInfo = this.connections.get(connectionId)
    if (connectionInfo && connectionInfo.stream && connectionInfo.state === ConnectionState.CONNECTED) {
      connectionInfo.stream.setWindow(rows, cols)
      return true
    }
    return false
  }

  // 断开连接
  disconnect(connectionId, options = {}) {
    const connectionInfo = this.connections.get(connectionId)
    if (connectionInfo) {
      // 清理重连定时器
      if (connectionInfo.reconnectTimer) {
        clearTimeout(connectionInfo.reconnectTimer)
        connectionInfo.reconnectTimer = null
      }
      
      // 关闭流
      if (connectionInfo.stream) {
        connectionInfo.stream.end()
        connectionInfo.stream = null
      }
      
      // 如果设置了pool选项且连接池未满，则将连接放入池中
      const poolConfig = connectionInfo.config.poolSize || this.configManager.defaultConfig.poolSize;
      if (options.pool && this.connectionPool.size < poolConfig && connectionInfo.state === ConnectionState.CONNECTED) {
        this.logger.info(`将SSH连接放入连接池: ${connectionInfo.poolKey}`)
        this.connectionPool.set(connectionInfo.poolKey, connectionInfo)
        // 设置连接池超时清理
        connectionInfo.poolTimeout = setTimeout(() => {
          if (this.connectionPool.has(connectionInfo.poolKey)) {
            this.logger.info(`连接池连接超时，关闭连接: ${connectionInfo.poolKey}`)
            connectionInfo.connection.end()
            this.connectionPool.delete(connectionInfo.poolKey)
          }
        }, connectionInfo.config.poolTimeout || this.configManager.defaultConfig.poolTimeout)
      } else {
        // 关闭连接
        if (connectionInfo.connection) {
          connectionInfo.connection.end()
          connectionInfo.connection = null
        }
      }
      
      connectionInfo.state = ConnectionState.CLOSED
      this.connections.delete(connectionId)
      this.emit('connection-removed', connectionId)
      
      return true
    }
    return false
  }

  // 生成连接ID
  generateConnectionId(config) {
    return `${config.host}_${config.port}_${config.username}_${Date.now()}`
  }

  // 发送消息到渲染进程
  sendToRenderer(webContents, event, ...args) {
    try {
      if (webContents && !webContents.isDestroyed()) {
        // 确保所有参数都是可序列化的
        const serializableArgs = args.map(arg => {
          if (arg instanceof Buffer) {
            // 转换Buffer为字符串
            return arg.toString('utf8')
          } else if (typeof arg === 'object' && arg !== null) {
            // 深拷贝对象，移除不可序列化的属性
            try {
              // 尝试序列化然后再解析，确保可序列化
              return JSON.parse(JSON.stringify(arg))
            } catch (err) {
              console.warn(`对象无法序列化，转换为简单对象: ${err.message}`)
              // 返回简单版本
              const simpleObj = {}
              for (const key in arg) {
                if (Object.hasOwnProperty.call(arg, key) && typeof arg[key] !== 'function') {
                  try {
                    JSON.stringify(arg[key]) // 测试是否可序列化
                    simpleObj[key] = arg[key]
                  } catch (e) {
                    simpleObj[key] = String(arg[key])
                  }
                }
              }
              return simpleObj
            }
          }
          return arg
        })
        
        webContents.send(event, ...serializableArgs)
      }
    } catch (error) {
      console.error('发送消息到渲染进程失败:', error)
    }
  }

  // 开始健康监控
  startHealthMonitor() {
    setInterval(() => {
      this.performHealthCheck()
    }, this.healthCheckInterval)
  }

  // 执行健康检查
  performHealthCheck() {
    const now = Date.now()
    const staleThreshold = this.healthCheckInterval * 2
    
    // 检查活跃连接
    for (const [connectionId, connectionInfo] of this.connections) {
      const timeSinceLastActivity = now - connectionInfo.lastActivity
      
      if (timeSinceLastActivity > staleThreshold && connectionInfo.state === ConnectionState.CONNECTED) {
        this.logger.warn(`检测到连接可能已失效: ${connectionId}`)
        
        // 发送SSH协议级别的心跳
        if (connectionInfo.connection) {
          try {
            // 使用SSH的keepalive机制
            connectionInfo.connection.exec('echo -n', (err) => {
              if (err) {
                this.logger.error(`心跳检测失败: ${connectionId}`, err.message)
                this.handleConnectionError(connectionInfo, new Error('心跳检测失败'))
              } else {
                connectionInfo.lastActivity = now
                this.logger.info(`心跳检测成功: ${connectionId}`)
              }
            })
          } catch (err) {
            this.logger.error(`发送心跳失败: ${connectionId}`, err.message)
          }
        }
      }
    }

    // 检查连接池中的连接
    for (const [poolKey, connectionInfo] of this.connectionPool) {
      const timeSinceLastActivity = now - connectionInfo.lastActivity
      if (timeSinceLastActivity > staleThreshold) {
        this.logger.info(`连接池连接超时，关闭连接: ${poolKey}`)
        connectionInfo.connection.end()
        this.connectionPool.delete(poolKey)
        clearTimeout(connectionInfo.poolTimeout)
      }
    }
  }

  // 获取连接统计信息
  getConnectionStats(connectionId) {
    const connectionInfo = this.connections.get(connectionId)
    if (connectionInfo) {
      return {
        id: connectionId,
        state: connectionInfo.state,
        createdAt: connectionInfo.createdAt,
        lastActivity: connectionInfo.lastActivity,
        retryCount: connectionInfo.retryCount,
        stats: connectionInfo.stats
      }
    }
    return null
  }

  // 获取所有连接统计
  getAllConnectionStats() {
    return Array.from(this.connections.keys()).map(id => this.getConnectionStats(id))
  }

  // 清理所有连接
  cleanup() {
    for (const connectionId of this.connections.keys()) {
      this.disconnect(connectionId)
    }
    this.connections.clear()
  }
}

// 主SSH服务类
class SSHMainService {
  constructor() {
    this.connectionManager = new SSHConnectionManager()
    this.sftpSessions = new Map()
    this.tunnels = new Map()
    this.setupIPC()
    this.setupEventHandlers()
  }

  setupEventHandlers() {
    this.connectionManager.on('connection-created', (connectionId, connectionInfo) => {
      console.log(`SSH连接已创建: ${connectionId}`)
    })

    this.connectionManager.on('connection-state-changed', (connectionId, state) => {
      console.log(`SSH连接状态变更: ${connectionId} -> ${state}`)
    })

    this.connectionManager.on('connection-error', (connectionId, error) => {
      console.error(`SSH连接错误: ${connectionId}`, error.message)
    })

    this.connectionManager.on('connection-removed', (connectionId) => {
      console.log(`SSH连接已移除: ${connectionId}`)
    })
  }

  setupIPC() {
    // 测试SSH连接
    ipcMain.handle('ssh:test-connection', async (event, config) => {
      try {
        await this.testConnection(config)
        return { success: true, message: '连接测试成功' }
      } catch (error) {
        console.error('SSH连接测试失败:', error.message)
        return { success: false, error: error.message }
      }
    })

    // 创建SSH连接
    ipcMain.handle('ssh:connect', async (event, config) => {
      try {
        const connectionId = await this.connectionManager.createConnection(config, event.sender)
        return { success: true, connectionId }
      } catch (error) {
        console.error('SSH连接创建失败:', error.message)
        return { success: false, error: error.message }
      }
    })

    // 发送数据到SSH连接
    ipcMain.handle('ssh:write', async (event, connectionId, data) => {
      return this.connectionManager.write(connectionId, data)
    })

    // 调整终端大小
    ipcMain.handle('ssh:resize', async (event, connectionId, cols, rows) => {
      return this.connectionManager.resize(connectionId, cols, rows)
    })

    // 断开SSH连接
    ipcMain.handle('ssh:disconnect', async (event, connectionId) => {
      return this.connectionManager.disconnect(connectionId)
    })

    // 获取连接统计
    ipcMain.handle('ssh:get-stats', async (event, connectionId) => {
      if (connectionId) {
        return this.connectionManager.getConnectionStats(connectionId)
      } else {
        return this.connectionManager.getAllConnectionStats()
      }
    })

    // SFTP相关功能
    ipcMain.handle('sftp:create-session', async (event, connectionId) => {
      try {
        const sftpId = await this.createSFTPSession(connectionId)
        return { success: true, sftpId }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('sftp:list-directory', async (event, sftpId, path) => {
      try {
        const files = await this.listDirectory(sftpId, path)
        return { success: true, files }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('sftp:download-file', async (event, sftpId, remotePath, localPath) => {
      try {
        await this.downloadFile(sftpId, remotePath, localPath, event.sender)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('sftp:upload-file', async (event, sftpId, localPath, remotePath) => {
      try {
        await this.uploadFile(sftpId, localPath, remotePath, event.sender)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('sftp:create-directory', async (event, sftpId, path) => {
      try {
        await this.createDirectory(sftpId, path)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('sftp:delete-file', async (event, sftpId, path) => {
      try {
        await this.deleteFile(sftpId, path)
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('sftp:close-session', async (event, sftpId) => {
      return this.closeSFTPSession(sftpId)
    })

    // SSH隧道相关功能
    ipcMain.handle('ssh:start-tunnel', async (event, connectionId, tunnelConfig) => {
      try {
        const tunnelId = await this.startTunnel(connectionId, tunnelConfig, event.sender)
        return { success: true, tunnelId }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    ipcMain.handle('ssh:stop-tunnel', async (event, tunnelId) => {
      return this.stopTunnel(tunnelId)
    })
  }

  async testConnection(config) {
    return new Promise((resolve, reject) => {
      const conn = new Client()
      const fullConfig = this.connectionManager.configManager.mergeConfig(config)
      
      const timeout = setTimeout(() => {
        conn.end()
        reject(new Error('连接测试超时'))
      }, fullConfig.timeout)

      conn.on('ready', () => {
        clearTimeout(timeout)
        conn.end()
        resolve()
      })

      conn.on('error', (err) => {
        clearTimeout(timeout)
        reject(new Error(err.message))
      })

      const connectionOptions = this.connectionManager.buildConnectionOptions(fullConfig)
      conn.connect(connectionOptions)
    })
  }

  // SFTP会话管理
  async createSFTPSession(connectionId) {
    const connectionInfo = this.connectionManager.connections.get(connectionId)
    if (!connectionInfo || !connectionInfo.connection) {
      throw new Error('SSH连接不存在或未准备好')
    }

    const sftpId = `sftp_${connectionId}_${Date.now()}`
    
    return new Promise((resolve, reject) => {
      connectionInfo.connection.sftp((err, sftp) => {
        if (err) {
          reject(new Error(`创建SFTP会话失败: ${err.message}`))
          return
        }

        this.sftpSessions.set(sftpId, {
          sftp: sftp,
          connectionId: connectionId,
          createdAt: Date.now()
        })

        resolve(sftpId)
      })
    })
  }

  async listDirectory(sftpId, directoryPath) {
    const session = this.sftpSessions.get(sftpId)
    if (!session) {
      throw new Error('SFTP会话不存在')
    }

    return new Promise((resolve, reject) => {
      session.sftp.readdir(directoryPath, (err, files) => {
        if (err) {
          reject(new Error(`列举目录失败: ${err.message}`))
          return
        }

        const fileList = files.map(file => ({
          name: file.filename,
          size: file.attrs.size,
          mode: file.attrs.mode,
          modified: file.attrs.mtime * 1000,
          isDirectory: (file.attrs.mode & 0o170000) === 0o040000,
          isFile: (file.attrs.mode & 0o170000) === 0o100000
        }))

        resolve(fileList)
      })
    })
  }

  async downloadFile(sftpId, remotePath, localPath, webContents) {
    const session = this.sftpSessions.get(sftpId)
    if (!session) {
      throw new Error('SFTP会话不存在')
    }

    return new Promise((resolve, reject) => {
      const stream = session.sftp.createReadStream(remotePath)
      const writeStream = fs.createWriteStream(localPath)

      stream.on('error', reject)
      writeStream.on('error', reject)
      writeStream.on('finish', resolve)

      stream.pipe(writeStream)
    })
  }

  async uploadFile(sftpId, localPath, remotePath, webContents) {
    const session = this.sftpSessions.get(sftpId)
    if (!session) {
      throw new Error('SFTP会话不存在')
    }

    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(localPath)
      const stream = session.sftp.createWriteStream(remotePath)

      readStream.on('error', reject)
      stream.on('error', reject)
      stream.on('finish', resolve)

      readStream.pipe(stream)
    })
  }

  async createDirectory(sftpId, directoryPath) {
    const session = this.sftpSessions.get(sftpId)
    if (!session) {
      throw new Error('SFTP会话不存在')
    }

    return new Promise((resolve, reject) => {
      session.sftp.mkdir(directoryPath, (err) => {
        if (err) {
          reject(new Error(`创建目录失败: ${err.message}`))
          return
        }
        resolve()
      })
    })
  }

  async deleteFile(sftpId, filePath) {
    const session = this.sftpSessions.get(sftpId)
    if (!session) {
      throw new Error('SFTP会话不存在')
    }

    return new Promise((resolve, reject) => {
      session.sftp.unlink(filePath, (err) => {
        if (err) {
          reject(new Error(`删除文件失败: ${err.message}`))
          return
        }
        resolve()
      })
    })
  }

  closeSFTPSession(sftpId) {
    const session = this.sftpSessions.get(sftpId)
    if (session) {
      session.sftp.end()
      this.sftpSessions.delete(sftpId)
      return { success: true }
    }
    return { success: false, error: 'SFTP会话不存在' }
  }

  // SSH隧道管理
  async startTunnel(connectionId, tunnelConfig, webContents) {
    const connectionInfo = this.connectionManager.connections.get(connectionId)
    if (!connectionInfo || !connectionInfo.connection) {
      throw new Error('SSH连接不存在或未准备好')
    }

    const { connection } = connectionInfo
    const { localPort, remoteHost, remotePort } = tunnelConfig
    const tunnelId = `tunnel_${connectionId}_${localPort}_${remoteHost}_${remotePort}`

    return new Promise((resolve, reject) => {
      const server = require('net').createServer((sock) => {
        connection.forwardOut('127.0.0.1', 0, remoteHost, remotePort, (err, stream) => {
          if (err) {
            console.error('隧道转发错误:', err)
            sock.end()
            return
          }
          
          sock.pipe(stream)
          stream.pipe(sock)

          stream.on('close', () => {
            console.log(`隧道 stream for ${tunnelId} 已关闭`)
            sock.end()
          })

          sock.on('close', () => {
            console.log(`客户端 socket for ${tunnelId} 已关闭`)
            stream.close()
          })

          sock.on('error', (socketErr) => {
            console.error(`客户端 socket for ${tunnelId} 错误:`, socketErr)
            stream.close()
          })

          stream.on('error', (streamErr) => {
            console.error(`隧道 stream for ${tunnelId} 错误:`, streamErr)
            sock.end()
          })
        })
      })

      server.listen(localPort, '127.0.0.1', () => {
        console.log(`隧道 ${tunnelId} 已在本地端口 ${localPort} 上启动`)
        this.tunnels.set(tunnelId, server)
        webContents.send('ssh:tunnel-started', tunnelId, tunnelConfig)
        resolve(tunnelId)
      })

      server.on('error', (err) => {
        console.error(`隧道服务器错误 on port ${localPort}:`, err)
        reject(new Error(`无法在本地端口 ${localPort} 上启动隧道: ${err.message}`))
      })
    })
  }

  stopTunnel(tunnelId) {
    const server = this.tunnels.get(tunnelId)
    if (server) {
      return new Promise((resolve) => {
        server.close((err) => {
          if (err) {
            console.error(`关闭隧道 ${tunnelId} 时出错:`, err)
            resolve({ success: false, error: err.message })
          } else {
            console.log(`隧道 ${tunnelId} 已关闭`)
            this.tunnels.delete(tunnelId)
            resolve({ success: true })
          }
        })
      })
    }
    return { success: false, error: '隧道不存在' }
  }

  // 清理所有资源
  cleanup() {
    // 清理连接
    this.connectionManager.cleanup()
    
    // 清理SFTP会话
    for (const [sftpId, session] of this.sftpSessions) {
      session.sftp.end()
    }
    this.sftpSessions.clear()
    
    // 清理隧道
    for (const [tunnelId, server] of this.tunnels) {
      server.close()
    }
    this.tunnels.clear()
  }
}

export default SSHMainService