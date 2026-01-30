import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // THÊM DÒNG NÀY: Cho phép truy cập từ mạng nội bộ
    port: 5173
  }
})