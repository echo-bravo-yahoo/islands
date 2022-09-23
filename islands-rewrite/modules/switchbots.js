import { globals } from '../index.js'
import { Module } from './generic-module.js'

import Switchbot from 'node-switchbot'
const switchbot = new Switchbot();

async function enable(state) {
  globals.logger.info({ role: 'breadcrumb' }, `Enabling switchbots module to control ${state.switchbots.length} bots...`)
  const bleFound = await switchbot.discover({ model: "H", duration: 5000 })
  const botsToFind = state.switchbots
  const matchingBotsFound = []
  for(let i = 0; i < botsToFind.length; i++) {
    const botToFind = botsToFind[i]
    const botFound = bleFound.find((bot) => {
      globals.logger.debug({ role: 'info' }, `Looking for bot with id ${botToFind.id}, comparing against ${bot.id}. They are ${bot.id === botToFind.id ? '' : 'not '}equal.`)
      return bot.id === botToFind.id
    })
    //TODO: we're not using bot.serviceData.battery or bot.serviceData.mode
    if (botFound) matchingBotsFound.push({ ble: botFound, state: botToFind })
  }

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
    let desiredState = undefined
    if ((bot.state.on && !bot.state.reverseOnOff) || (!bot.state.on && bot.state.reverseOnOff)) {
      desiredState = 'down'
    } else if ((!bot.state.on && !bot.state.reverseOnOff) || (bot.state.on && bot.state.reverseOnOff)) {
      desiredState = 'up'
    }

    if (bot.ble.state !== desiredState) {
      globals.logger.debug({ role: 'breadcrumb' }, `Changing state from ${desiredState === 'up' ? 'down' : 'up'} to ${desiredState === 'up' ? 'down' : 'up'} for switchbot ${bot.state.name} (${bot.ble.id})...`)
      globals.logger.debug({ role: 'blob', blob: bot.ble }, 'BLE bot object:')
      globals.logger.debug({ role: 'info' }, `typeof up: ${typeof bot.ble.up}`)
      promises.push(bot.ble[desiredState]().then(() => {
        globals.logger.debug({ role: 'breadcrumb' }, `Changed state from ${desiredState === 'up' ? 'down' : 'up'} to ${desiredState === 'up' ? 'down' : 'up'} for switchbot ${bot.state.name} (${bot.ble.id}).`)
      }).catch((err) => {
        globals.logger.error({ err }, `Failed to change state from ${desiredState === 'up' ? 'down' : 'up'} to ${desiredState === 'up' ? 'down' : 'up'} for switchbot ${bot.state.name} (${bot.ble.id}).`)
      }))
    } else {
      globals.logger.debug({ role: 'breadcrumb' }, `No action necessary for switchbot ${bot.state.name} (${bot.ble.id}).`)
    }
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
