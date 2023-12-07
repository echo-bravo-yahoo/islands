import { mqtt } from 'aws-iot-device-sdk-v2'

import pkg from 'bme680-sensor'
const Bme680 = pkg.Bme680
const sensor = new Bme680(1, 0x77)

import { globals } from '../index.js'
import { Module } from './generic-module.js'

let interval

async function enable(desiredState) {
  globals.logger.info({ role: 'breadcrumb' }, `Enabling bme680 to publish every ${desired.interval || 60} seconds...`)
  await sensor.initialize()
  if (interval) clearInterval(interval)
  interval = setInterval(async() => {
    const sensorData = await sensor.getSensorData()
    const payload = {
      temp: ((sensorData.data.temperature) * 1.8 + 32) + (desiredState.offsets.temp || 0),
      gas: sensorData.data.gas_resistance + (desiredState.offsets.gas || 0),
      humidity: sensorData.data.humidity + (desiredState.offsets.humidity || 0),
      pressure: sensorData.data.pressure + (desiredState.offsets.pressure || 0)
      // TODO: is this worth implementing?
      // altitude:
    }
    globals.logger.info({ role: 'breadcrumb' }, 'Publishing new bme680 data.')
    globals.logger.info({ role: 'blob', blob: { payload, offsets: desiredState.offsets } }, `bme680 data, published to data/weather/${globals.island.location || 'unknown'}: ${JSON.stringify(payload)}`)
    globals.connection.publish(`data/weather/${globals.island.location || 'unknown'}`, payload, mqtt.QoS.AtLeastOnce)
  }, desiredState.interval * 1000 || 60 * 1000)
  globals.logger.info({ role: 'breadcrumb' }, `Enabled bme680.`)
}

async function disable() {
  globals.logger.info({ role: 'breadcrumb' }, `Disabling bme680...`)
  clearInterval(interval)
  globals.logger.info({ role: 'breadcrumb' }, `Disabled bme680.`)
}

async function register() {
}

const bme680 = new Module('bme680', enable, disable, register)
export default bme680
