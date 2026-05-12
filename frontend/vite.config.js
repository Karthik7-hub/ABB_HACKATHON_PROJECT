import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

const extraAllowedHosts = (process.env.VITE_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'empty-yak-0.loca.lt',
      '.loca.lt',
      ...extraAllowedHosts,
    ],
  }
})
