import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { config } from 'dotenv'

// 加载环境变量
config()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [vue()],
    define: {
      'import.meta.env.VITE_DEEPSEEK_API_KEY': JSON.stringify(process.env.VITE_DEEPSEEK_API_KEY || '')
    },
    build: {
      rollupOptions: {
        external: [
          'ssh2',
          'net',
          'fs',
          'path',
          'crypto',
          'stream',
          'child_process',
          'os',
          'util',
          'events'
        ]
      }
    }
  }
})
