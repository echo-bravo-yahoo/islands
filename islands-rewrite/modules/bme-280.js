import { readFile, unlinkSync } from 'fs'
import { exec } from 'child_process'
import isEqual from 'lodash/isEqual.js'
import get from 'lodash/get.js'
import merge from 'lodash/merge.js'
import { mqtt } from 'aws-iot-device-sdk-v2'
import { updateShadow } from '../shadow.js'
import { globals } from '../index.js'

let pythonChild
// the last time we read the handoff file
let lastTimestamp = 0
let stateKey = 'bme280'
let currentState = {}
let interval
let enabled

export async function register() {
}

export async function cleanUp() {
  if (pythonChild) {
    globals.logger.info({ role: 'breadcrumb' }, 'Killing python child process...')
    pythonChild.kill()
    globals.logger.info({ role: 'breadcrumb' }, 'Killed python child process.')
  }
  globals.logger.info({ role: 'breadcrumb' }, 'Clearing handoff polling interval...')
  clearInterval(interval)
  globals.logger.info({ role: 'breadcrumb' }, 'Cleared handoff polling interval.')
}

async function enable() {
  globals.logger.info({ role: 'breadcrumb' }, `Enabling bme280...`)
  enabled = true

  globals.logger.info({ role: 'breadcrumb' }, 'Starting up python script...')
  pythonChild = exec('python3 ./python/weather-and-light.py', (error, stdout, stderr) => {
    if (error) { globals.logger.error({ err: error }, error.message) }
    if (stderr) { globals.logger.error({ err: stderr}, stderr) }
  })
  globals.logger.info({ role: 'breadcrumb' }, 'Started up python script.')


  // we delete the old handoff file to not re-read it
  globals.logger.info({ role: 'breadcrumb' }, 'Deleting old handoff file...')
  try {
    unlinkSync('./handoff.json')
    globals.logger.info({ role: 'breadcrumb' }, 'Deleted old handoff file.')
  } catch (e) {
    if (e.code === 'ENOENT') {
      globals.logger.info({ role: 'breadcrumb' }, 'No old handoff file to delete.')
    } else {
      throw e
    }
  }

  interval = setInterval(() => {
    readFile('./ipc/handoff.json', (err, data) => {
      if (!data) return
      let handoff
      try {
        handoff = JSON.parse(data.toString())
      } catch (error) {
        globals.logger.error({ err: error }, 'Error parsing handoff file')
        return
      }
      if (handoff.timestamp > lastTimestamp) {
        lastTimestamp = handoff.timestamp
        globals.logger.info({ role: 'breadcrumb' }, 'New handoff found, emitting', handoff, 'via mqtt.')
        globals.connection.publish('data/weather/greenhouse1', handoff, mqtt.QoS.AtLeastOnce)
      }
    })
  }, 333)
  globals.logger.info({ role: 'breadcrumb' }, `Enabled bme280.`)
}

async function disable() {
  globals.logger.info({ role: 'breadcrumb' }, `Disabling bme280...`)
  enabled = false
  await cleanUp()
  globals.logger.info({ role: 'breadcrumb' }, `Disabled bme280.`)
}

export function handleDeltaState(delta) {
  handleState({ delta })
}

// takes in the entire state tree and decomposes it to the ones relevant to this module
export async function handleState({ desired:_desired, delta:_delta, reported:_reported }) {
  globals.logger.info({ role: 'breadcrumb' }, `Received new state for module ${stateKey}.`)
  const desired = get(_desired, `modules[${stateKey}]`)
  const delta = get(_delta, `modules[${stateKey}]`)
  const reported = get(_reported, `modules[${stateKey}]`)
  const merged = merge({ ...currentState }, delta)

  function logIfDefined(name, value) {
    return `${name} is currently ${value !== undefined ? 'defined:' : 'undefined.'}`
  }

  globals.logger.debug({ role: 'blob', tags: ['shadow'], state: { delta, desired, reported, currentState, merged } }, 'Shadow state:')

  if (enabled === undefined) {
    globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `${stateKey} not yet enabled or disabled. Setting ${stateKey} to ${desired.enabled ? 'enabled' : 'disabled'} to match desired state.`)
    currentState = desired
    if (desired.enabled) {
      await enable()
    } else {
      await disable()
    }

    if (!isEqual(desired, reported))
      updateShadow({ modules: { [stateKey]: desired } })

  } else if (delta && !isEqual(currentState, merged)) {
    globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `Modifying ${stateKey} to reflect a merge of delta state and current state.`)
    currentState = merged
    globals.logger.debug({ role: 'blob', tags: ['shadow'], currentState }, logIfDefined('Merged state', currentState))
    if (currentState.enabled) {
      await enable()
    } else {
      await disable()
    }

    updateShadow({ modules: { [stateKey]: merged } })
  } else if (desired && !isEqual(desired, currentState)) {
    globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `Modifying ${stateKey} because it does not match the desired state.`)
    currentState = desired
    if (desired.enabled) {
      await enable()
    } else {
      await disable()
    }
    updateShadow({ modules: { [stateKey]: desired } })
  } else {
    globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `No change to ${stateKey} necessary for this state update.`)
  }
}

/*
{
  "enabled": true,
  "offsets": {
    "temp": "",
    "gas": "",
    "light": "",
    "sound": "",
    "humidity": "",
    "pressure": ""
  },
  "sampling": {
    "interval": ""
  },
  "reporting": {
    "interval": "",
    "aggregation": "latest|average|median|pX"
  }
}
*/

export default {
  register,
  handleState,
  handleDeltaState,
  cleanUp
}
