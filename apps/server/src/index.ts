import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'

const PORT = Number(process.env.PORT ?? 3001)

const app = new Elysia()
  .use(cors({ origin: true }))
  .get('/health', () => ({ ok: true, service: 'slave-card-game', ts: Date.now() }))
  .ws('/ws', {
    open(ws) {
      ws.send({ type: 'hello', payload: { id: ws.id } })
    },
    message(ws, message) {
      ws.send({ type: 'echo', payload: message })
    },
  })
  .listen(PORT)

console.log(`[server] listening on http://localhost:${app.server?.port}`)
