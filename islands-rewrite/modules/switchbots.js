import { mqtt } from 'aws-iot-device-sdk-v2'

import set from 'lodash/set.js'

import { globals } from '../index.js'
import { Module } from './generic-module.js'

import Switchbot from 'node-switchbot'
import { updateReportedShadow } from '../shadow.js'

export class Switchbots extends Module {
  constructor(stateKey) {
    super(stateKey)

    this.switchbot = undefined
    this.paths = {
      'enabled': { handler: this.handleEnabled, order: 0 }
    }
  }

  invertUpDown(stateString) {
    if (stateString === 'up') {
      return 'down'
    } else if (stateString === 'down') {
      return 'up'
    }
  }

  upDownToBoolean(stateString, bot) {
    let res = stateString === 'up' ? true : false
    return bot.state.reverseOnOff ? !res : res
  }

  invert(stateString) {
    if (stateString === 'on') {
      return 'off'
    } else if (stateString === 'off') {
      return 'on'
    }
  }

  botToOnOff(bot) {
    return bot.state.on ? 'on' : 'off'
  }

  botToUpDown(bot, desiredState=bot.state.on) {
    if ((desiredState && !bot.state.reverseOnOff) || (!desiredState && bot.state.reverseOnOff)) {
      return 'down'
    } else if ((!desiredState && !bot.state.reverseOnOff) || (desiredState && bot.state.reverseOnOff)) {
      return 'up'
    }
  }

  botToStateString(bot, invert=false) {
    if (invert) {
      return `${this.invert(this.botToOnOff(bot))} (${this.invert(this.botToUpDown(bot))})`
    } else {
      return `${this.botToOnOff(bot)} (${this.botToUpDown(bot)})`
    }
  }

  botToNameString(bot) {
    return `${bot.state.name} (${bot.ble.id})`
  }

  // this function is used when the island first comes up
  async correctBotState(bot) {
    console.error(bot)
    if (bot.ble.state !== bot.state.on) {
      this.setBotState(bot, this.botToUpDown(bot))
    } else {
      this.debug({}, `No action necessary for switchbot ${botToNameString(bot)}.`)
    }
  }

  findBotInState(id) {
    const index = this.currentState.switchbots.findIndex((botToFind) => {
      return botToFind.id === id
    })

    return [this.currentState.switchbots[index], index]
  }

  // this function is used when the island receives mqtt messages on onTopic or offTopic
  // desiredState is a boolean here
  async mutateBotState(bot, desiredState) {
    const [state, index] = this.findBotInState(bot.state.id)
    this.info(`Received MQTT request to change bot ${bot.state.id} from state ${state.on} (${this.botToUpDown(bot)}) to state ${desiredState} (${this.botToUpDown(bot, desiredState)}).`)
    // TODO: this is really broken and always believes that state.on is true
    // so let's bypass if for now and always attempt to set the switchbot state
    // if (state.on !== desiredState) {
      await this.setBotState(bot, this.botToUpDown(bot, desiredState), desiredState)
      updateReportedShadow(set({}, `modules[${this.stateKey}].switchbots[${index}].on`, desiredState))
    // } else {
      // this.debug({}, `No action necessary for switchbot ${this.botToNameString(bot)}.`)
    // }
  }

  async pressBot(bot) {
    this.info(`Received MQTT request to press button.`)
    await bot.ble.press()
    this.debug(`Pressed button for bot ${this.botToNameString(bot)}.`)
  }

  // newState is "up" or "down" by this point
  async setBotState(bot, newState, booleanDesiredState) {
    // console.log('bot', bot)
    this.debug({}, `Changing state from ${this.invertUpDown(newState)} (${bot.state.on}) to ${newState} (${booleanDesiredState}) for switchbot ${this.botToNameString(bot)}...`)
    bot.ble[newState]().then(() => {
      // bot.state.on = booleanDesiredState
      if (this.findBotInState(bot.state.id)[0].state)
        this.findBotInState(bot.state.id)[0].state.on = booleanDesiredState
      this.debug({}, `Changed state from ${this.invertUpDown(newState)} (${bot.state.on}) to ${newState} (${booleanDesiredState}) for switchbot ${this.botToNameString(bot)}.`)
    }).catch((error) => {
      this.error(error, `Failed to change state from ${this.invertUpDown(newState)} (${bot.state.on}) to ${newState} (${booleanDesiredState}) for switchbot ${this.botToNameString(bot)}.`)
    })
  }

