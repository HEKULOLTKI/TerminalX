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
    // SSH连接模式
    initSSHConnection(currentTab.connection)
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
    terminal.writeln(`正在连接到 ${connection.username}@${connection.host}:${connection.port}...`)
    
    const result = await sshService.connect(
      connection,
      // onData - 接收SSH输出
      (data) => {
        terminal.write(data)
      },
      // onReady - 连接就绪
      (stream) => {
        terminal.writeln('连接成功!')
      },
      // onError - 连接错误
      (error) => {
        terminal.writeln(`\r\n连接错误: ${error.message}`)
        terminal.writeln('请检查连接配置并重试。')
        if (currentTab) {
          currentTab.isConnected = false
        }
      },
      // onClose - 连接关闭
      () => {
        terminal.writeln('\r\n连接已断开')
        sshConnectionId = null
        if (currentTab) {
          currentTab.isConnected = false
          currentTab.ssh = null
        }
      }
    )
    
    // 连接成功后设置连接ID和状态
    sshConnectionId = result.connectionId
    if (currentTab) {
      currentTab.isConnected = true
      currentTab.ssh = result.connection
    }
    
    // 处理用户输入
    terminal.onData((data) => {
      if (sshConnectionId) {
        sshService.write(sshConnectionId, data)
      }
    })
    
  } catch (error) {
    terminal.writeln(`连接失败: ${error.message}`)
    terminal.writeln('请检查网络连接和认证信息。')
    if (currentTab) {
      currentTab.isConnected = false
    }
  }
}

// 初始化本地终端
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