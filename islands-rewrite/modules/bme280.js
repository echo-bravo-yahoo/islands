import { mqtt } from 'aws-iot-device-sdk-v2'

import get from 'lodash/get.js'

import bme280Sensor from 'bme280'

import { globals } from '../index.js'
import { Sensor } from './generic-sensor.js'

export class BME280 extends Sensor {
  constructor(stateKey) {
    super(stateKey)

    this.paths = {
      'virtual': { handler: this.copyState, order: 0 },
      'enabled': { handler: this.handleEnabled, order: 1 },
      'reporting': { handler: this.handleReporting, order: 2 },
    }
  }

  async enable() {
    if (!this.currentState.virtual) {
      this.sensor = await bme280Sensor.open({ i2cAddress: Number(this.currentState.i2cAddress) || 0x76 })
    }

    this.setupPublisher()
    this.info({}, `Enabled bme280.`)
    this.currentState.enabled = true
  }

  async disable() {
    clearInterval(this.interval)
    if (this.sensor) await this.sensor.close()
    this.info({}, `Disabled bme280.`)
    this.currentState.enabled = false
  }

  async publishReading() {
    const virtualPayload = {
      metadata: { island: globals.configs[0].currentState.name, timestamp: new Date() },
      temp: 72 + get(this.currentState, 'offsets.temp', 0),
      humidity: 20 + get(this.currentState, 'offsets.humidity', 0),
      pressure: 1000 + get(this.currentState, 'offsets.pressure', 0)
    }

    if (this.currentState.virtual) {
      this.info({ role: 'blob', blob: virtualPayload }, `Publishing new bme280 data to data/weather/${globals.configs[0].currentState.location || 'unknown'}: ${JSON.stringify(virtualPayload)}`)
      return
    }

    const sensorData = await this.sensor.read()
    const payload = {
      metadata: { island: globals.configs[0].currentState.name, timestamp: new Date() },
      temp: (sensorData.temperature) * 1.8 + 32 + get(this.currentState, 'offsets.temp', 0),
      humidity: sensorData.humidity + get(this.currentState, 'offsets.humidity', 0),
      pressure: sensorData.pressure + get(this.currentState, 'offsets.pressure', 0)
      // TODO: is this worth implementing?
      // altitude:
    }

    globals.connection.publish(`data/weather/${globals.configs[0].currentState.location || 'unknown'}`, payload, mqtt.QoS.AtLeastOnce)

    this.info({ role: 'blob', blob: payload }, `Publishing new bme280 data to data/weather/${globals.configs[0].currentState.location || 'unknown'}: ${JSON.stringify(payload)}`)
  }

  async register() {
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

const bme280 = new BME280('bme280')
export default bme280
