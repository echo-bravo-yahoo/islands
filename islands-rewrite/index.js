import { setupShadow } from './shadow.js'
import { buildConnection } from './mqtt.js'
import { setupProcess } from './process.js'
import bme280 from './modules/bme280.js'
import loggerFactory from 'pino'

export const globals = {
  shadow: undefined,
  connection: undefined,
  modules: [ bme280 ],
  name: 'desktop',
  logger: loggerFactory({ level: 'debug' })
}

globals.logger.info({ role: 'breadcrumb' }, 'Connecting...')
globals.connection = buildConnection()
await globals.connection.connect()
globals.logger.info({ role: 'breadcrumb' }, 'Connection completed.')

await setupShadow()

globals.logger.info({ role: 'breadcrumb' }, 'Registering modules...')
const promises = []
globals.modules.forEach((module) => {
  promises.push(module.register())
})
await Promise.all(promises)
globals.logger.info({ role: 'breadcrumb' }, 'Registration completed.')

// set up error handling and exit codes
setupProcess(process)

// this non-resolved promise keeps the process running
const shouldRun = new Promise(() => {})
