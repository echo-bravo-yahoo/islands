import { mqtt } from 'aws-iot-device-sdk-v2'

import get from 'lodash/get.js'

import pkg from 'bme680-sensor'
const Bme680 = pkg.Bme680

import { globals } from '../index.js'
import { Sensor } from './generic-sensor.js'

export class BME680 extends Sensor {
  constructor(stateKey) {
    super(stateKey)

    this.paths = {
      'virtual': { handler: this.copyState, order: 0 },
      'enabled': { handler: this.handleEnabled, order: 1 },
      'reporting': { handler: this.handleReporting, order: 2 },
    }
  }

  async publishReading() {
    const virtualPayload = {
      metadata: { island: globals.configs[0].currentState.name, timestamp: new Date() },
      temp: 72 + get(this.currentState, 'offsets.temp', 0),
      gas: 1000 + get(this.currentState, 'offsets.gas', 0),
      humidity: 20 + get(this.currentState, 'offsets.humidity', 0),
      pressure: 1000 + get(this.currentState, 'offsets.pressure', 0)
    }

    if (this.currentState.virtual) {
      this.info({ role: 'blob', blob: virtualPayload }, `Publishing new bme680 data to data/weather/${globals.configs[0].currentState.location || 'unknown'}: ${JSON.stringify(virtualPayload)}`)
      return
    }

    const sensorData = (await this.sensor.getSensorData()).data
    const payload = {
      metadata: { island: globals.name, timestamp: new Date() },
      temp: (sensorData.temperature) * 1.8 + 32 + get(this.currentState, 'offsets.temp', 0),
      humidity: sensorData.humidity + get(this.currentState, 'offsets.humidity', 0),
      pressure: sensorData.pressure + get(this.currentState, 'offsets.pressure', 0),
      gas: sensorData.gas_resistance + get(this.currentState, 'offsets.gas', 0)
      // TODO: is this worth implementing?
      // altitude:
    }

    globals.connection.publish(`data/weather/${globals.configs[0].currentState.location || 'unknown'}`, payload, mqtt.QoS.AtLeastOnce)
    this.info({ role: 'blob', blob: payload }, `Publishing new bme680 data to data/weather/${globals.configs[0].currentState.location || 'unknown'}: ${JSON.stringify(payload)}`)
  }

  async enable() {
    if (!this.currentState.virtual) {
      this.sensor = new Bme680(1, Number(this.currentState.i2cAddress) || 0x77)
      await this.sensor.initialize()
    }

    // TODO: ideally, this would re-calculate the next invocation to the correct time
    // right now, it sort of just is randomly between (newInterval) and
    // (newInterval+oldInterval)
    this.setupPublisher()
    this.info({}, `Enabled bme680.`)
    this.currentState.enabled = true
  }

  async disable() {
    // TODO: do I need to turn off the sensor / close the connection?
    clearInterval(this.interval)
    this.info({}, `Disabled bme680.`)
    this.currentState.enabled = false
  }
}

const bme680 = new BME680('bme680')
export default bme680
