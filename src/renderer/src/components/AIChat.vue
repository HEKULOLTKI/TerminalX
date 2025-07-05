<template>
  <div class="ai-chat" :class="[terminalStore.currentTheme + '-theme', terminalStore.currentTheme]">
    <!-- 消息列表 -->
    <div class="chat-messages" ref="messagesContainer">
      <div class="messages-container">
        <!-- 空状态 -->
        <div v-if="messages.length === 0" class="empty-state">
          <div class="empty-content">
            <div class="empty-icon">✨</div>
            <h3 class="empty-title">开始对话</h3>
            <p class="empty-subtitle">我是您的AI助手，可以帮助您解决各种问题</p>
            <div class="suggestion-grid">
              <button 
                v-for="suggestion in suggestions" 
                :key="suggestion.text"
                @click="sendSuggestion(suggestion.text)" 
                class="suggestion-card card-3d ripple"
              >
                <div class="suggestion-icon">{{ suggestion.icon }}</div>
                <div class="suggestion-text">{{ suggestion.label }}</div>
              </button>
            </div>
          </div>
        </div>

        <!-- 消息列表 -->
        <div class="message-list">
          <div 
            v-for="message in messages" 
            :key="message.id" 
            class="message-item"
            :class="{ 
              'user-message': message.type === 'user', 
              'ai-message': message.type === 'ai'
            }"
            :data-message-id="message.id"
          >
            <!-- 用户消息 -->
            <div v-if="message.type === 'user'" class="user-message-content">
              <div class="message-header">
                <div class="message-avatar user-avatar">👤</div>
                <div class="message-info">
                  <span class="message-author">用户</span>
                  <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                </div>
                <div class="message-actions" v-if="isLongUserMessage(message)">
                  <button 
                    @click="toggleUserMessageFold(message)" 
                    class="fold-btn ripple" 
                    :title="message.folded ? '展开消息' : '收起消息'"
                  >
                    {{ message.folded ? '展开' : '收起' }}
                  </button>
                </div>
              </div>
              <div class="message-content" 
                   :class="{ 'message-folded': message.folded }">
                <div class="user-text">
                  {{ message.folded ? getMessagePreview(message.content) : message.content }}
                </div>
              </div>
            </div>
            
            <!-- AI消息 -->
            <div v-else class="ai-message-content">
              <div class="message-content">
                <div class="ai-text markdown-content" 
                     v-html="message.formattedContent"
                     @click="handleMessageClick"></div>
                <div class="ai-message-actions">
                  <button @click="copyMessage(message)" class="action-btn ripple" title="复制">
                    📋
                  </button>
                  <button @click="regenerateMessage(message)" class="action-btn ripple" title="重新生成">
                    🔄
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 输入中提示 -->
          <div v-if="isTyping" class="message-item ai-message typing-message">
            <div class="ai-message-content">
              <div class="message-content">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-container">
      <div class="input-wrapper">
        <div class="input-area">
          <textarea
            ref="messageInput"
            v-model="newMessage"
            @keydown.enter.prevent="handleEnterKey"
            placeholder="询问任何问题..."
            class="message-input"
            :disabled="isTyping"
            rows="1"
          ></textarea>
          <button 
            v-if="newMessage.trim()"
            @click="sendMessage" 
            class="send-btn ripple"
            :disabled="isTyping"
          >
            发送
          </button>
        </div>
      </div>
      
      <!-- 底部工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="model-selector">
            <select v-model="selectedModel" class="model-select">
              <option v-for="model in availableModels" :key="model.value" :value="model.value">
                {{ model.label }}
              </option>
            </select>
          </div>
        </div>
        <div class="toolbar-right">
          <button @click="testCodeBlock" class="toolbar-btn ripple" title="测试代码块">
            🧪
          </button>
          <button @click="toggleTheme" class="toolbar-btn theme-btn ripple" :title="`当前主题: ${getThemeDisplayName()}`">
            <span class="theme-icon">{{ getThemeIcon() }}</span>
            <span class="theme-label">{{ getThemeDisplayName() }}</span>
          </button>
          <button @click="toggleAllMessagesFold" class="toolbar-btn ripple" title="折叠/展开所有长消息">
            📄
          </button>
          <button @click="clearMessages" class="toolbar-btn ripple" title="清空对话">
            🗑️
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, watch, computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import katex from 'katex'
import { useTerminalStore } from '../stores/terminal'

