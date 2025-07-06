import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'
import { ipcMain } from 'electron'

class SerialMainService {
  constructor() {
    this.connections = new Map()
    this.setupIPC()
  }

  customizeErrorMessage(originalError) {
    let message = originalError.message
    if (message.includes('code 31')) {
      message = `无法打开串口 (错误码: 31)。这通常意味着连接到系统的设备工作不正常。请检查以下几点：
1. 确保设备已正确连接并已上电。
2. 确认安装了正确的驱动程序。
3. 检查设备是否被其他软件（如其他串口终端）占用。
4. 尝试拔下设备再重新插入。
原始错误: ${message}`
    } else if (message.includes('Access denied')) {
      message = `无法打开串口 (访问被拒绝)。请检查：
1. 您是否有权限访问该串口。
2. 串口是否已被其他程序占用。
原始错误: ${message}`
    } else {
      message = `无法打开串口: ${message}`
    }
    return new Error(message)
  }

  setupIPC() {
    // 获取可用串口列表
    ipcMain.handle('serial:list-ports', async () => {
      try {
        const ports = await SerialPort.list()
        return {
          success: true,
          ports: ports.map(port => ({
            path: port.path,
            // Windows 下 SerialPort.list() 会包含 friendlyName/description 字段
            // 这些信息比 manufacturer 更贴近 SecureCRT 中的展示
            friendlyName: port.friendlyName || port.description || '',
            manufacturer: port.manufacturer || '未知设备',
            serialNumber: port.serialNumber || '',
            pnpId: port.pnpId || '',
            locationId: port.locationId || '',
            productId: port.productId || '',
            vendorId: port.vendorId || '',
            // 统一给渲染进程一个 displayName 字段，优先 friendlyName/description
            displayName: port.friendlyName || port.description || port.manufacturer || '未知设备'
          }))
        }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    // 测试串口连接
    ipcMain.handle('serial:test-connection', async (event, config) => {
      try {
        await this.testConnection(config)
        return { success: true, message: '串口连接测试成功' }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    // 创建串口连接
    ipcMain.handle('serial:connect', (event, config) => {
      // 避免 Promise reject 导致 "object could not be cloned" 错误
      // 始终 resolve 一个包含成功状态的对象
      return new Promise((resolve) => {
        this.createConnection(config, event.sender)
          .then(connectionId => {
            resolve({ success: true, connectionId })
          })
          .catch(error => {
            console.error('Serial connection failed in handler:', error.message)
            resolve({ success: false, error: error.message })
          })
      })
    })

    // 向串口写入数据
    ipcMain.handle('serial:write', async (event, connectionId, data, encoding = 'utf8') => {
      return this.write(connectionId, data, encoding)
    })

    // 断开串口连接
    ipcMain.handle('serial:disconnect', async (event, connectionId) => {
      return this.disconnect(connectionId)
    })

    // 设置串口控制信号
    ipcMain.handle('serial:set-control-lines', async (event, connectionId, options) => {
      return this.setControlLines(connectionId, options)
    })
  }

  async testConnection(config) {
    return new Promise((resolve, reject) => {
      const port = new SerialPort({
        path: config.port,
        baudRate: config.baudRate || 115200,
        dataBits: config.dataBits || 8,
        stopBits: config.stopBits || 1,
        parity: config.parity || 'none',
        rtscts: config.flowControl === 'hardware',
        xon: config.flowControl === 'software',
        xoff: config.flowControl === 'software',
        autoOpen: false
      })

      const timeout = setTimeout(() => {
        port.close()
        reject(new Error('连接超时'))
      }, 5000)

      port.open((err) => {
        clearTimeout(timeout)
        if (err) {
          reject(this.customizeErrorMessage(err))
        } else {
          port.close()
          resolve()
        }
      })
    })
  }

  async createConnection(config, webContents) {
    // 检查是否已有连接到该端口
    for (const connection of this.connections.values()) {
      if (connection.config.port === config.port && connection.port.isOpen) {
        return Promise.reject(new Error(`串口 ${config.port} 已经连接，请勿重复操作。`))
      }
    }

    const connectionId = `serial_${config.port}_${Date.now()}`
    
    return new Promise((resolve, reject) => {
      const portConfig = {
        path: config.port,
        baudRate: config.baudRate || 115200,
        dataBits: config.dataBits || 8,
        stopBits: config.stopBits || 1,
        parity: config.parity || 'none',
        autoOpen: false,
        ...({ flowControl: config.flowControl || 'none' })
      }

      // 根据 flowControl 的值设置 rtscts, xon, xoff
      if (portConfig.flowControl === 'hardware') {
        portConfig.rtscts = true
      } else if (portConfig.flowControl === 'software') {
        portConfig.xon = true
        portConfig.xoff = true
      }

      const port = new SerialPort(portConfig)

      port.on('error', (err) => {
        console.error('串口连接错误:', err)
        webContents.send('serial:error', connectionId, err.message)
        reject(err)
      })

      port.on('close', () => {
        console.log(`串口 ${config.port} 已断开`)
        this.connections.delete(connectionId)
        webContents.send('serial:close', connectionId)
      })

      // 监听原始数据, xterm.js可以直接处理Buffer
      port.on('data', (data) => {
        webContents.send('serial:data', connectionId, data)
      })

      // 打开串口
      port.open((err) => {
        if (err) {
          return reject(this.customizeErrorMessage(err))
        }
        
        console.log(`串口 ${config.port} 已连接`)
        
        // 保存连接信息
        this.connections.set(connectionId, {
          port: port,
          config: config
        })

        // 通知渲染进程连接成功
        webContents.send('serial:ready', connectionId)
        resolve(connectionId)
      })
    })
  }

  async write(connectionId, data, encoding = 'utf8') {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }

    const buffer = Buffer.from(data, encoding)

    return new Promise((resolve) => {
      connection.port.write(buffer, (err) => {
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  }

  async disconnect(connectionId) {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }

    return new Promise((resolve) => {
      connection.port.close((err) => {
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          this.connections.delete(connectionId)
          resolve({ success: true })
        }
      })
    })
  }

  // 获取连接状态
  getConnectionStatus(connectionId) {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return { exists: false }
    }

    return {
      exists: true,
      isOpen: connection.port.isOpen,
      path: connection.port.path,
      baudRate: connection.port.baudRate
    }
  }

  // 设置DTR/RTS
  async setControlLines(connectionId, options) {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    return new Promise((resolve) => {
      connection.port.set(options, (err) => {
        if (err) {
          console.error(`设置控制信号失败 for ${connectionId}:`, err)
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  }

  // 清理所有连接
  cleanup() {
    for (const [connectionId, connection] of this.connections) {
      if (connection.port.isOpen) {
        connection.port.close()
      }
    }
    this.connections.clear()
  }
}

export default SerialMainService 