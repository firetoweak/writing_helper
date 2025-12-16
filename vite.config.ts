// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 允许局域网访问 (可选)
    host: '0.0.0.0', 
    proxy: {
      '/api': {
        target: 'http://60.13.232.228:2643',
        // 关键设置：修改请求头的 Origin 为目标 URL，
        // 很多后端/Nginx 只有开启这个才能通过跨域检查
        changeOrigin: true, 
        
        // 如果后端不需要 /api 前缀，需要用 rewrite 去掉（根据你的代码，你的后端是需要 /api 的，所以这里不需要 rewrite）
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})