// Props
const props = defineProps({
  chatId: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits(['chat-title-generated', 'messages-updated'])

// 使用terminal store
const terminalStore = useTerminalStore()

// 状态管理
const messages = reactive([])
const newMessage = ref('')
const isTyping = ref(false)
const messagesContainer = ref(null)
const messageInput = ref(null)
const selectedModel = ref('claude-3-5-sonnet')

// 建议列表
const suggestions = [
  { icon: '💻', label: '代码解释', text: '解释一下这段代码的功能' },
  { icon: '⚡', label: '代码优化', text: '帮我优化这个函数' },
  { icon: '🐛', label: '问题调试', text: '如何解决这个bug？' },
  { icon: '📝', label: '生成代码', text: '写一个示例代码' }
]

// AI模型列表
const availableModels = [
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
]

// 配置marked
const renderer = new marked.Renderer()

// 代码块渲染
renderer.code = function(code, language) {
  const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext';
  const highlighted = hljs.highlight(code, { language: validLanguage }).value;
  
  // 生成行号
  const lines = code.split('\n');
  const lineNumbers = lines.map((_, index) => `<span class="line-number">${index + 1}</span>`).join('');
  
  // 检查是否为长代码块（超过10行）
  const isLongCode = lines.length > 10;
  const previewLines = isLongCode ? lines.slice(0, 5) : lines;
  const previewLineNumbers = isLongCode ? previewLines.map((_, index) => `<span class="line-number">${index + 1}</span>`).join('') : lineNumbers;
  const previewHighlighted = isLongCode ? hljs.highlight(previewLines.join('\n'), { language: validLanguage }).value : highlighted;
  
  const blockId = `code-block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return `
    <div class="code-block-wrapper ${isLongCode ? 'foldable' : ''}" data-block-id="${blockId}">
      <div class="code-header">
        <span class="code-language">${validLanguage}</span>
        <div class="code-actions">
          ${isLongCode ? `<button class="code-fold-btn" onclick="toggleCodeFold('${blockId}')" title="展开/收起代码">
            <span class="fold-icon">📄</span>
            <span class="fold-text">展开 (${lines.length} 行)</span>
          </button>` : ''}
          <button class="code-copy-btn" onclick="copyCode(this)" data-code="${encodeURIComponent(code)}" title="复制代码">
            <span class="copy-icon">📋</span>
            <span class="copy-text">复制</span>
          </button>
        </div>
      </div>
      <div class="code-content">
        <div class="code-preview ${isLongCode ? 'collapsed' : ''}">
          <div class="line-numbers">${previewLineNumbers}</div>
          <pre><code class="hljs language-${validLanguage}">${previewHighlighted}</code></pre>
          ${isLongCode ? '<div class="code-fade-overlay"></div>' : ''}
        </div>
        ${isLongCode ? `
        <div class="code-full" style="display: none;">
          <div class="line-numbers">${lineNumbers}</div>
          <pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

// 表格渲染增强
renderer.table = function(header, body) {
  const tableId = `table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  return `
    <div class="table-wrapper" data-table-id="${tableId}">
      <div class="table-toolbar">
        <div class="table-info">
          <span class="table-title">数据表格</span>
        </div>
        <div class="table-actions">
          <button class="table-action-btn" onclick="toggleTableView('${tableId}')" title="切换表格视图">
            <span class="table-view-icon">📱</span>
          </button>
          <button class="table-action-btn" onclick="copyTable('${tableId}')" title="复制表格">
            <span class="table-copy-icon">📋</span>
          </button>
        </div>
      </div>
      <div class="table-container">
        <table class="markdown-table" id="${tableId}">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `
}

// 引用块渲染
renderer.blockquote = function(quote) {
  return `<blockquote class="markdown-blockquote">${quote}</blockquote>`
}

// 链接渲染（增加安全性）
renderer.link = function(href, title, text) {
  const titleAttr = title ? ` title="${title}"` : ''
  return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr} class="markdown-link">${text}</a>`
}

// 图片渲染
renderer.image = function(href, title, text) {
  const titleAttr = title ? ` title="${title}"` : ''
  const altAttr = text ? ` alt="${text}"` : ''
  const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  return `
    <div class="image-wrapper">
      <img src="${href}"${titleAttr}${altAttr} 
           class="markdown-image" 
           loading="lazy" 
           id="${imageId}"
           onclick="openImageLightbox('${imageId}', '${href}', '${text || title || ''}')"
           style="cursor: zoom-in;">
      <div class="image-overlay">
        <span class="image-zoom-icon">🔍</span>
      </div>
    </div>
  `
}

// 列表项渲染（支持任务列表）
renderer.listitem = function(text) {
  // 检查是否是任务列表
  const taskMatch = text.match(/^\[([ x])\]\s*(.*)/)
  if (taskMatch) {
    const checked = taskMatch[1] === 'x'
    const content = taskMatch[2]
    return `<li class="task-list-item">
      <input type="checkbox" ${checked ? 'checked' : ''} disabled class="task-checkbox">
      <span class="task-text">${content}</span>
    </li>`
  }
  return `<li>${text}</li>`
}

// 标题渲染（添加锚点）
renderer.heading = function(text, level) {
  const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-')
  return `<h${level} class="markdown-heading markdown-h${level}" id="heading-${escapedText}">${text}</h${level}>`
}

// 内联代码渲染
renderer.codespan = function(code) {
  return `<code class="markdown-inline-code">${code}</code>`
}

// 配置marked选项
marked.setOptions({
  renderer: renderer,
  highlight: false,
  breaks: true,
  gfm: true,
  tables: true,
  smartLists: true,
  smartypants: false,
  xhtml: false,
  silent: true, // 静默模式，避免抛出错误
  sanitize: false, // 不进行HTML清理，因为我们有自己的安全措施
  pedantic: false // 不严格遵循原版markdown解析器
})

// 全局复制代码函数
window.copyCode = async function(button) {
  const code = decodeURIComponent(button.dataset.code)
  const iconSpan = button.querySelector('.copy-icon')
  const textSpan = button.querySelector('.copy-text')
  
  try {
    await navigator.clipboard.writeText(code)
    // 显示复制成功状态
    if (iconSpan) iconSpan.textContent = '✓'
    if (textSpan) textSpan.textContent = '已复制'
    button.style.color = '#10b981'
    button.style.borderColor = '#10b981'
    
    // 2秒后恢复原状态
    setTimeout(() => {
      if (iconSpan) iconSpan.textContent = '📋'
      if (textSpan) textSpan.textContent = '复制'
      button.style.color = ''
      button.style.borderColor = ''
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
    // 显示复制失败状态
    if (iconSpan) iconSpan.textContent = '✗'
    if (textSpan) textSpan.textContent = '失败'
    button.style.color = '#ef4444'
    button.style.borderColor = '#ef4444'
    
    setTimeout(() => {
      if (iconSpan) iconSpan.textContent = '📋'
      if (textSpan) textSpan.textContent = '复制'
      button.style.color = ''
      button.style.borderColor = ''
    }, 2000)
  }
}

// 全局表格视图切换函数
window.toggleTableView = function(tableId) {
  const tableWrapper = document.querySelector(`[data-table-id="${tableId}"]`)
  if (!tableWrapper) return
  
  const tableContainer = tableWrapper.querySelector('.table-container')
  const viewIcon = tableWrapper.querySelector('.table-view-icon')
  
  if (!tableContainer || !viewIcon) return
  
  const isCardView = tableContainer.classList.contains('card-view')
  
  if (isCardView) {
    // 切换回表格视图
    tableContainer.classList.remove('card-view')
    viewIcon.textContent = '📱'
    tableWrapper.setAttribute('title', '切换为卡片视图')
  } else {
    // 切换为卡片视图
    tableContainer.classList.add('card-view')
    viewIcon.textContent = '📊'
    tableWrapper.setAttribute('title', '切换为表格视图')
  }
}

// 全局表格复制函数
window.copyTable = function(tableId) {
  const table = document.getElementById(tableId)
  if (!table) return
  
  const copyIcon = document.querySelector(`[data-table-id="${tableId}"] .table-copy-icon`)
  
  try {
    let tableText = ''
    const rows = table.querySelectorAll('tr')
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td')
      const rowData = Array.from(cells).map(cell => cell.textContent.trim())
      tableText += rowData.join('\t') + '\n'
    })
    
    navigator.clipboard.writeText(tableText).then(() => {
      // 显示复制成功状态
      if (copyIcon) {
        copyIcon.textContent = '✓'
        copyIcon.style.color = '#10b981'
        
        setTimeout(() => {
          copyIcon.textContent = '📋'
          copyIcon.style.color = ''
        }, 2000)
      }
    }).catch(err => {
      console.error('表格复制失败:', err)
      if (copyIcon) {
        copyIcon.textContent = '✗'
        copyIcon.style.color = '#ef4444'
        
        setTimeout(() => {
          copyIcon.textContent = '📋'
          copyIcon.style.color = ''
        }, 2000)
      }
    })
  } catch (err) {
    console.error('表格复制失败:', err)
  }
}

// 全局图片lightbox函数
window.openImageLightbox = function(imageId, src, alt) {
  // 创建lightbox容器
  const lightbox = document.createElement('div')
  lightbox.className = 'image-lightbox'
  lightbox.innerHTML = `
    <div class="lightbox-backdrop" onclick="closeImageLightbox()"></div>
    <div class="lightbox-content">
      <button class="lightbox-close" onclick="closeImageLightbox()" title="关闭">×</button>
      <img src="${src}" alt="${alt}" class="lightbox-image">
      <div class="lightbox-info">
        <span class="lightbox-title">${alt || '图片'}</span>
        <div class="lightbox-actions">
          <button class="lightbox-action-btn" onclick="downloadImage('${src}', '${alt || 'image'}')" title="下载图片">
            📥
          </button>
          <button class="lightbox-action-btn" onclick="copyImageUrl('${src}')" title="复制图片链接">
            📋
          </button>
        </div>
      </div>
    </div>
  `
  
  document.body.appendChild(lightbox)
  
  // 添加动画效果
  requestAnimationFrame(() => {
    lightbox.classList.add('active')
  })
  
  // 阻止body滚动
  document.body.style.overflow = 'hidden'
  
  // 键盘事件
  const handleKeyboard = (e) => {
    if (e.key === 'Escape') {
      closeImageLightbox()
    }
  }
  
  document.addEventListener('keydown', handleKeyboard)
  lightbox.dataset.keyboardHandler = 'true'
}

window.closeImageLightbox = function() {
  const lightbox = document.querySelector('.image-lightbox')
  if (lightbox) {
    lightbox.classList.remove('active')
    setTimeout(() => {
      lightbox.remove()
      document.body.style.overflow = ''
    }, 300)
  }
  
  // 移除键盘事件监听
  document.removeEventListener('keydown', handleKeyboard)
}

window.downloadImage = function(src, filename) {
  const link = document.createElement('a')
  link.href = src
  link.download = filename || 'image'
  link.click()
}

window.copyImageUrl = function(src) {
  navigator.clipboard.writeText(src).then(() => {
    // 显示复制成功提示
    console.log('图片链接已复制')
  }).catch(err => {
    console.error('复制失败:', err)
  })
}

// 全局代码折叠函数
window.toggleCodeFold = function(blockId) {
  const blockWrapper = document.querySelector(`[data-block-id="${blockId}"]`)
  if (!blockWrapper) return
  
  const previewDiv = blockWrapper.querySelector('.code-preview')
  const fullDiv = blockWrapper.querySelector('.code-full')
  const foldBtn = blockWrapper.querySelector('.code-fold-btn')
  const foldIcon = foldBtn.querySelector('.fold-icon')
  const foldText = foldBtn.querySelector('.fold-text')
  
  if (!previewDiv || !fullDiv || !foldBtn) return
  
  const isExpanded = fullDiv.style.display !== 'none'
  
  if (isExpanded) {
    // 收起代码
    fullDiv.style.display = 'none'
    previewDiv.style.display = 'flex'
    foldIcon.textContent = '📄'
    foldText.textContent = `展开 (${fullDiv.querySelectorAll('.line-number').length} 行)`
    foldBtn.setAttribute('title', '展开代码')
  } else {
    // 展开代码
    fullDiv.style.display = 'flex'
    previewDiv.style.display = 'none'
    foldIcon.textContent = '📃'
    foldText.textContent = '收起'
    foldBtn.setAttribute('title', '收起代码')
  }
}

// 格式化消息（增强数学公式支持和错误处理）
const formatMessage = (content) => {
  if (!content || typeof content !== 'string') {
    console.warn('Invalid content for formatting:', content)
    return content || ''
  }
  
  try {
    // 处理数学公式
    let processedContent = String(content || '')
    
    // 处理块级数学公式 $$...$$（需要先处理，避免被行内公式处理）
    processedContent = processedContent.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
      try {
        if (!formula || !formula.trim()) {
          return `<div class="math-block math-error" title="空的数学公式">$$$$</div>`
        }
        
        const rendered = katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
          trust: true,
          strict: false,
          macros: {
            "\\R": "\\mathbb{R}",
            "\\C": "\\mathbb{C}",
            "\\N": "\\mathbb{N}",
            "\\Z": "\\mathbb{Z}",
            "\\Q": "\\mathbb{Q}"
          }
        })
        return `<div class="math-block" title="数学公式">${rendered}</div>`
      } catch (error) {
        console.warn('KaTeX block rendering error:', error.message)
        return `<div class="math-block math-error" title="数学公式解析错误: ${error.message}">$$${formula || ''}$$</div>`
      }
    })
    
    // 确保processedContent仍然是字符串
    processedContent = String(processedContent || '')
    
    // 处理行内数学公式 $...$
    processedContent = processedContent.replace(/\$([^$\n]+)\$/g, (match, formula) => {
      try {
        if (!formula || !formula.trim()) {
          return `<span class="math-inline math-error" title="空的数学公式">$$</span>`
        }
        
        const rendered = katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
          trust: true,
          strict: false,
          macros: {
            "\\R": "\\mathbb{R}",
            "\\C": "\\mathbb{C}",
            "\\N": "\\mathbb{N}",
            "\\Z": "\\mathbb{Z}",
            "\\Q": "\\mathbb{Q}"
          }
        })
        return `<span class="math-inline" title="数学公式">${rendered}</span>`
      } catch (error) {
        console.warn('KaTeX inline rendering error:', error.message)
        return `<span class="math-inline math-error" title="数学公式解析错误: ${error.message}">$${formula || ''}$</span>`
      }
    })
    
    // 确保processedContent仍然是字符串
    processedContent = String(processedContent || '')
    
    // 处理脚注（增强验证）
    processedContent = processedContent.replace(/\[\^([^\]]+)\]/g, (match, note) => {
      const sanitizedNote = note.replace(/[<>&"']/g, '')
      return `<sup class="footnote-ref"><a href="#footnote-${sanitizedNote}" title="脚注">[${sanitizedNote}]</a></sup>`
    })
    
    // 处理高亮文本 ==text==（防止XSS）
    processedContent = processedContent.replace(/==([^=]+)==/g, (match, text) => {
      const sanitizedText = text.replace(/[<>&"']/g, (char) => {
        const entityMap = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#39;'
        }
        return entityMap[char] || char
      })
      return `<mark class="markdown-highlight">${sanitizedText}</mark>`
    })
    
    // 处理删除线 ~~text~~（防止XSS）
    processedContent = processedContent.replace(/~~([^~]+)~~/g, (match, text) => {
      const sanitizedText = text.replace(/[<>&"']/g, (char) => {
        const entityMap = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#39;'
        }
        return entityMap[char] || char
      })
      return `<del class="markdown-strikethrough">${sanitizedText}</del>`
    })
    
    // 处理键盘快捷键 <kbd>text</kbd>
    processedContent = processedContent.replace(/<kbd>([^<]+)<\/kbd>/g, (match, key) => {
      return `<kbd class="markdown-kbd">${key}</kbd>`
    })
    
    // 处理徽章/标签 ![badge](text|color)
    processedContent = processedContent.replace(/!\[badge\]\(([^|]+)\|([^)]+)\)/g, (match, text, color) => {
      const badgeId = `badge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      return `<span class="markdown-badge" data-color="${color}" id="${badgeId}">${text}</span>`
    })
    
    // 处理进度条 [progress](value|max)
    processedContent = processedContent.replace(/\[progress\]\((\d+)\|(\d+)\)/g, (match, value, max) => {
      const percentage = Math.round((value / max) * 100)
      const progressId = `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      return `
        <div class="markdown-progress" id="${progressId}">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="progress-text">${value}/${max} (${percentage}%)</span>
        </div>
      `
    })
    
    // 处理警告框 > [!TYPE] title
    processedContent = processedContent.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/gm, (match, type, title) => {
      const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const iconMap = {
        NOTE: '📝',
        TIP: '💡',
        IMPORTANT: '❗',
        WARNING: '⚠️',
        CAUTION: '🚨'
      }
      return `<div class="markdown-alert alert-${type.toLowerCase()}" id="${alertId}">
        <div class="alert-header">
          <span class="alert-icon">${iconMap[type]}</span>
          <span class="alert-title">${title || type}</span>
        </div>
        <div class="alert-content">
      `
    })
    
    // 处理折叠内容 <details><summary>title</summary>content</details>
    processedContent = processedContent.replace(/<details>\s*<summary>([^<]+)<\/summary>\s*([\s\S]*?)\s*<\/details>/g, (match, title, content) => {
      const detailsId = `details-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      return `
        <details class="markdown-details" id="${detailsId}">
          <summary class="markdown-summary">
            <span class="summary-icon">▶</span>
            <span class="summary-text">${title || ''}</span>
          </summary>
          <div class="markdown-details-content">
            ${content || ''}
          </div>
        </details>
      `
    })
    
    // 最终确保processedContent是字符串
    processedContent = String(processedContent || '')
    
    // 使用marked解析，增强错误处理
    try {
      // 确保processedContent是字符串
      if (typeof processedContent !== 'string') {
        console.warn('ProcessedContent is not a string:', typeof processedContent, processedContent)
        processedContent = String(processedContent || '')
      }
      
      // 额外的字符串验证
      if (!processedContent || processedContent.trim() === '') {
        console.warn('ProcessedContent is empty after processing')
        return `<div class="markdown-error">处理后的内容为空：<pre>${content}</pre></div>`
      }
      
      const result = marked(processedContent)
      
      // 验证结果是否为空
      if (!result || result.trim() === '') {
        console.warn('Marked returned empty result for:', processedContent.substring(0, 100))
        return `<div class="markdown-error">内容解析失败，显示原文：<pre>${content}</pre></div>`
      }
      
      return result
    } catch (markedError) {
      console.error('Marked parsing error:', markedError)
      console.error('ProcessedContent type:', typeof processedContent)
      console.error('ProcessedContent value:', processedContent)
      return `<div class="markdown-error">
        <h4>Markdown解析错误</h4>
        <p>错误信息：${markedError.message}</p>
        <details>
          <summary>原始内容</summary>
          <pre>${content}</pre>
        </details>
        <details>
          <summary>处理后内容</summary>
          <pre>${String(processedContent || '')}</pre>
        </details>
      </div>`
    }
  } catch (error) {
    console.error('消息格式化失败:', error)
    return `<div class="markdown-error">
      <h4>消息格式化失败</h4>
      <p>错误信息：${error.message}</p>
      <details>
        <summary>原始内容</summary>
        <pre>${content}</pre>
      </details>
    </div>`
  }
}

