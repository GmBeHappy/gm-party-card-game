import { createApp } from './app'
import { CONFIG_ERROR, PORT } from './config'

if (CONFIG_ERROR !== null) {
  console.error(`[server] refusing to start: ${CONFIG_ERROR}`)
  process.exit(1)
}

const { app } = createApp()
app.listen(PORT)

console.log(`[server] listening on http://localhost:${app.server?.port}`)