  async enableBot(bot) {
    const promises = []

    this.correctBotState(await bot)


    if (bot.state.onTopic) {
      this.debug(`Subscribing bot ${this.botToNameString(bot)} to ON notifications on mqtt topic ${bot.state.onTopic}...`)
      promises.push(
        globals.connection.subscribe(bot.state.onTopic, mqtt.QoS.AtLeastOnce, this.mutateBotState.bind(this, bot, true))
        .then(() => this.debug(`Subscribed bot ${this.botToNameString(bot)} to ON notifications on mqtt topic ${bot.state.onTopic}.`))
      )
    }

    if (bot.state.offTopic) {
      this.debug(`Subscribing bot ${this.botToNameString(bot)} to OFF notifications on mqtt topic ${bot.state.offTopic}...`)
      promises.push(
        globals.connection.subscribe(bot.state.offTopic, mqtt.QoS.AtLeastOnce, this.mutateBotState.bind(this, bot, false))
        .then(() => this.debug(`Subscribed bot ${this.botToNameString(bot)} to OFF notifications on mqtt topic ${bot.state.offTopic}.`))
      )
    }

    if (bot.state.pressTopic) {
      this.debug(`Subscribing bot ${this.botToNameString(bot)} to PRESS notifications on mqtt topic ${bot.state.pressTopic}...`)
      promises.push(
        globals.connection.subscribe(bot.state.offTopic, mqtt.QoS.AtLeastOnce, this.pressBot.bind(this, bot))
        .then(() => this.debug(`Subscribed bot ${this.botToNameString(bot)} to PRESS notifications on mqtt topic ${bot.state.pressTopic}.`))
      )
    }

    return Promise.all(promises)
  }

  async enable(state) {
    this.switchbot = new Switchbot()

    this.info({}, `Enabling switchbots module to control ${state.switchbots ? state.switchbots.length : 0} bots...`)
    let bleFound
    try {
      bleFound = await this.switchbot.discover({ model: "H", duration: 5000 })
    } catch (e) {
      console.error(e)
      this.error(e)
      throw e
    }

    this.info({}, `Detected nearby switchbots with ids ${bleFound.map((bot) => bot.id)}.`)

    this.info({}, `state.switchbots: ${JSON.stringify(state.switchbots, null, 2)}`)
    if (state.switchbots) {
      const botsToFind = state.switchbots
      let matchingBotsFound = []
      for(let i = 0; i < botsToFind.length; i++) {
        this.info({}, `Looking for bot with index ${i} and id ${botsToFind[i].id}.`)
        //TODO: we're not using bot.serviceData.battery or bot.serviceData.mode
        matchingBotsFound.push(
          this.switchbot.discover({ model: 'H', duration: 5000, quick: true, id: botsToFind[i].id })
          .then((botFound) => {
            this.debug({}, `Found bot with id ${botsToFind[i].id}.`)
            return { ble: botFound[0], state: botsToFind[i] }
          })
          .catch((e) => {
            this.error(e)
            throw e
          })
        )
      }

      try {
        matchingBotsFound = await Promise.all(matchingBotsFound)
      } catch (e) {
        this.error(e)
      }

      //TODO: Should this bail and not actually enable?
      if (botsToFind.length !== matchingBotsFound.length) {
        const err = new Error('Could not find all requested switchbots.')
        this.error({ err }, 'Could not find all requested switchbots.')
        this.debug({ role: 'blob', blob: { bleFound } }, 'All bluetooth devices:')
      }

      this.debug({ role: 'blob', blob: { /*bleFound,*/ matchingBotsFound, botsToFind } }, 'Bots found, to find:')

      let promises = []
      for(let i = 0; i < matchingBotsFound.length; i++) {
        promises.push(this.enableBot(matchingBotsFound[i]))
      }

      await Promise.all(promises)

      this.info({}, `Enabled switchbots module, controlling ${promises.length} bots.`)
    }
  }

  async disable() {
    this.info({}, `Disabling switchbots...`)
    this.switchbot = undefined
    this.info({}, `Disabled switchbots.`)
  }

  async register() {
  }
}

/*
{
  "enabled": true,
    "switchbots": [
      {
        "id": "f84e19c8c70d",
        "name": "test",
        "on": true,
        "onTopic": "dev/switch/on",
        "offTopic": "dev/switch/off",
        "pressTopic": "dev/press",
        "reverseOnOff": true
      }
    ]
}
*/

const switchbots = new Switchbots('switchbots')
export default switchbots