// 添加消息
const addMessage = (type, content) => {
  // 确保content是字符串类型
  const safeContent = String(content || '')
  
  const message = {
    id: Date.now(),
    type,
    content: safeContent,
    formattedContent: type === 'ai' ? formatMessage(safeContent) : safeContent,
    timestamp: new Date(),
    folded: type === 'user' && safeContent.length > 200 // 超过200字符自动折叠
  }
  
  messages.push(message)
  
  nextTick(() => {
    scrollToBottom()
  })
  
  return message
}

// 发送消息
const sendMessage = async () => {
  if (!newMessage.value.trim() || isTyping.value) return
  
  const userMessage = newMessage.value.trim()
  newMessage.value = ''
  
  // 添加用户消息
  addMessage('user', userMessage)
  
  // 显示输入中状态
  isTyping.value = true
  
  try {
    // 模拟AI响应
    await simulateAIResponse(userMessage)
  } catch (error) {
    console.error('AI响应错误:', error)
    addMessage('ai', '抱歉，我遇到了一些问题。请稍后再试。')
  } finally {
    isTyping.value = false
  }
  
  // 触发消息更新事件
  emit('messages-updated', messages)
}

// 模拟AI响应
const simulateAIResponse = async (userMessage) => {
  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  let response = ''
  
  // 简单的响应逻辑
  if (userMessage.includes('代码') || userMessage.includes('code') || userMessage.includes('JavaScript') || userMessage.includes('函数')) {
    response = `我可以帮您处理代码相关的问题。这里是一个示例：

## JavaScript 示例

\`\`\`javascript
// 示例代码 - 这是一个较长的代码块来演示折叠功能
function calculateStatistics(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('数据必须是非空数组');
  }
  
  // 计算基本统计信息
  const sum = data.reduce((acc, val) => acc + val, 0);
  const mean = sum / data.length;
  
  // 计算方差
  const variance = data.reduce((acc, val) => {
    return acc + Math.pow(val - mean, 2);
  }, 0) / data.length;
  
  // 计算标准差
  const standardDeviation = Math.sqrt(variance);
  
  // 找到最大值和最小值
  const max = Math.max(...data);
  const min = Math.min(...data);
  
  // 计算中位数
  const sortedData = [...data].sort((a, b) => a - b);
  const median = sortedData.length % 2 === 0
    ? (sortedData[sortedData.length / 2 - 1] + sortedData[sortedData.length / 2]) / 2
    : sortedData[Math.floor(sortedData.length / 2)];
  
  return {
    count: data.length,
    sum,
    mean,
    variance,
    standardDeviation,
    max,
    min,
    median
  };
}

// 使用示例
const sampleData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const stats = calculateStatistics(sampleData);
console.log('统计结果:', stats);
\`\`\`

这段代码定义了一个统计函数，用于计算数据的基本统计信息。

### 关键概念

- **函数声明**：使用 \`function\` 关键字
- **模板字符串**：使用反引号和 \`\${}\` 语法
- **参数传递**：函数接收 \`data\` 参数
- **数组方法**：使用 \`reduce\`, \`sort\`, \`Math.max\` 等

> 💡 **提示**: 这是一个较长的代码块，您可以使用折叠功能来节省空间。点击代码块右上角的"展开"按钮可以查看完整代码。`
  } else if (userMessage.includes('优化')) {
    response = `关于优化，我有以下建议：

# 代码优化指南

## 1. 性能优化
- [x] 减少不必要的渲染
- [x] 使用缓存机制
- [ ] 优化算法复杂度
- [ ] 实现懒加载

## 2. 代码质量优化

| 方面 | 建议 | 优先级 |
|------|------|--------|
| 可读性 | 使用有意义的变量名 | 高 |
| 维护性 | 减少重复代码 | 中 |
| 扩展性 | 使用设计模式 | 中 |

### 具体示例

\`\`\`typescript
// 优化前
function calc(a, b) {
    return a + b;
}

// 优化后
function calculateSum(firstNumber: number, secondNumber: number): number {
    return firstNumber + secondNumber;
}
\`\`\`

> **注意**：优化应该基于实际的性能测试结果，避免过早优化。

---

需要我详细解释某个方面吗？

*斜体文本* 和 **粗体文本** 以及 ==高亮文本== 和 ~~删除文本~~

数学公式示例：$E = mc^2$ 和 $$\\int_{0}^{\\infty} e^{-x} dx = 1$$`
  } else if (userMessage.includes('bug') || userMessage.includes('错误')) {
    response = `# 🐛 调试指南

调试问题时，可以按照以下步骤：

## 1. 定位问题
- 查看错误信息
- 使用调试工具 <kbd>F12</kbd>
- 添加日志输出

## 2. 分析原因

<details>
<summary>常见错误类型</summary>

- **语法错误**：代码语法不正确
- **运行时错误**：代码执行时出现问题
- **逻辑错误**：代码逻辑不符合预期

</details>

## 3. 解决方案

\`\`\`bash
# 检查日志
tail -f /var/log/application.log

# 运行测试
npm test

# 代码格式化
npx prettier --write .
\`\`\`

> 💡 **调试技巧**：使用 \`console.log()\` 输出变量值，或者使用浏览器的断点调试功能。

### 调试工具推荐

1. **Chrome DevTools** - 浏览器内置工具
2. **VS Code Debugger** - 编辑器集成调试
3. **Console.log** - 简单快速的调试方式

具体是什么错误呢？请提供更多==详细信息==。

[调试文档链接](https://developer.mozilla.org/zh-CN/docs/Web/API/Console)`
  } else if (userMessage.includes('表格') || userMessage.includes('数据')) {
    response = `# 📊 数据展示示例

这里是一个数据表格的示例：

## 项目进度表

| 任务 | 负责人 | 状态 | 完成度 | 备注 |
|------|--------|------|--------|------|
| 前端开发 | 张三 | 进行中 | 80% | 预计明天完成 |
| 后端API | 李四 | 已完成 | 100% | 已测试通过 |
| 数据库设计 | 王五 | 已完成 | 100% | 已部署 |
| 测试用例 | 赵六 | 待开始 | 0% | 等待开发完成 |

## 待办事项

- [x] 需求分析
- [x] 技术选型
- [x] 架构设计
- [ ] 功能开发
- [ ] 测试验证
- [ ] 部署上线

### 关键指标

> **项目进度**：总体完成度为 **70%**
> 
> **预计完成时间**：2024年1月15日

---

需要了解更多数据分析的内容吗？`
  } else {
    response = `# 🤖 AI助手回复

我理解您的问题是关于"**${userMessage}**"。

## 相关信息

让我为您提供一些相关信息和建议：

### 功能特性

- ✅ **Markdown支持**：完整的markdown语法支持
- ✅ **代码高亮**：多种编程语言语法高亮
- ✅ **表格展示**：美观的数据表格显示
- ✅ **数学公式**：LaTeX数学公式渲染
- ✅ **任务列表**：交互式任务清单

### 示例展示

\`\`\`python
# Python 示例代码
def greet(name):
    """问候函数"""
    return f"Hello, {name}!"

print(greet("World"))
\`\`\`

> 这是一个引用块的示例，用于突出重要信息。

如果您需要更具体的帮助，请提供更多==详细信息==。

### 相关链接

- [Markdown语法指南](https://www.markdownguide.org/)
- [编程最佳实践](https://github.com/topics/best-practices)

*希望这些信息对您有帮助！*`
  }
  
  addMessage('ai', response)
  
  // 确保代码块渲染完成后初始化折叠功能
  await nextTick()
  setTimeout(() => {
    // 检查是否有新的代码块需要初始化
    const newCodeBlocks = document.querySelectorAll('.code-block-wrapper[data-block-id]')
    console.log('发现代码块数量:', newCodeBlocks.length)
  }, 100)
}

