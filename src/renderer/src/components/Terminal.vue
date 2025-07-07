<template>
  <div class="terminal-container" ref="terminalContainer">
    <div ref="terminalElement" class="terminal-element"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { useTerminalStore } from '../stores/terminal'
import { sshService } from '../services/ssh'
import { serialService } from '../services/serial'
import '@xterm/xterm/css/xterm.css'

const props = defineProps({
  tabId: {
    type: String,
    required: true
  }
})

const terminalStore = useTerminalStore()
const terminalElement = ref(null)
const terminalContainer = ref(null)

let terminal = null
let fitAddon = null
let webLinksAddon = null
let searchAddon = null
let sshConnectionId = null
let serialConnectionId = null
let currentTab = null

const initTerminal = () => {
  const theme = terminalStore.getCurrentTheme()
  
  terminal = new Terminal({
    theme: {
      background: theme.background,
      foreground: theme.foreground,
      cursor: theme.cursor,
      selection: theme.selection,
      black: theme.black,
      red: theme.red,
      green: theme.green,
      yellow: theme.yellow,
      blue: theme.blue,
      magenta: theme.magenta,
      cyan: theme.cyan,
      white: theme.white,
      brightBlack: theme.brightBlack,
      brightRed: theme.brightRed,
      brightGreen: theme.brightGreen,
      brightYellow: theme.brightYellow,
      brightBlue: theme.brightBlue,
      brightMagenta: theme.brightMagenta,
      brightCyan: theme.brightCyan,
      brightWhite: theme.brightWhite
    },
    fontFamily: '"Consolas", "Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10000,
    allowTransparency: false,
    convertEol: true
  })

  // 添加插件
  fitAddon = new FitAddon()
  webLinksAddon = new WebLinksAddon()
  searchAddon = new SearchAddon()
  
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(webLinksAddon)
  terminal.loadAddon(searchAddon)

  // 确保DOM元素存在后再打开终端
  if (!terminalElement.value) {
    console.error('Terminal element not found')
    return () => {} // 返回空函数避免错误
  }
  
  // 打开终端
  terminal.open(terminalElement.value)
  
  // 适配终端大小
  fitAddon.fit()

  // 获取当前标签页
  currentTab = terminalStore.tabs.find(t => t.id === props.tabId)
  
  if (currentTab && currentTab.connection) {
    if (currentTab.connection.type === 'serial') {
      // 串口连接模式
      initSerialConnection()
    } else {
      // SSH连接模式
      initSSHConnection(currentTab.connection)
    }
  } else {
    // 本地终端模式
    initLocalTerminal()
  }

  // 处理终端大小变化
  terminal.onResize(({ cols, rows }) => {
    if (sshConnectionId) {
      sshService.resize(sshConnectionId, cols, rows)
    }
  })

  // 更新store中的终端实例
  const tab = terminalStore.tabs.find(t => t.id === props.tabId)
  if (tab) {
    tab.terminal = terminal
  }

  // 窗口大小变化时重新适配
  const resizeObserver = new ResizeObserver(() => {
    if (fitAddon) {
      fitAddon.fit()
    }
  })
  
  if (terminalContainer.value) {
    resizeObserver.observe(terminalContainer.value)
  }

  // 返回清理函数
  return () => {
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  }
}

// 初始化SSH连接
const initSSHConnection = async (connection) => {
  try {
    // 确保连接对象有认证类型并且可序列化
    if (!connection.authType) {
      connection.authType = 'password';
    }

    // 创建一个只包含必要属性的简化连接对象
    const safeProps = [
      'host', 'port', 'username', 'password', 'privateKey', 'passphrase',
      'authType', 'name', 'keepaliveInterval', 'readyTimeout', 'timeout'
    ];
    
    const safeConnection = {};
    for (const prop of safeProps) {
      if (connection[prop] !== undefined) {
        safeConnection[prop] = connection[prop];
      }
    }
    
    terminal.writeln(`正在连接到 ${safeConnection.username}@${safeConnection.host}:${safeConnection.port}...`)
    
    const result = await sshService.connect(
      safeConnection,
      // onData - 接收SSH输出
      (data) => {
        try {
          terminal.write(data)
        } catch (err) {
          console.error('写入终端数据失败:', err)
        }
      },
      // onReady - 连接就绪
      () => {
        terminal.writeln('\r\n\x1b[32mSSH连接已建立。\x1b[0m')
        if (currentTab) {
          currentTab.isConnected = true
          currentTab.connectionStatus = 'connected'
        }
      },
      // onError - 连接错误
      (error) => {
        console.error('SSH连接错误:', error)
        terminal.writeln(`\r\n\x1b[31m连接错误: ${error.message || '未知错误'}\x1b[0m`)
        terminal.writeln('\x1b[33m请检查网络连接和认证信息。\x1b[0m')
        if (currentTab) {
          currentTab.isConnected = false
          currentTab.connectionStatus = 'error'
        }
      },
      // onClose - 连接关闭
      () => {
        terminal.writeln('\r\n\x1b[31m连接已断开\x1b[0m')
        sshConnectionId = null
        if (currentTab) {
          currentTab.isConnected = false
          currentTab.ssh = null
          currentTab.connectionStatus = 'disconnected'
        }
      }
    )
    
    // 连接成功后设置连接ID和状态
    if (result && result.connectionId) {
      sshConnectionId = result.connectionId
      if (currentTab) {
        currentTab.isConnected = true
        currentTab.ssh = { connectionId: result.connectionId }
        currentTab.connectionStatus = 'connecting'
      }
      
      // 处理用户输入
      terminal.onData((data) => {
        if (sshConnectionId) {
          try {
            sshService.write(sshConnectionId, data)
              .catch(err => {
                console.error('写入SSH数据失败:', err)
              })
          } catch (err) {
            console.error('SSH写入错误:', err)
          }
        }
      })
    } else {
      throw new Error('未能获取有效的连接ID')
    }
    
  } catch (error) {
    console.error('SSH连接异常:', error)
    terminal.writeln(`\r\n\x1b[31m连接失败: ${error.message || '未知错误'}\x1b[0m`)
    terminal.writeln('\x1b[33m请检查网络连接和认证信息。\x1b[0m')
    if (currentTab) {
      currentTab.isConnected = false
      currentTab.connectionStatus = 'failed'
    }
  }
}

