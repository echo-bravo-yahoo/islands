import { mqtt, iotshadow } from 'aws-iot-device-sdk-v2'
import get from 'lodash/get.js'

import { globals } from './index.js'

let shadowUpdateComplete = false

async function subToShadowUpdate() {
  return new Promise(async (resolve, reject) => {
    try {
      function updateAccepted(error, response) {
        if (response) {
          globals.logger.info({ role: 'breadcrumb' }, 'Updating modules and configs in response to IoT shadow update.')
          globals.logger.debug({ role: 'blob', tags: ['shadow'], response }, 'Shadow update response:')

          // TODO: these are just string indices, 0, 1, 2, etc. lol.
          for (const module in globals.modules) {
            globals.modules[module].handleState({
              desired: response.state.desired,
              delta: response.state.delta,
              reported: response.state.reported
            })
          }

          // TODO: these are just string indices, 0, 1, 2, etc. lol.
          for (const config in globals.configs) {
            globals.configs[config].handleState({
              desired: response.state.desired,
              delta: response.state.delta,
              reported: response.state.reported
            })
          }
          globals.logger.info({ role: 'breadcrumb' }, 'Updated modules and configs in response to IoT shadow update.')
        }

        if (error || !response) {
          globals.logger.error({ err }, 'Failed to request IoT shadow update.')
          reject(error)
        }

        resolve(true)
      }

      function updateRejected(err, response) {
        const details = (err || response)
        if (details) {
          globals.logger.error({ err: details }, 'IoT shadow update rejected.')
        }

        reject(details)
      }

      globals.logger.info({ role: 'breadcrumb' }, "Subscribing to Update events...")
      const updateShadowSubRequest = {
        thingName: globals.name
      }

      let promises = []
      promises.push(globals.shadow.subscribeToUpdateShadowAccepted(
        updateShadowSubRequest,
        mqtt.QoS.AtLeastOnce,
        (error, response) => updateAccepted(error, response)))

      promises.push(globals.shadow.subscribeToUpdateShadowRejected(
        updateShadowSubRequest,
        mqtt.QoS.AtLeastOnce,
        (error, response) => updateRejected(error, response)))

      await Promise.all(promises)
      globals.logger.info({ role: 'breadcrumb' }, 'Subscribed to Update events.')
      resolve(true)
    }
    catch (error) {
      reject(error)
    }
  })
}

async function subToShadowGet() {
  return new Promise(async (resolve, reject) => {
    try {
      function getAccepted(err, response) {
        globals.logger.debug({ role: 'blob', tags: ['shadow'], response: { ... response, metadata: undefined } }, 'Shadow get response:')
        // TODO: these are just string indices, 0, 1, 2, etc. lol.
        for (const module in globals.modules) {
          globals.modules[module].handleState({
            desired: response.state.desired,
            delta: response.state.delta,
            reported: response.state.reported
          })
        }

        // TODO: these are just string indices, 0, 1, 2, etc. lol.
        for (const config in globals.configs) {
          globals.configs[config].handleState({
            desired: response.state.desired,
            delta: response.state.delta,
            reported: response.state.reported
          })
        }

        if (err || !response) {
          globals.logger.error(err)
        }
        shadowUpdateComplete = true
        resolve(response.state)
      }

      function getRejected(err, response) {
        const details = (err || response)
        if (details) {
          globals.logger.error({ err: details }, 'Request for shadow state was rejected.')
        }

        shadowUpdateComplete = true
        reject(details)
      }

      const getShadowSubRequest = { thingName: globals.name }

      let promises = []
      promises.push(globals.shadow.subscribeToGetShadowAccepted(
        getShadowSubRequest,
        mqtt.QoS.AtLeastOnce,
        (error, response) => getAccepted(error, response)))

      promises.push(globals.shadow.subscribeToGetShadowRejected(
        getShadowSubRequest,
        mqtt.QoS.AtLeastOnce,
        (error, response) => getRejected(error, response)))

      promises.push(getCurrentShadow())

      await Promise.all(promises)

      globals.logger.info({ role: 'breadcrumb' }, 'Subscribed to get shadow events. Waiting for first shadow state before continuing.')
    } catch (err) {
      globals.logger.error({ err }, 'Failed to subscribe to get shadow events.')
      reject(err)
    }
  })
}

async function subToShadowDelta() {
  return new Promise(async (resolve, reject) => {
    try {
      function deltaEvent(error, response) {
        globals.logger.info({ role: 'breadcrumb' }, 'Received shadow delta event.')

        globals.logger.info({ role: 'breadcrumb' }, 'Updating modules in response to shadow delta...')
          globals.logger.debug({ role: 'blob', tags: ['shadow'], response }, 'Shadow delta response:')

        // TODO: these are just string indices, 0, 1, 2, etc. lol.
        for (const module in globals.modules) {
          globals.modules[module].handleDeltaState(response.state)
        }

        // TODO: these are just string indices, 0, 1, 2, etc. lol.
        for (const config in globals.configs) {
          globals.configs[config].handleDeltaState(response.state)
        }

        globals.logger.info({ role: 'breadcrumb' }, 'Updated modules in response to shadow delta.')

        resolve(true)
      }

      globals.logger.info({ role: 'breadcrumb' }, 'Subscribing to Delta events...')
      const deltaShadowSubRequest = {
        thingName: globals.name
      }

      await globals.shadow.subscribeToShadowDeltaUpdatedEvents(
        deltaShadowSubRequest,
        mqtt.QoS.AtLeastOnce,
        (error, response) => deltaEvent(error, response))
      globals.logger.info({ role: 'breadcrumb' }, "Subscribed to Delta events.")

      resolve(true)
    } catch (error) {
      reject(error)
    }
  })
}

async function getCurrentShadow() {
  return new Promise(async (resolve, reject) => {
    try {
      const getShadow = { thingName: globals.name }

      shadowUpdateComplete = false
      await globals.shadow.publishGetShadow(
        getShadow,
        mqtt.QoS.AtLeastOnce)

      resolve(true)
    }
    catch (error) {
      reject(error)
    }
  })
}

export function updateReportedShadow(newValue) {
  return updateWholeShadow({ reported: newValue })
}

export function updateDesiredShadow(newValue) {
  return updateWholeShadow({ desired: newValue })
}

export function updateWholeShadow(newState) {
  return new Promise(async (resolve, reject) => {
    try {
      // thingName is required by AWS IoT to match the request to the Thing
      const updateShadow = { state: newState, thingName: globals.name }

      globals.logger.info({ role: 'blob', blob: updateShadow }, 'Publishing new shadow value:')
      await globals.shadow.publishUpdateShadow(
        updateShadow,
        mqtt.QoS.AtLeastOnce)
    } catch (err) {
      globals.logger.error({ err }, 'Failed to publish new shadow value.')
      reject(err)
    }
    resolve(true)
  })
}

export async function getInitialShadowState() {
  try {
    globals.shadow = new iotshadow.IotShadowClient(globals.connection)

    await subToShadowGet()
    // this is called in subToShadowGet - oops
    // await getCurrentShadow()
  } catch (err) {
    globals.logger.fatal({ err }, 'Failed to set up AWS IOT Shadow. Terminating now.')
  }
}

export async function setupShadow() {
  try {
    await subToShadowUpdate()
    await subToShadowDelta()
  } catch (err) {
    globals.logger.fatal({ err }, 'Failed to set up AWS IOT Shadow. Terminating now.')
  }
}