// 发送建议
const sendSuggestion = (suggestion) => {
  newMessage.value = suggestion
  sendMessage()
}

// 复制消息
const copyMessage = async (message) => {
  try {
    await navigator.clipboard.writeText(message.content)
    showNotification('消息已复制')
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 重新生成消息
const regenerateMessage = async (message) => {
  if (isTyping.value) return
  
  const index = messages.findIndex(m => m.id === message.id)
  if (index === -1 || index === 0) return
  
  const userMessage = messages[index - 1]
  if (userMessage.type !== 'user') return
  
  // 删除当前AI消息
  messages.splice(index, 1)
  
  // 重新发送
  isTyping.value = true
  
  try {
    await simulateAIResponse(userMessage.content)
  } catch (error) {
    console.error('重新生成失败:', error)
    addMessage('ai', '抱歉，重新生成失败。')
  } finally {
    isTyping.value = false
  }
}

// 清空消息
const clearMessages = () => {
  if (confirm('确定要清空所有对话记录吗？')) {
    messages.splice(0, messages.length)
    showNotification('对话已清空')
  }
}

// 批量折叠/展开所有长消息
const toggleAllMessagesFold = () => {
  const longMessages = messages.filter(msg => isLongUserMessage(msg))
  if (longMessages.length === 0) return
  
  // 检查是否所有长消息都已折叠
  const allFolded = longMessages.every(msg => msg.folded)
  
  // 如果全部已折叠，则展开所有；否则折叠所有
  longMessages.forEach(msg => {
    msg.folded = !allFolded
  })
  
  // 同时处理代码块折叠
  nextTick(() => {
    const codeBlocks = document.querySelectorAll('.code-block-wrapper.foldable')
    codeBlocks.forEach(block => {
      const blockId = block.dataset.blockId
      const fullDiv = block.querySelector('.code-full')
      if (fullDiv && blockId) {
        // 如果正在折叠消息，也折叠代码块
        if (allFolded) {
          if (fullDiv.style.display !== 'none') {
            window.toggleCodeFold(blockId)
          }
        }
      }
    })
  })
  
  showNotification(allFolded ? '所有长消息已展开' : '所有长消息已折叠')
}

// 测试代码块功能
const testCodeBlock = () => {
  const testResponse = `# 🧪 Markdown功能测试

## 1. 代码块测试

\`\`\`javascript
// 这是一个测试代码块，用于验证折叠功能
function testFunction() {
  console.log('第1行');
  console.log('第2行');
  console.log('第3行');
  console.log('第4行');
  console.log('第5行');
  console.log('第6行');
  console.log('第7行');
  console.log('第8行');
  console.log('第9行');
  console.log('第10行');
  console.log('第11行');
  console.log('第12行');
  console.log('第13行');
  console.log('第14行');
  console.log('第15行');
  return '测试完成';
}

testFunction();
\`\`\`

## 2. 数学公式测试

行内公式：$E = mc^2$ 和 $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

块级公式：
$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$

## 3. 表格测试

| 功能 | 状态 | 说明 |
|------|------|------|
| 代码块 | ✅ | 支持折叠和复制 |
| 数学公式 | ✅ | KaTeX渲染 |
| 表格 | ✅ | 响应式设计 |
| 图片 | ✅ | Lightbox展示 |

## 4. 扩展语法测试

- **高亮文本**：==重要内容==
- **删除线**：~~已删除的内容~~
- **键盘快捷键**：<kbd>Ctrl</kbd> + <kbd>C</kbd>
- **徽章**：![badge](完成|green) ![badge](测试|blue)
- **进度条**：[progress](75|100)

> [!TIP] 提示
> 这是一个提示框，用于显示重要信息。

<details>
<summary>点击展开更多信息</summary>
这是一个可折叠的内容区域，可以用来隐藏详细信息。
</details>

---

**测试完成！** 如果您看到这个消息且没有错误，说明Markdown解析功能正常工作。`
  
  addMessage('ai', testResponse)
}

// 处理Enter键
const handleEnterKey = (event) => {
  if (!event.shiftKey) {
    sendMessage()
  }
}

// 处理消息点击（如代码复制）
const handleMessageClick = (event) => {
  // 处理代码复制按钮点击
  if (event.target.classList.contains('code-copy-btn')) {
    event.preventDefault()
  }
}

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 显示通知
const showNotification = (message) => {
  // 简单的控制台日志，可以替换为更好的通知系统
  console.log(message)
}

// 检查是否为长用户消息
const isLongUserMessage = (message) => {
  return message.type === 'user' && message.content.length > 200
}

// 获取消息预览
const getMessagePreview = (content) => {
  return content.length > 100 ? content.substring(0, 100) + '...' : content
}

// 切换用户消息折叠状态
const toggleUserMessageFold = (message) => {
  message.folded = !message.folded
  // 触发重新渲染后滚动到合适位置
  nextTick(() => {
    if (!message.folded) {
      // 展开后确保消息可见
      const messageEl = document.querySelector(`[data-message-id="${message.id}"]`)
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  })
}

// 主题切换 - 使用terminal store
const toggleTheme = () => {
  // 在dark和fresh主题之间切换
  const currentTheme = terminalStore.currentTheme
  if (currentTheme === 'dark') {
    terminalStore.setTheme('fresh')
  } else {
    terminalStore.setTheme('dark')
  }
}

// 获取主题图标
const getThemeIcon = () => {
  switch (terminalStore.currentTheme) {
    case 'fresh': return '☀️'
    case 'dark': return '🌙'
    default: return '🔄'
  }
}

// 获取主题显示名称
const getThemeDisplayName = () => {
  switch (terminalStore.currentTheme) {
    case 'fresh': return '清心'
    case 'dark': return '深色'
    default: return '主题'
  }
}

// 更新代码高亮主题
const updateCodeHighlightTheme = () => {
  // 移除现有的highlight.js样式
  const existingLinks = document.querySelectorAll('link[href*="highlight.js"]')
  existingLinks.forEach(link => link.remove())
  
  // 添加对应主题的样式
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  const isDarkMode = terminalStore.currentTheme === 'dark'
  link.href = isDarkMode 
    ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
    : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
  
  // 确保CSS加载完成
  link.onload = () => {
    console.log('代码高亮主题已加载:', isDarkMode ? 'dark' : 'light')
  }
  
  document.head.appendChild(link)
}

// 自动调整输入框高度
const adjustTextareaHeight = () => {
  if (messageInput.value) {
    messageInput.value.style.height = 'auto'
    messageInput.value.style.height = messageInput.value.scrollHeight + 'px'
  }
}

// 监听消息输入变化
watch(newMessage, () => {
  nextTick(() => {
    adjustTextareaHeight()
  })
})

// 监听主题变化
watch(() => terminalStore.currentTheme, () => {
  updateCodeHighlightTheme()
})

// 处理键盘快捷键
const handleKeyboardShortcuts = (event) => {
  // Ctrl/Cmd + Shift + F: 批量折叠/展开
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'F') {
    event.preventDefault()
    toggleAllMessagesFold()
  }
  // Ctrl/Cmd + Shift + C: 清空对话
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'C') {
    event.preventDefault()
    clearMessages()
  }
}

// 新增：格式化时间
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 组件挂载
onMounted(() => {
  // 聚焦输入框
  messageInput.value?.focus()
  
  // 添加键盘快捷键监听
  document.addEventListener('keydown', handleKeyboardShortcuts)
  
  // 初始化代码高亮主题
  updateCodeHighlightTheme()
  
  // 加载KaTeX CSS
  const loadKatexCSS = () => {
    const existingKatexLink = document.querySelector('link[href*="katex"]')
    if (!existingKatexLink) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.css'
      link.onload = () => {
        console.log('KaTeX CSS loaded successfully')
      }
      link.onerror = () => {
        console.error('Failed to load KaTeX CSS')
      }
      document.head.appendChild(link)
    }
  }
  
  loadKatexCSS()
  
  // 清理监听器
  return () => {
    document.removeEventListener('keydown', handleKeyboardShortcuts)
  }
})
</script>

