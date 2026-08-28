import { createApp } from './app'
import { PORT } from './config'

const { app } = createApp()
app.listen(PORT)

console.log(`[server] listening on http://localhost:${app.server?.port}`)
