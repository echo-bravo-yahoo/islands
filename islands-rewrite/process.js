import { globals } from './index.js'
import client from 'prom-client'
import { createServer } from 'http'

let server

function setupMetrics() {
  const registry = new client.Registry()
  client.collectDefaultMetrics({
    register: registry,
    labels: { island: globals.name }
  });

  const info = new client.Gauge({
    name: 'island_info',
    help: 'information about this island',
    labelNames: ['island', 'version'],
    registers: [registry]
  })

  // pattern blatantly stolen from:
  // https://www.robustperception.io/exposing-the-software-version-to-prometheus
  info.set({ version: globals.version, island: globals.name }, 1)

  new client.Gauge({
    name: 'uptime',
    help: 'uptime of the islands process in seconds',
    labelNames: ['island'],
    registers: [registry],
    collect() { this.set({ island: globals.name }, Math.floor(process.uptime())) }
  })

  server = createServer()
  server.on("request", async (request, response) => {
    switch (request.url) {
      case "/metrics":
        response.setHeader("content-type", "application/json")
        response.end(await registry.metrics())
        break
      default:
        response.statusCode = 404
        response.setHeader("content-type", "application/json")
        response.end("{ error: page_not_found }")
    }
  })
  server.listen(9091, () => {
    console.log(`serving prometheus metrics at port ${9091}`)
  })
}

// flag to determine if we should run cleanup code
let dirty = true
let heartbeatHandle

// pino.flush(cb) never calls the cb function, and it appears to flush fine without it
async function cleanUp() {
  if (dirty) {
    dirty = false

    // should implement real connection draining
    server.close()
    if (server.closeAllConnections)
      server.closeAllConnections()

    let promises = []
    for (const module in globals.modules) {
      promises.push(globals.modules[module].cleanUp)
    }
    await Promise.all(promises)

    clearInterval(heartbeatHandle)

    globals.logger.info({ role: 'breadcrumb' }, 'Disconnecting from AWS IoT as part of process cleanup...')
    await globals.connection.disconnect()
    globals.logger.info({ role: 'breadcrumb' }, 'Disconnected from AWS IoT as part of process cleanup.')
  }
}

export function setupHeartbeat(interval=60000) {
  if (!heartbeatHandle) {
    heartbeatHandle = setInterval(() => {
    }, interval)
  }
}

export function setupProcess(process) {
  setupMetrics()

  process.on('exit', cleanUp)

  process.on('SIGTERM', (signal) => {
    globals.logger.info({ role: 'breadcrumb' }, `Process ${process.pid} received SIGTERM signal. Terminating.`)
    process.exit(1)
  })

  process.on('SIGINT', async (signal) => {
    globals.logger.info({ role: 'breadcrumb' }, `Process ${process.pid} received SIGINT signal. Terminating.`)
    await cleanUp()
    process.exit(1)
  })

  process.on('uncaughtException', async (err) => {
    globals.logger.fatal({ err }, 'Uncaught Exception. Terminating now.')
    await cleanUp()
    process.exit(1)
  })
}
