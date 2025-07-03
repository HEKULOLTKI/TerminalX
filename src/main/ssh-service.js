import { Client } from 'ssh2'
import { ipcMain } from 'electron'

class SSHMainService {
  constructor() {
    this.connections = new Map()
    this.sftpSessions = new Map()
    this.setupIPC()
  }

  setupIPC() {
    // 测试SSH连接
    ipcMain.handle('ssh:test-connection', async (event, config) => {
      try {
        await this.testConnection(config)
        return { success: true, message: '连接测试成功' }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    // 创建SSH连接
    ipcMain.handle('ssh:connect', async (event, config) => {
      try {
        const connectionId = await this.createConnection(config, event.sender)
        return { success: true, connectionId }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    // 发送数据到SSH连接
    ipcMain.handle('ssh:write', async (event, connectionId, data) => {
      return this.write(connectionId, data)
    })

    // 调整终端大小
    ipcMain.handle('ssh:resize', async (event, connectionId, cols, rows) => {
      return this.resize(connectionId, cols, rows)
    })

    // 断开SSH连接
    ipcMain.handle('ssh:disconnect', async (event, connectionId) => {
      return this.disconnect(connectionId)
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
  }

  async testConnection(config) {
    return new Promise((resolve, reject) => {
      const conn = new Client()
      
      const timeout = setTimeout(() => {
        conn.end()
        reject(new Error('连接超时'))
      }, 10000)

      conn.on('ready', () => {
        clearTimeout(timeout)
        conn.end()
        resolve()
      })

      conn.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      const connectionOptions = {
        host: config.host,
        port: config.port || 22,
        username: config.username
      }

      if (config.authType === 'password') {
        connectionOptions.password = config.password
      } else if (config.authType === 'privateKey') {
        connectionOptions.privateKey = config.privateKey
        if (config.passphrase) {
          connectionOptions.passphrase = config.passphrase
        }
      }

      conn.connect(connectionOptions)
    })
  }

  async createConnection(config, webContents) {
    const conn = new Client()
    const connectionId = `${config.host}_${config.port}_${Date.now()}`

    return new Promise((resolve, reject) => {
      conn.on('ready', () => {
        console.log('SSH连接已建立')
        
        // 启动shell
        conn.shell((err, stream) => {
          if (err) {
            reject(err)
            return
          }

          // 设置终端大小
          stream.setWindow(80, 24)

          // 处理数据流
          stream.on('data', (data) => {
            webContents.send('ssh:data', connectionId, data.toString('utf8'))
          })

          stream.on('close', () => {
            console.log('SSH流已关闭')
            webContents.send('ssh:close', connectionId)
            this.connections.delete(connectionId)
          })

          // 保存连接和流
          this.connections.set(connectionId, {
            connection: conn,
            stream: stream,
            config: config
          })

          webContents.send('ssh:ready', connectionId)
          resolve(connectionId)
        })
      })

      conn.on('error', (err) => {
        console.error('SSH连接错误:', err)
        webContents.send('ssh:error', connectionId, err.message)
        reject(err)
      })

      conn.on('close', () => {
        console.log('SSH连接已关闭')
        this.connections.delete(connectionId)
        webContents.send('ssh:close', connectionId)
      })

      // 建立连接
      const connectionOptions = {
        host: config.host,
        port: config.port || 22,
        username: config.username
      }

      if (config.authType === 'password') {
        connectionOptions.password = config.password
      } else if (config.authType === 'privateKey') {
        connectionOptions.privateKey = config.privateKey
        if (config.passphrase) {
          connectionOptions.passphrase = config.passphrase
        }
      }

      try {
        conn.connect(connectionOptions)
      } catch (error) {
        reject(error)
      }
    })
  }

  write(connectionId, data) {
    const conn = this.connections.get(connectionId)
    if (conn && conn.stream) {
      conn.stream.write(data)
      return true
    }
    return false
  }

  resize(connectionId, cols, rows) {
    const conn = this.connections.get(connectionId)
    if (conn && conn.stream) {
      conn.stream.setWindow(rows, cols)
      return true
    }
    return false
  }

  disconnect(connectionId) {
    const conn = this.connections.get(connectionId)
    if (conn) {
      if (conn.stream) {
        conn.stream.end()
      }
      if (conn.connection) {
        conn.connection.end()
      }
      this.connections.delete(connectionId)
      return true
    }
    return false
  }
}

// 创建单例并导出
export const sshMainService = new SSHMainService() 