<style scoped>
/* CSS变量定义 - 使用Element Plus变量 */
.ai-chat {
  --bg-primary: var(--el-bg-color);
  --bg-secondary: var(--el-bg-color-page);
  --bg-tertiary: var(--el-bg-color-overlay);
  --bg-hover: var(--el-fill-color);
  --text-primary: var(--el-text-color-primary);
  --text-secondary: var(--el-text-color-secondary);
  --text-placeholder: var(--el-text-color-placeholder);
  --border-color: var(--el-border-color);
  --border-hover: var(--el-border-color-hover);
  --accent-color: var(--el-color-primary);
  --accent-hover: var(--el-color-primary-light-3);
}

/* 深色主题特定样式 */
.ai-chat.dark-theme {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

/* 清心主题特定样式 */
.ai-chat.fresh-theme {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

/* 主容器 */
.ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
}



/* 波纹效果 */
.ripple {
  position: relative;
  overflow: hidden;
}

.ripple::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.ripple:active::after {
  width: 200px;
  height: 200px;
}

/* 3D卡片效果 */
.card-3d {
  transform-style: preserve-3d;
  transition: transform 0.3s;
}

.card-3d:hover {
  transform: rotateY(3deg) rotateX(-3deg);
}

/* 普通滚动条 */
.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
  transition: background 0.2s;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 主题切换动画 */
.ai-chat {
  transition: 
    background-color 0.3s ease,
    color 0.3s ease,
    border-color 0.3s ease;
}

.ai-chat * {
  transition: 
    background-color 0.3s ease,
    color 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}

/* 消息列表容器 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}

.messages-container {
  max-width: 800px;
  margin: 0 auto;
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.empty-content {
  max-width: 500px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.empty-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 10px;
}

.empty-subtitle {
  color: var(--text-secondary);
  margin-bottom: 30px;
}

.suggestion-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.suggestion-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.suggestion-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-2px);
}

.suggestion-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.suggestion-text {
  font-size: 14px;
  color: var(--text-primary);
}

/* 消息样式 */
.message-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.message-item {
  animation: fadeIn 0.3s ease-in;
}

.message-item.user-message {
  display: flex;
  justify-content: flex-end;
}

.message-item.ai-message {
  display: flex;
  justify-content: flex-start;
}

.message-item.user-message .user-message-content {
  max-width: 70%;
}

.message-item.ai-message .ai-message-content {
  max-width: 100%;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-message-content {
  width: 100%;
  border-radius: 18px;
  border: 1px solid var(--accent-color);
  background: var(--accent-color);
  transition: all 0.2s ease;
  color: white;
}

.user-message-content:hover {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ai-message-content {
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 0;
  margin: 8px 0;
}

.ai-message-content:hover {
  background: transparent;
}

.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 18px 18px 0 0;
}

.message-header .message-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.user-avatar {
  background: var(--accent-color);
  color: white;
}

.ai-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.message-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.message-author {
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.message-time,
.message-status {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.message-content {
  padding: 16px;
  line-height: 1.6;
}

.ai-message-content .message-content {
  padding: 8px 0;
  background: transparent;
  position: relative;
}

.ai-message-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.ai-message-content:hover .ai-message-actions {
  opacity: 1;
}

.ai-message-actions .action-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-secondary);
}

.ai-message-actions .action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.user-text {
  color: white;
  font-size: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-folded .user-text {
  position: relative;
  overflow: hidden;
  max-height: 100px;
}

.message-folded .user-text::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20px;
  background: linear-gradient(transparent, var(--accent-color));
  pointer-events: none;
}

.ai-text {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.7;
  word-wrap: break-word;
}

.markdown-content {
  line-height: 1.7;
}

.message-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.message-header:hover .message-actions {
  opacity: 1;
}

.action-btn,
.fold-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-btn:hover,
.fold-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-color: rgba(255, 255, 255, 0.5);
}

/* 输入中指示器 */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.typing-indicator::before {
  content: 'AI正在思考';
  margin-right: 8px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(1) {
  animation-delay: 0s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 输入区域 */
.input-container {
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
  backdrop-filter: blur(10px);
}

.input-wrapper {
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
}

.input-area {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 12px 16px;
  transition: all 0.2s ease;
}

.input-area:focus-within {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(0, 132, 255, 0.1);
}

.message-input {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  max-height: 120px;
  min-height: 20px;
  font-family: inherit;
}

.message-input::placeholder {
  color: var(--text-placeholder);
}

.send-btn {
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 132, 255, 0.3);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid var(--border-color);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-select {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 14px;
  outline: none;
  cursor: pointer;
}

.toolbar-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 18px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.theme-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 60px;
}

.theme-icon {
  font-size: 16px;
}

.theme-label {
  font-size: 12px;
  font-weight: 500;
}

/* Markdown内容样式 */
.markdown-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary);
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  margin: 20px 0 12px 0;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-content h1 {
  font-size: 1.8em;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 8px;
}

.markdown-content h2 {
  font-size: 1.5em;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 6px;
}

.markdown-content h3 {
  font-size: 1.3em;
}

.markdown-content p {
  margin: 12px 0;
}

.markdown-content ul,
.markdown-content ol {
  margin: 12px 0;
  padding-left: 24px;
}

.markdown-content li {
  margin: 4px 0;
}

.markdown-content blockquote {
  margin: 16px 0;
  padding: 12px 16px;
  border-left: 4px solid var(--accent-color);
  background: var(--bg-primary);
  border-radius: 0 6px 6px 0;
  font-style: italic;
  color: var(--text-secondary);
}

.markdown-content hr {
  margin: 24px 0;
  border: none;
  border-top: 1px solid var(--border-color);
}

/* 代码块样式 */
.markdown-content :deep(.code-block-wrapper) {
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.markdown-content :deep(.code-block-wrapper.foldable) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.markdown-content :deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.markdown-content :deep(.code-language) {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  font-weight: 600;
}

.markdown-content :deep(.code-actions) {
  display: flex;
  gap: 8px;
  align-items: center;
}

.markdown-content :deep(.code-fold-btn) {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.markdown-content :deep(.code-fold-btn:hover) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.markdown-content :deep(.code-fold-btn .fold-icon) {
  font-size: 14px;
}

.markdown-content :deep(.code-fold-btn .fold-text) {
  font-size: 11px;
  white-space: nowrap;
}

.markdown-content :deep(.code-copy-btn) {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.markdown-content :deep(.code-copy-btn:hover) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.markdown-content :deep(.code-copy-btn .copy-icon) {
  font-size: 12px;
  line-height: 1;
}

.markdown-content :deep(.code-copy-btn .copy-text) {
  font-size: 11px;
  line-height: 1;
}

.markdown-content :deep(.code-content) {
  position: relative;
}

.markdown-content :deep(.code-preview) {
  display: flex;
  position: relative;
}

.markdown-content :deep(.code-preview.collapsed) {
  max-height: 200px;
  overflow: hidden;
}

.markdown-content :deep(.code-full) {
  display: none;
}

.markdown-content :deep(.code-fade-overlay) {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(transparent, var(--bg-primary));
  pointer-events: none;
}

.markdown-content :deep(pre) {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.markdown-content :deep(code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.markdown-content :deep(.hljs) {
  background: var(--bg-primary) !important;
  color: var(--text-primary) !important;
}

/* 内联代码样式 */
.markdown-content :deep(code:not(.hljs)) {
  background: var(--bg-primary);
  color: var(--accent-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  border: 1px solid var(--border-color);
}

/* 代码块行号样式 */
.markdown-content :deep(.line-numbers) {
  width: 40px;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  text-align: right;
  padding: 14px 8px;
  user-select: none;
  border-right: 1px solid var(--border-color);
  font-size: 12px;
}

.markdown-content :deep(.line-number) {
  display: block;
  line-height: 1.5;
}

/* 表格样式 */
.markdown-content :deep(.table-wrapper) {
  margin: 16px 0;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.markdown-content :deep(.table-toolbar) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.markdown-content :deep(.table-info) {
  display: flex;
  align-items: center;
  gap: 8px;
}

.markdown-content :deep(.table-title) {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.markdown-content :deep(.table-actions) {
  display: flex;
  gap: 6px;
}

.markdown-content :deep(.table-action-btn) {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.markdown-content :deep(.table-action-btn:hover) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.markdown-content :deep(.table-container) {
  overflow-x: auto;
}

.markdown-content :deep(.markdown-table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: var(--bg-primary);
}

.markdown-content :deep(.markdown-table th) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-weight: 600;
  padding: 12px 14px;
  text-align: left;
  border-bottom: 2px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1;
}

.markdown-content :deep(.markdown-table td) {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  vertical-align: top;
}

.markdown-content :deep(.markdown-table tr:nth-child(even)) {
  background: var(--bg-secondary);
}

.markdown-content :deep(.markdown-table tr:hover) {
  background: var(--bg-hover);
}

/* 表格卡片视图 */
.markdown-content :deep(.table-container.card-view) {
  overflow-x: visible;
}

.markdown-content :deep(.table-container.card-view .markdown-table) {
  display: none;
}

.markdown-content :deep(.table-container.card-view::after) {
  content: '';
  display: block;
  clear: both;
}

.markdown-content :deep(.table-container.card-view .markdown-table thead) {
  display: none;
}

.markdown-content :deep(.table-container.card-view .markdown-table tbody) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.markdown-content :deep(.table-container.card-view .markdown-table tr) {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.markdown-content :deep(.table-container.card-view .markdown-table tr:hover) {
  background: var(--bg-hover);
}

.markdown-content :deep(.table-container.card-view .markdown-table td) {
  padding: 4px 0;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.markdown-content :deep(.table-container.card-view .markdown-table td::before) {
  content: attr(data-label);
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 80px;
  font-size: 12px;
}

/* 响应式表格 */
@media (max-width: 768px) {
  .markdown-content :deep(.table-wrapper) {
    margin: 12px -12px;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
  
  .markdown-content :deep(.table-toolbar) {
    padding: 6px 12px;
  }
  
  .markdown-content :deep(.table-container) {
    max-height: 400px;
    overflow-y: auto;
  }
  
  .markdown-content :deep(.markdown-table) {
    font-size: 13px;
  }
  
  .markdown-content :deep(.markdown-table th),
  .markdown-content :deep(.markdown-table td) {
    padding: 8px 10px;
  }
}

/* 链接样式 */
.markdown-content :deep(a) {
  color: var(--accent-color);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.2s;
}

.markdown-content :deep(a:hover) {
  border-bottom-color: var(--accent-color);
  text-decoration: none;
}

.markdown-content :deep(a:visited) {
  color: var(--accent-hover);
}

/* 图片样式 */
.markdown-content :deep(.image-wrapper) {
  position: relative;
  display: inline-block;
  margin: 8px 0;
}

.markdown-content :deep(.image-wrapper:hover .image-overlay) {
  opacity: 1;
}

.markdown-content :deep(.markdown-image) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
  display: block;
}

.markdown-content :deep(.markdown-image:hover) {
  transform: scale(1.02);
}

.markdown-content :deep(.image-overlay) {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.markdown-content :deep(.image-zoom-icon) {
  font-size: 14px;
}

/* Lightbox样式 */
:deep(.image-lightbox) {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

:deep(.image-lightbox.active) {
  opacity: 1;
  visibility: visible;
}

:deep(.lightbox-backdrop) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(5px);
}

:deep(.lightbox-content) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 90%;
  max-height: 90%;
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

:deep(.lightbox-close) {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  z-index: 1;
  transition: background 0.2s;
}

:deep(.lightbox-close:hover) {
  background: rgba(0, 0, 0, 0.9);
}

:deep(.lightbox-image) {
  max-width: 100%;
  max-height: 80vh;
  display: block;
  object-fit: contain;
}

:deep(.lightbox-info) {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:deep(.lightbox-title) {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

:deep(.lightbox-actions) {
  display: flex;
  gap: 8px;
}

:deep(.lightbox-action-btn) {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

:deep(.lightbox-action-btn:hover) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

/* 移动端lightbox适配 */
@media (max-width: 768px) {
  :deep(.lightbox-content) {
    max-width: 95%;
    max-height: 95%;
  }
  
  :deep(.lightbox-image) {
    max-height: 70vh;
  }
  
  :deep(.lightbox-info) {
    padding: 8px 12px;
  }
}

/* 任务列表样式 */
.markdown-content :deep(.task-list-item) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 0;
  list-style: none;
}

.markdown-content :deep(.task-checkbox) {
  margin-top: 2px;
  cursor: default;
}

.markdown-content :deep(.task-checkbox:checked + .task-text) {
  text-decoration: line-through;
  color: var(--text-secondary);
}

/* 高亮文本样式 */
.markdown-content :deep(mark) {
  background: linear-gradient(120deg, #ffd700 0%, #ffed4a 100%);
  color: #000;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 500;
}

/* 删除线样式 */
.markdown-content :deep(del) {
  text-decoration: line-through;
  color: var(--text-secondary);
  opacity: 0.7;
}

/* 强调样式 */
.markdown-content :deep(strong) {
  font-weight: 600;
  color: var(--text-primary);
}

.markdown-content :deep(em) {
  font-style: italic;
  color: var(--text-secondary);
}

/* 数学公式样式 */
.markdown-content :deep(.math-inline) {
  display: inline-block;
  vertical-align: middle;
  margin: 0 2px;
  color: var(--text-primary);
}

.markdown-content :deep(.math-block) {
  display: block;
  margin: 16px 0;
  padding: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  text-align: center;
  overflow-x: auto;
  color: var(--text-primary);
}

.markdown-content :deep(.math-error) {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9em;
}

.markdown-content :deep(.math-error.math-inline) {
  padding: 2px 6px;
  border-radius: 4px;
}

.markdown-content :deep(.math-error.math-block) {
  padding: 12px;
  border-radius: 6px;
  font-style: italic;
}

/* KaTeX CSS变量适配 */
.markdown-content :deep(.katex) {
  font-size: 1.1em !important;
  color: var(--text-primary) !important;
}

.markdown-content :deep(.katex-display) {
  margin: 0 !important;
}

.markdown-content :deep(.katex .mord) {
  color: var(--text-primary) !important;
}

.markdown-content :deep(.katex .mop) {
  color: var(--accent-color) !important;
}

.markdown-content :deep(.katex .mbin) {
  color: var(--text-secondary) !important;
}

  .markdown-content :deep(.katex .mrel) {
    color: var(--text-secondary) !important;
  }
  
  /* 错误处理样式 */
  .markdown-content :deep(.markdown-error) {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 16px;
    margin: 16px 0;
    color: #dc2626;
  }
  
  .markdown-content :deep(.markdown-error h4) {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #dc2626;
  }
  
  .markdown-content :deep(.markdown-error p) {
    margin: 0 0 8px 0;
    font-size: 13px;
    line-height: 1.4;
  }
  
  .markdown-content :deep(.markdown-error details) {
    margin-top: 8px;
  }
  
  .markdown-content :deep(.markdown-error summary) {
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: #7c2d12;
    margin-bottom: 4px;
  }
  
  .markdown-content :deep(.markdown-error summary:hover) {
    color: #dc2626;
  }
  
  .markdown-content :deep(.markdown-error pre) {
    background: #fef7ff;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 8px;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 11px;
    overflow-x: auto;
    color: #374151;
    max-height: 200px;
    overflow-y: auto;
  }
  
  /* 深色主题下的错误样式 */
  .ai-chat.dark-theme .markdown-content :deep(.markdown-error) {
    background: #450a0a;
    border-color: #7f1d1d;
    color: #fca5a5;
  }
  
  .ai-chat.dark-theme .markdown-content :deep(.markdown-error h4) {
    color: #fca5a5;
  }
  
  .ai-chat.dark-theme .markdown-content :deep(.markdown-error summary) {
    color: #fed7aa;
  }
  
  .ai-chat.dark-theme .markdown-content :deep(.markdown-error summary:hover) {
    color: #fca5a5;
  }
  
  .ai-chat.dark-theme .markdown-content :deep(.markdown-error pre) {
    background: #1f2937;
    border-color: #374151;
    color: #d1d5db;
  }

/* 扩展语法样式 */
.markdown-content :deep(.markdown-kbd) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.85em;
  border: 1px solid var(--border-color);
  border-bottom: 2px solid var(--border-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.markdown-content :deep(.markdown-badge) {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--accent-color);
  color: white;
  margin: 0 2px;
}

.markdown-content :deep(.markdown-badge[data-color="red"]) {
  background: #ef4444;
}

.markdown-content :deep(.markdown-badge[data-color="green"]) {
  background: #10b981;
}

.markdown-content :deep(.markdown-badge[data-color="blue"]) {
  background: #3b82f6;
}

.markdown-content :deep(.markdown-badge[data-color="yellow"]) {
  background: #f59e0b;
  color: #000;
}

.markdown-content :deep(.markdown-badge[data-color="purple"]) {
  background: #8b5cf6;
}

.markdown-content :deep(.markdown-badge[data-color="pink"]) {
  background: #ec4899;
}

.markdown-content :deep(.markdown-badge[data-color="gray"]) {
  background: #6b7280;
}

.markdown-content :deep(.markdown-progress) {
  margin: 12px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.markdown-content :deep(.progress-bar) {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.markdown-content :deep(.progress-fill) {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-hover));
  border-radius: 3px;
  transition: width 0.3s ease;
}

.markdown-content :deep(.progress-text) {
  font-size: 0.9em;
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 80px;
}

.markdown-content :deep(.markdown-alert) {
  margin: 16px 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid;
}

.markdown-content :deep(.alert-header) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 0.9em;
}

.markdown-content :deep(.alert-content) {
  padding: 12px;
  background: var(--bg-primary);
}

.markdown-content :deep(.alert-note) {
  border-color: #3b82f6;
  background: #eff6ff;
}

.markdown-content :deep(.alert-note .alert-header) {
  background: #dbeafe;
  color: #1e40af;
}

.markdown-content :deep(.alert-tip) {
  border-color: #10b981;
  background: #f0fdf4;
}

.markdown-content :deep(.alert-tip .alert-header) {
  background: #d1fae5;
  color: #065f46;
}

.markdown-content :deep(.alert-important) {
  border-color: #8b5cf6;
  background: #faf5ff;
}

.markdown-content :deep(.alert-important .alert-header) {
  background: #ede9fe;
  color: #6b21a8;
}

.markdown-content :deep(.alert-warning) {
  border-color: #f59e0b;
  background: #fffbeb;
}

.markdown-content :deep(.alert-warning .alert-header) {
  background: #fef3c7;
  color: #92400e;
}

.markdown-content :deep(.alert-caution) {
  border-color: #ef4444;
  background: #fef2f2;
}

.markdown-content :deep(.alert-caution .alert-header) {
  background: #fecaca;
  color: #991b1b;
}

.markdown-content :deep(.markdown-details) {
  margin: 16px 0;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.markdown-content :deep(.markdown-summary) {
  padding: 12px;
  background: var(--bg-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  transition: background 0.2s;
}

.markdown-content :deep(.markdown-summary:hover) {
  background: var(--bg-hover);
}

.markdown-content :deep(.summary-icon) {
  font-size: 12px;
  transition: transform 0.2s;
}

.markdown-content :deep(.markdown-details[open] .summary-icon) {
  transform: rotate(90deg);
}

.markdown-content :deep(.markdown-details-content) {
  padding: 12px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
}

/* 深色主题下的警告框适配 */
.ai-chat.dark-theme .markdown-content :deep(.alert-note) {
  background: #1e3a8a;
  border-color: #3b82f6;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-note .alert-header) {
  background: #1e40af;
  color: #dbeafe;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-tip) {
  background: #064e3b;
  border-color: #10b981;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-tip .alert-header) {
  background: #065f46;
  color: #d1fae5;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-important) {
  background: #581c87;
  border-color: #8b5cf6;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-important .alert-header) {
  background: #6b21a8;
  color: #ede9fe;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-warning) {
  background: #78350f;
  border-color: #f59e0b;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-warning .alert-header) {
  background: #92400e;
  color: #fef3c7;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-caution) {
  background: #7f1d1d;
  border-color: #ef4444;
}

.ai-chat.dark-theme .markdown-content :deep(.alert-caution .alert-header) {
  background: #991b1b;
  color: #fecaca;
}

/* 脚注样式 */
.markdown-content :deep(.footnote-ref) {
  color: var(--accent-color);
  font-size: 0.8em;
}

.markdown-content :deep(.footnote-ref a) {
  color: inherit;
  text-decoration: none;
}

.markdown-content :deep(.footnote-ref a:hover) {
  text-decoration: underline;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .message-header {
    padding: 8px 12px;
  }
  
  .message-content {
    padding: 12px;
  }
  
  .message-avatar {
    width: 28px;
    height: 28px;
    font-size: 14px;
  }
  
  .input-wrapper {
    padding: 12px;
  }
  
  .input-area {
    padding: 10px 12px;
  }
  
  .toolbar {
    padding: 6px 12px;
  }
  
  .toolbar-btn {
    padding: 3px 6px;
    font-size: 16px;
  }
  
  .theme-label {
    display: none;
  }
}



/* 打印样式 */
@media print {
  .ai-chat {
    background: white;
    color: black;
  }

  .input-wrapper,
  .toolbar {
    display: none;
  }

  .message-bubble {
    border: 1px solid #ccc;
  }

  .message-text :deep(.code-block-wrapper) {
    border: 1px solid #ccc;
  }

  .message-text :deep(.markdown-table) {
    border: 1px solid #ccc;
  }

  .message-text :deep(.markdown-table th, .markdown-table td) {
    border: 1px solid #ccc;
  }
}
</style>