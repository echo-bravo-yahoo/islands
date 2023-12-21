import bme280Sensor from 'bme280'

import { globals } from '../index.js'
import { Module } from './generic-module.js'

let interval, sensor

async function publishReading() {
  const sensorData = await sensor.read()
  const payload = {
    temp: (sensorData.temperature) * 1.8 + 32,
    humidity: sensorData.humidity,
    pressure: sensorData.pressure
    // TODO: is this worth implementing?
    // altitude:
  }
  globals.logger.info({ role: 'breadcrumb' }, 'Publishing new bme280 data.')
  globals.logger.info({ role: 'blob', blob: payload }, `bme280 data, published to data/weather/${globals.island.location || 'unknown'}: ${JSON.stringify(payload)}`)
  globals.connection.publish(`data/weather/${globals.island.location || 'unknown'}`, payload, mqtt.QoS.AtLeastOnce)
}

async function enable() {
  globals.logger.info({ role: 'breadcrumb' }, `Enabling bme280...`)
  sensor = await bme280Sensor.open({ i2cAddress:  0x76 })
  interval = setInterval(publishReading, 60*1000)
  globals.logger.info({ role: 'breadcrumb' }, `Enabled bme280.`)
}

async function disable() {
  globals.logger.info({ role: 'breadcrumb' }, `Disabling bme280...`)
  clearInterval(interval)
  await sensor.close()
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

async function register() {
}

const bme280 = new Module('bme280', enable, disable, register)
export default bme280
