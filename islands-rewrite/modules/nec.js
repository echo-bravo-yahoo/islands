import { mqtt } from 'aws-iot-device-sdk-v2'

import { globals } from '../index.js'
import { Infrared } from './infrared.js'
import { transmitNECCommand } from '../../bitbang/index.js'

import pigpio from 'pigpio'
const Gpio = pigpio.Gpio

export class NEC extends Infrared {
  constructor(stateKey) {
    super(stateKey)

    this.paths = {
      'virtual': { handler: this.copyState, order: 0 },
      'enabled': { handler: this.handleEnabled, order: 1 },
    }
  }

  runCommand(topicName, _body) {
    const body = JSON.parse(new TextDecoder().decode(_body))
    if (body.id) {
      this.runSavedCommand(body.id)
    } else {
      this.runNECCommand(body)
    }
  }

  runSavedCommand(id) {
    this.runNECCommand(this.currentState.savedCommands[id])
  }

  runNECCommand(body) {
    this.info({}, `Received NEC command with address ${Number(body.address).toString(16)} (extended/complement ${Number(body.extendedAddress ? body.extendedAddress : ~body.extendedAddress).toString(16)}) and command ${Number(body.command).toString(16)} (extended/complement ${Number(body.extendedAddress ? body.extendedAddress : ~body.extendedAdress).toString(16)}).`)

    if (this.currentState.virtual) return

    transmitNECCommand(pigpio, body.address, body.command, body.extendedAddress, body.extendedCommand)
      .then((waveId) => {
        this.info(`Done transmitting wave ${waveId}.`)
        pigpio.waveDelete(waveId)
      })
  }

  async enable() {
    if (!this.currentState.virtual) {
      new Gpio(this.currentState.ledPin, { mode: Gpio.OUTPUT })
    }

    // TODO: init or enable?
    if (this.currentState.commandTopic) {
      this.debug(`Subscribing to NEC command requests on topic ${this.currentState.commandTopic}...`)
        await globals.connection.subscribe(this.currentState.commandTopic, mqtt.QoS.AtLeastOnce, this.runCommand.bind(this))
      this.debug(`Subscribed to NEC command requests on topic ${this.currentState.scriptTopic}.`)
    }

    this.info({}, `Enabled nec.`)
    this.currentState.enabled = true
  }

  async disable() {
    this.info({}, `Disabled nec.`)
    this.currentState.enabled = false
  }
}

/*
{
  "enabled": true,
  "pin": number,
  "commandTopic": string,
  "savedCommands": {
    "volumeDown": {
      "address": "0x7c",
      "command": "0x66",
      "extendedAddress": "0xaa"
    }
  }
}
*/

const nec = new NEC('nec')
export default nec
