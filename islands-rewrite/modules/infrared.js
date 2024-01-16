import { mqtt } from 'aws-iot-device-sdk-v2'

import get from 'lodash/get.js'

import { globals } from '../index.js'
import { Module } from './generic-module.js'

export class Infrared extends Module {
  constructor(stateKey) {
    super(stateKey)

    this.paths = {
      'virtual': { handler: this.copyState, order: 0 },
      'enabled': { handler: this.handleEnabled, order: 1 },
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
}

/*
{
  "enabled": true,
  "pin": number
}
*/

const infrared = new Infrared('infrared')
export default infrared

