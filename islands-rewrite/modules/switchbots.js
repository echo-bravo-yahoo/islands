import { globals } from '../index.js'
import { Module } from './generic-module.js'

import Switchbot from 'node-switchbot'
import { updateReportedShadow } from '../shadow.js'
const switchbot = new Switchbot()
let moduleState = undefined

function invert(stateString) {
  if (stateString === 'on') {
    return 'off'
  } else if (stateString === 'off') {
    return 'on'
  }
}

function botToOnOff(bot) {
  return bot.state.on ? 'on' : 'off'
}

function botToUpDown(bot, desiredState=bot.state.on) {
  if ((desiredState && !bot.state.reverseOnOff) || (!desiredState && bot.state.reverseOnOff)) {
    return 'down'
  } else if ((!desiredState && !bot.state.reverseOnOff) || (desiredState && bot.state.reverseOnOff)) {
    return 'up'
  }
}

function botToStateString(bot, invert=false) {
  if (invert) {
    return `${invert(botToOnOff(bot))} (${invert(botToUpDown(bot))})`
  } else {
    return `${botToOnOff(bot)} (${botToUpDown(bot)})`
  }
}

function botToNameString(bot) {
  return `${bot.state.name} (${bot.ble.id})`
}

// this function is used when the island first comes up
async function correctBotState(bot) {
  if (bot.ble.state !== bot.state.on) {
    setBotState(bot, botToUpDown(bot))
  } else {
    globals.logger.debug({ role: 'breadcrumb' }, `No action necessary for switchbot ${botToNameString(bot)}.`)
  }
}

function findBotInState(id) {
  const index = this.currentState.switchbots.findIndex((botToFind) => {
    return botToFind.id === bot.id
  })

  return [this.currentState.switchbots[index], index]
}

// this function is used when the island receives mqtt messages on onTopic or offTopic
// desiredState is a boolean here
async function mutateBotState(bot, desiredState) {
  if (findBotInState(bot.id)[0].on !== desiredState) {
    setBotState(bot, botToUpDown(bot, desiredState))
    updateReportedShadow(set({}, `modules[${this.stateKey}].switchbots[${index}].on`, desiredState))
  } else {
    globals.logger.debug({ role: 'breadcrumb' }, `No action necessary for switchbot ${botToNameString(bot)}.`)
  }
}

// newState is "up" or "down" by this point
async function setBotState(bot, newState) {
    globals.logger.debug({ role: 'breadcrumb' }, `Changing state from ${invert(newState)} to ${newState} for switchbot ${botToNameString(bot)}...`)
    promises.push(bot.ble[newState]().then(() => {
      globals.logger.debug({ role: 'breadcrumb' }, `Changed state from ${invert(newState)} to ${newState} for switchbot ${botToNameString(bot)}.`)
    }).catch((err) => {
      globals.logger.debug({ role: 'breadcrumb' }, `Failed to change state from ${invert(newState)} to ${newState} for switchbot ${botToNameString(bot)}.`)
    }))
}

async function enableBot(bot) {
  const promises = []

  correctBotState(bot)


  if (bot.state.onTopic) {
    globals.logger.debug(`Subscribing bot ${botToNameString(bot)} to ON notifications on mqtt topic ${bot.state.onTopic}...`)
    promises.push(
      globals.connection.subscribe(bot.state.onTopic, mqtt.QoS.AtLeastOnce, turnOnBot.bind(bot))
      .then(() => globals.logger.debug(`Subscribed bot ${botToNameString(bot)} to ON notifications on mqtt topic ${bot.state.onTopic}.`))
    )
  }

  if (bot.state.offTopic) {
    globals.logger.debug(`Subscribing bot ${botToNameString(bot)} to OFF notifications on mqtt topic ${bot.state.offTopic}...`)
    promises.push(
      globals.connection.subscribe(bot.state.offTopic, mqtt.QoS.AtLeastOnce, turnOffBot.bind(bot))
      .then(() => globals.logger.debug(`Subscribed bot ${botToNameString(bot)} to OFF notifications on mqtt topic ${bot.state.offTopic}.`))
    )
  }

  return promises
}

async function enable(state) {
  globals.logger.info({ role: 'breadcrumb' }, `Enabling switchbots module to control ${state.switchbots.length} bots...`)
  // const bleFound = await switchbot.discover({ model: "H", duration: 5000 })
  const botsToFind = state.switchbots
  const matchingBotsFound = []
  for(let i = 0; i < botsToFind.length; i++) {
    //TODO: we're not using bot.serviceData.battery or bot.serviceData.mode
    matchingBotsFound.push(
      switchbot.discover({ model: 'H', duration: 5000, quick: true, id: botsToFind[i].id })
      .then((botFound) => {
        globals.logger.debug(`Found bot with id ${botsToFind.id}.`)
        return { ble: botFound, state: botsToFind[i] }
      })
    )
  }

  await Promise.all(matchingBotsFound)

  //TODO: Should this bail and not actually enable?
  if (botsToFind.length !== matchingBotsFound.length) {
    const err = new Error('Could not find all requested switchbots.')
    globals.logger.error({ err }, 'Could not find all requested switchbots.')
    globals.logger.debug({ role: 'blob', blob: { bleFound } }, 'All bluetooth devices:')
  }

  globals.logger.debug({ role: 'blob', blob: { matchingBotsFound, botsToFind } }, 'Bots found, to find:')

  let promises = []
  for(let i = 0; i < matchingBotsFound.length; i++) {
    const bot = matchingBotsFound[i]
    enableBot(matchingBotsFound[i])
  }

  await Promise.all(promises)

  globals.logger.info({ role: 'breadcrumb' }, `Enabled switchbots module, controlling ${promises.length} bots.`)
}

async function disable() {
  globals.logger.info({ role: 'breadcrumb' }, `Disabling switchbots...`)
  globals.logger.info({ role: 'breadcrumb' }, `Disabled switchbots.`)
}

async function register() {
}

const switchbots = new Module('switchbots', enable, disable, register)
export default switchbots
