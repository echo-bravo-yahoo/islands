import { mqtt } from 'aws-iot-device-sdk-v2'

import { globals } from '../index.js'
import { Module } from './generic-module.js'

import { Switchbot } from 'node-switchbot'
const switchbot = new Switchbot();

if (bot_list.length === 0) {
  throw new Error("No device was found.");
}
// The `SwitchbotDeviceWoHand` object representing the found Bot.
let device = bot_list[0];
// Put the Bot's arm down (stretch the arm)
await device.down();
// Wait for 5 seconds
await switchbot.wait(5000);
// Put the Bot's arm up (retract the arm)
await device.up();

/*
{
  enabled: true,
  switchbots: [
  { name: 'foo', id: 'foo', on: true },
  { name: 'foo', id: 'bar', on: false, reverseOnOff: true }
  ]
}
*/

async function enable(state) {
  globals.logger.info({ role: 'breadcrumb' }, `Enabling switchbots...`)
  const bots = await switchbot.discover({ model: "H", duration: 5000 })
  const botsToFind = state.switchbots
  const botsFound = []
  for(let i = 0; i < botsToFind; i++) {
    const botToFind = botsToFind[i]
    const botFound = bots.filter((bot) => bot.id === botToFind.id)
    //TODO: we're not using bot.serviceData.battery or bot.serviceData.mode
    if (botFound) botsFound.push({ ble: botFound, state: botToFind })
  }

  //TODO: Should this bail and not actually enable?
  if (botsToFind.length !== botsFound.length) {
    globals.logger.debug({ role: 'blob', blob: { botsFound, botsToFind } }, 'Bots found, to find:')
    globals.logger.error({}, new Error('Could not find all requested switchbots.'))
  }

  let promises = []
  for(let i = 0; i < botsFound; i++) {
    const bot = botsFound[i]
    let desiredState = undefined
    if ((bot.state.on && !bot.state.reverseOnOff) || (!bot.state.on && bot.state.reverseOnOff)) {
      desiredState = 'down'
    } else if ((!bot.state.on && !bot.state.reverseOnOff) || (bot.state.on && bot.state.reverseOnOff)) {
      desiredState = 'up'
    }

    if (bot.ble.state !== desiredState) {
      globals.logger.debug({ role: 'breadcrumb' }, `Changing state from ${desiredState === 'up' ? 'down' : 'up'} to ${desiredState === 'up' ? 'down' : 'up'} for switchbot ${bot.state.name} (${bot.ble.id})...`)
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

  globals.logger.info({ role: 'breadcrumb' }, `Enabled switchbots.`)
}

async function disable() {
  globals.logger.info({ role: 'breadcrumb' }, `Disabling switchbots...`)
  globals.logger.info({ role: 'breadcrumb' }, `Disabled switchbots.`)
}

async function register() {
}

const switchbots = new Module('switchbots', enable, disable, register)
export default switchbots