// 初始化串口连接
const initSerialConnection = () => {
  if (!currentTab || !currentTab.connection) return

  // 连接逻辑已移至store，此处仅处理UI显示和用户输入
  if (currentTab.isConnected) {
    terminal.writeln('\r\n\x1b[32m已连接到串口\x1b[0m')
  } else {
    terminal.writeln(`正在连接到串口 ${currentTab.connection.path}...`)
    terminal.writeln(`配置: ${currentTab.connection.baudRate} bps, ${currentTab.connection.dataBits}${currentTab.connection.parity.charAt(0).toUpperCase()}${currentTab.connection.stopBits}`)
  }

  // 处理用户输入
  terminal.onData((data) => {
    if (currentTab && currentTab.connectionId && currentTab.isConnected) {
      serialService.write(currentTab.connectionId, data)
    }
  })
}

// 初始化本地终端 (伪终端)
const initLocalTerminal = () => {
  // 欢迎信息
  terminal.writeln('欢迎使用 TerminalX!')
  terminal.writeln('这是一个模拟终端环境。请使用左侧面板创建SSH连接以连接到远程服务器。')
  terminal.writeln('')
  terminal.write('$ ')

  // 处理用户输入
  let currentLine = ''
  terminal.onData((data) => {
    if (data === '\r') {
      // 回车键
      terminal.write('\r\n')
      if (currentLine.trim()) {
        handleCommand(currentLine.trim())
      }
      currentLine = ''
      terminal.write('$ ')
    } else if (data === '\u007f') {
      // 退格键
      if (currentLine.length > 0) {
        currentLine = currentLine.slice(0, -1)
        terminal.write('\b \b')
      }
    } else if (data === '\u0003') {
      // Ctrl+C
      terminal.write('^C\r\n$ ')
      currentLine = ''
    } else {
      // 普通字符
      currentLine += data
      terminal.write(data)
    }
  })
}

// 处理模拟终端命令
const handleCommand = (command) => {
  const args = command.split(' ')
  const cmd = args[0].toLowerCase()

  switch (cmd) {
    case 'help':
      terminal.writeln('可用命令:')
      terminal.writeln('  help     - 显示帮助信息')
      terminal.writeln('  clear    - 清空终端')
      terminal.writeln('  echo     - 输出文本')
      terminal.writeln('  date     - 显示当前时间')
      terminal.writeln('  whoami   - 显示当前用户')
      terminal.writeln('  ssh      - 显示SSH连接提示')
      break
    case 'clear':
      terminal.clear()
      break
    case 'echo':
      terminal.writeln(args.slice(1).join(' '))
      break
    case 'date':
      terminal.writeln(new Date().toString())
      break
    case 'whoami':
      terminal.writeln('TerminalX User')
      break
    case 'ssh':
      terminal.writeln('这是模拟终端环境。')
      terminal.writeln('请使用左侧面板的"新建SSH连接"按钮创建真实的SSH连接。')
      break
    default:
      terminal.writeln(`bash: ${cmd}: command not found`)
      terminal.writeln('输入 "help" 查看可用命令')
      break
  }
}

// 监听主题变化
watch(() => terminalStore.currentTheme, () => {
  if (terminal) {
    const theme = terminalStore.getCurrentTheme()
    terminal.options.theme = {
      background: theme.background,
      foreground: theme.foreground,
      cursor: theme.cursor,
      selection: theme.selection,
      black: theme.black,
      red: theme.red,
      green: theme.green,
      yellow: theme.yellow,
      blue: theme.blue,
      magenta: theme.magenta,
      cyan: theme.cyan,
      white: theme.white,
      brightBlack: theme.brightBlack,
      brightRed: theme.brightRed,
      brightGreen: theme.brightGreen,
      brightYellow: theme.brightYellow,
      brightBlue: theme.brightBlue,
      brightMagenta: theme.brightMagenta,
      brightCyan: theme.brightCyan,
      brightWhite: theme.brightWhite
    }
  }
})

let cleanup = null

onMounted(async () => {
  await nextTick()
  cleanup = initTerminal()
})

onUnmounted(() => {
  // 调用清理函数
  if (cleanup) {
    cleanup()
  }
  
  // 断开SSH连接
  if (sshConnectionId) {
    sshService.disconnect(sshConnectionId)
  }
  
  // 销毁终端实例
  if (terminal) {
    terminal.dispose()
  }
})

// 导出终端实例供外部使用
defineExpose({
  getTerminal: () => terminal,
  getFitAddon: () => fitAddon
})
</script>

<style scoped>
.terminal-container {
  width: 100%;
  height: 100%;
  background-color: var(--terminal-bg, #1e1e1e);
}

.terminal-element {
  width: 100%;
  height: 100%;
}

/* 确保xterm.js的样式正确显示 */
:deep(.xterm) {
  height: 100% !important;
}

:deep(.xterm-viewport) {
  overflow-y: auto;
}
</style> 