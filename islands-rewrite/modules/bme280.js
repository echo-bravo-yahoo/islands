import { readFile, unlinkSync } from 'fs'
import { exec } from 'child_process'

import { mqtt } from 'aws-iot-device-sdk-v2'

import { globals } from '../index.js'
import { Module } from './generic-module.js'

let pythonChild
// the last time we read the handoff file
let lastTimestamp = 0
let interval

async function register() {
}

async function cleanUp() {
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
  this.enabled = true

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
        globals.connection.publish(`data/weather/${globals.island.location || 'unknown'}`, handoff, mqtt.QoS.AtLeastOnce)
      }
    })
  }, 333)
  globals.logger.info({ role: 'breadcrumb' }, `Enabled bme280.`)
}

async function disable() {
  globals.logger.info({ role: 'breadcrumb' }, `Disabling bme280...`)
  this.enabled = false
  await cleanUp()
  globals.logger.info({ role: 'breadcrumb' }, `Disabled bme280.`)
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

const bme280 = new Module('bme280', enable, disable, register)
export default bme280
