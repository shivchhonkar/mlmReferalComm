import express from 'express'
import next from 'next'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'node:path'

const dev = process.env.NODE_ENV !== 'production'
const PORT = Number(process.env.PORT || 4000)
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4001'

const appDir = path.join(process.cwd(), 'frontend')
const nextApp = next({ dev, dir: appDir })
const handle = nextApp.getRequestHandler()

async function start() {
  await nextApp.prepare()

  const app = express()

  app.use(
    '/api',
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      pathRewrite: { '^/api': '/api' },
      logLevel: 'warn',
    }),
  )

  app.use(
    '/health',
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      logLevel: 'warn',
    }),
  )

  app.use(
    '/uploads',
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      logLevel: 'warn',
    }),
  )

  app.all('*', (req, res) => handle(req, res))

  app.listen(PORT, () => {
    console.log(`[Root] Frontend + API available on http://localhost:${PORT}`)
    console.log(`[Root] Proxying /api, /health, /uploads to ${BACKEND_URL}`)
  })
}

start().catch((err) => {
  console.error('Failed to start root server:', err)
  process.exit(1)
})
