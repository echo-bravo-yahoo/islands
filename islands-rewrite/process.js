import { globals } from './index.js'
// flag to determine if we should run cleanup code
let dirty = true

async function cleanUp() {
  if (dirty) {
    dirty = false
    let promises = []
    for (const module in globals.modules) {
      promises.push(globals.modules[module].cleanUp)
    }
    await Promise.all(promises)

    globals.logger.info({ role: 'breadcrumb' }, 'Disconnecting from AWS IoT...')
    await globals.connection.disconnect()
    globals.logger.info({ role: 'breadcrumb' }, 'Disconnected from AWS IoT.')
  }
}

export function setupProcess(process) {
  process.on('exit', cleanUp)

  process.on('SIGTERM', (signal) => {
    globals.logger.info({ role: 'breadcrumb' }, `Process ${process.pid} received a SIGTERM signal.`)
    process.exit(0)
  })

  process.on('SIGINT', async (signal) => {
    globals.logger.info({ role: 'breadcrumb' }, `Process ${process.pid} has been interrupted.`)
    await cleanUp()
    process.exit(0)
  })

  process.on('uncaughtException', async (err) => {
    globals.logger.fatal({ err }, 'Uncaught Exception. Terminating now.')
    await cleanUp()
    process.exit(1)
  })
}
