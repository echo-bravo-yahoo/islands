import { mqtt } from 'aws-iot-device-sdk-v2'

import pkg from 'bme680-sensor'
const Bme680 = pkg.Bme680
const sensor = new Bme680(1, 0x77)

import { globals } from '../index.js'
import { Module } from './generic-module.js'

let interval

async function enable() {
  globals.logger.info({ role: 'breadcrumb' }, `Enabling bme680...`)
  await sensor.initialize()
  interval = setInterval(async() => {
    const sensorData = await sensor.getSensorData()
    const payload = {
      temp: (sensorData.data.temperature) * 1.8 + 32,
      gas: sensorData.data.gas_resistance,
      humidity: sensorData.data.humidity,
      pressure: sensorData.data.pressure
      // TODO: is this worth implementing?
      // altitude:
    }
    globals.logger.info({ role: 'breadcrumb' }, 'Publishing new bme680 data.')
    globals.logger.info({ role: 'blob', blob: payload }, 'bme680 data:')
    globals.connection.publish(`data/weather/${globals.island.location || 'unknown'}`, payload, mqtt.QoS.AtLeastOnce)
  }, 60*1000)
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