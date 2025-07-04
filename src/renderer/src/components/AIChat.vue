<template>
  <div class="ai-chat">
    <!-- 聊天头部 -->
    <div class="chat-header">
      <div class="chat-title">
        <i class="icon-ai">🤖</i>
        <span>AI 助手</span>
      </div>
      <div class="chat-status">
        <span class="status-dot" :class="{ 'online': isOnline }"></span>
        <span class="status-text">{{ isOnline ? '在线' : '离线' }}</span>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="chat-messages" ref="messagesContainer">
      <div class="messages-container">
        <div 
          v-for="message in messages" 
          :key="message.id" 
          class="message"
          :class="{ 'user-message': message.type === 'user', 'ai-message': message.type === 'ai' }"
        >
          <div class="message-avatar">
            <span v-if="message.type === 'user'">👤</span>
            <span v-else>🤖</span>
          </div>
          <div class="message-content">
            <div class="message-text" v-html="formatMessage(message.content)"></div>
            <div class="message-time">{{ formatTime(message.timestamp) }}</div>
          </div>
        </div>
        
        <!-- 输入中提示 -->
        <div v-if="isTyping" class="message ai-message">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 空状态 -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">💬</div>
        <div class="empty-text">开始与 AI 助手对话</div>
        <div class="empty-hint">您可以询问终端操作、Linux 命令或其他技术问题</div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input">
      <div class="input-container">
        <textarea
          ref="messageInput"
          v-model="newMessage"
          @keydown="handleKeyDown"
          @input="adjustTextareaHeight"
          placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
          class="message-textarea"
          :disabled="isTyping"
        ></textarea>
        <button 
          @click="sendMessage" 
          class="send-button"
          :disabled="!newMessage.trim() || isTyping"
        >
          <span v-if="!isTyping">发送</span>
          <span v-else>发送中...</span>
        </button>
      </div>
      
      <!-- 快捷操作 -->
      <div class="quick-actions">
        <button @click="clearMessages" class="quick-action">
          <span>🗑️</span>
          <span>清空</span>
        </button>
        <button @click="exportChat" class="quick-action">
          <span>📤</span>
          <span>导出</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, onUnmounted } from 'vue'

// 响应式数据
const messages = reactive([])
const newMessage = ref('')
const isTyping = ref(false)
const isOnline = ref(true)
const messagesContainer = ref(null)
const messageInput = ref(null)

let messageIdCounter = 0

// 模拟消息
onMounted(() => {
  // 添加欢迎消息
  addMessage('ai', '你好！我是 AI 助手，可以帮助您解决终端操作和技术问题。有什么需要帮助的吗？')
})

// 添加消息
const addMessage = (type, content) => {
  const message = {
    id: ++messageIdCounter,
    type,
    content,
    timestamp: new Date()
  }
  messages.push(message)
  nextTick(() => {
    scrollToBottom()
  })
}

// 发送消息
const sendMessage = async () => {
  if (!newMessage.value.trim() || isTyping.value) return
  
  const userMessage = newMessage.value.trim()
  newMessage.value = ''
  adjustTextareaHeight()
  
  // 添加用户消息
  addMessage('user', userMessage)
  
  // 显示输入中状态
  isTyping.value = true
  
  try {
    // 模拟 AI 响应（这里可以接入真实的 AI API）
    await simulateAIResponse(userMessage)
  } catch (error) {
    addMessage('ai', '抱歉，我遇到了一些问题。请稍后再试。')
  } finally {
    isTyping.value = false
  }
}

// 模拟 AI 响应
const simulateAIResponse = async (userMessage) => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
  
  let response = ''
  
  // 简单的关键词响应逻辑
  if (userMessage.includes('终端') || userMessage.includes('命令')) {
    response = '关于终端命令，我可以帮您解释各种 Linux/Unix 命令的用法。比如：\n\n' +
              '• `ls` - 列出目录内容\n' +
              '• `cd` - 切换目录\n' +
              '• `pwd` - 显示当前路径\n' +
              '• `grep` - 文本搜索\n\n' +
              '您想了解哪个具体命令？'
  } else if (userMessage.includes('SSH') || userMessage.includes('ssh')) {
    response = 'SSH 是安全的远程连接协议。基本用法：\n\n' +
              '```bash\n' +
              'ssh username@hostname\n' +
              'ssh -p port username@hostname\n' +
              '```\n\n' +
              '常用选项：\n' +
              '• `-p` 指定端口\n' +
              '• `-i` 指定私钥文件\n' +
              '• `-v` 详细输出'
  } else if (userMessage.includes('help') || userMessage.includes('帮助')) {
    response = '我可以帮助您：\n\n' +
              '🔧 **终端操作** - Linux/Unix 命令解释\n' +
              '🌐 **SSH 连接** - 远程连接问题解决\n' +
              '💻 **系统管理** - 文件操作、权限管理\n' +
              '🐛 **故障排除** - 常见错误解决方案\n\n' +
              '请告诉我您遇到的具体问题！'
  } else {
    response = `我收到了您的消息："${userMessage}"。\n\n虽然我还在学习中，但我会尽力帮助您解决终端和技术相关的问题。请告诉我更具体的需求，比如：\n\n• 需要解释某个命令\n• 遇到了错误信息\n• 想要完成特定的操作\n\n这样我就能给您更有针对性的建议！`
  }
  
  addMessage('ai', response)
}

