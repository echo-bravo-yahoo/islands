import { spawn } from 'child_process'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const config = require('./config.json')

import { setupShadow, getInitialShadowState } from './shadow.js'
import { buildConnection } from './mqtt.js'
import { setupProcess, setupHeartbeat } from './process.js'

import bme280 from './modules/bme280.js'
import bme680 from './modules/bme680.js'
import switchbots from './modules/switchbots.js'
import thermalPrinter from './modules/thermal-printer.js' // no virtual mode
import infrared from './modules/infrared.js'
import nec from './modules/nec.js'
import island from './modules/island.js'
import scripts from './modules/scripts.js'
import mitsubishiAC from './modules/mitsubishi-ac.js' // no virtual mode

import loggerFactory from 'pino'

export const globals = {
  shadow: undefined,
  connection: undefined,
  modules: [ bme280, bme680, thermalPrinter, switchbots, infrared, nec, mitsubishiAC ],
  configs: [ island, scripts ],
  // TODO: figure out how to remove this without breaking initial bootstrapping
  name: config.name,
  logger: loggerFactory({ level: 'debug' })
}

// set up error handling and exit codes
setupProcess(process)
setupHeartbeat()

globals.connection = buildConnection()
await globals.connection.connect()

// this is necessary for modules to know everything all at once, instead of
// them trying to piece things together from multiple deltas
await getInitialShadowState()

// then register the other stuff
await setupShadow()

globals.logger.info({role: 'breadcrumb' }, 'Identifying application version...')
const commitNumber = spawn('git', ['rev-list', '--count', 'HEAD'])
commitNumber.stdout.on('data', (data) => {
  const version = Number(data)
  globals.configs[0].setState('version', version)
  globals.logger.info({role: 'breadcrumb' }, `Identified application version: ${version}`)
})

globals.logger.info({ role: 'breadcrumb' }, 'Registering modules...')
const promises = []
globals.modules.forEach((module) => {
  if (module.register) promises.push(module.register())
})
await Promise.all(promises)
globals.logger.info({ role: 'breadcrumb' }, 'Registration completed.')

// this non-resolved promise keeps the process running
const shouldRun = new Promise(() => {})