// 键盘事件处理
const handleKeyDown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// 自动调整文本框高度
const adjustTextareaHeight = () => {
  nextTick(() => {
    const textarea = messageInput.value
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
  })
}

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 格式化消息（支持简单的 markdown）
const formatMessage = (content) => {
  return content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

// 格式化时间
const formatTime = (timestamp) => {
  const now = new Date()
  const diff = now - timestamp
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  
  return timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString()
}

// 清空消息
const clearMessages = () => {
  messages.splice(0, messages.length)
  addMessage('ai', '对话已清空。有什么新问题吗？')
}

// 导出聊天记录
const exportChat = () => {
  const chatContent = messages.map(msg => {
    const sender = msg.type === 'user' ? '用户' : 'AI助手'
    const time = formatTime(msg.timestamp)
    return `[${time}] ${sender}: ${msg.content}`
  }).join('\n\n')
  
  const blob = new Blob([chatContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `AI聊天记录_${new Date().toISOString().split('T')[0]}.txt`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color);
}

/* 聊天头部 */
.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--el-bg-color-page);
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.icon-ai {
  font-size: 18px;
}

.chat-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-danger);
  transition: background 0.3s;
}

.status-dot.online {
  background: var(--el-color-success);
}

/* 消息列表 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.messages-container {
  padding: 0 20px;
}

.message {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;
  gap: 12px;
}

.message-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  flex-shrink: 0;
  font-size: 16px;
}

.user-message {
  flex-direction: row-reverse;
}

.user-message .message-content {
  text-align: right;
}

.user-message .message-avatar {
  background: var(--el-color-primary-light-9);
}

.ai-message .message-avatar {
  background: var(--el-fill-color);
}

.message-content {
  flex: 1;
  max-width: calc(100% - 44px);
}

.message-text {
  background: var(--el-fill-color);
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  word-wrap: break-word;
}

.user-message .message-text {
  background: var(--el-color-primary);
  color: white;
}

.message-text :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 13px;
}

.message-text :deep(pre) {
  background: rgba(0, 0, 0, 0.1);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-text :deep(pre code) {
  background: none;
  padding: 0;
}

.message-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
}

/* 输入中动画 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

/* 输入区域 */
.chat-input {
  border-top: 1px solid var(--el-border-color);
  padding: 16px 20px;
  background: var(--el-bg-color-page);
}

.input-container {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.message-textarea {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.3s;
}

.message-textarea:focus {
  border-color: var(--el-color-primary);
}

.message-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-button {
  padding: 10px 20px;
  background: var(--el-color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.send-button:hover:not(:disabled) {
  background: var(--el-color-primary-dark-2);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.3s;
}

.quick-action:hover {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-hover);
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

/* 清心主题样式 */
.fresh .ai-chat {
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
}

.fresh .chat-header {
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%);
  border-bottom: 1px solid #d6e9ff;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.06);
}

.fresh .chat-title {
  color: #1565c0;
  font-weight: 600;
}

.fresh .status-dot.online {
  background: #2ecc71;
  box-shadow: 0 0 8px rgba(46, 204, 113, 0.5);
}

.fresh .message-text {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e3f2fd;
  color: #2c3e50;
  backdrop-filter: blur(5px);
}

.fresh .user-message .message-text {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  color: white;
  border-color: #4285f4;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.fresh .message-text :deep(code) {
  background: rgba(66, 133, 244, 0.1);
  color: #1565c0;
}

.fresh .message-text :deep(pre) {
  background: rgba(66, 133, 244, 0.05);
  border: 1px solid #e3f2fd;
}

.fresh .chat-input {
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
  border-top: 1px solid #d6e9ff;
}

.fresh .message-textarea {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d6e9ff;
  color: #2c3e50;
  backdrop-filter: blur(5px);
}

.fresh .message-textarea:focus {
  border-color: #4285f4;
  box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
}

.fresh .send-button {
  background: linear-gradient(135deg, #4285f4 0%, #1976d2 100%);
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

.fresh .send-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(66, 133, 244, 0.4);
}

.fresh .quick-action {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #e3f2fd;
  color: #4285f4;
  backdrop-filter: blur(5px);
}

.fresh .quick-action:hover {
  background: rgba(240, 247, 255, 0.9);
  border-color: #4285f4;
  color: #1565c0;
  transform: translateY(-1px);
}
</style> 