import { mqtt, iotshadow } from 'aws-iot-device-sdk-v2'
import { globals } from './index.js'

let shadowUpdateComplete = false

async function subToShadowUpdate() {
  return new Promise(async (resolve, reject) => {
    try {
      function updateAccepted(error, response) {
        if (response) {
          globals.logger.info({ role: 'breadcrumb' }, 'Updating modules in response to IoT shadow update.')
          for (const module in globals.modules) {
            globals.modules[module].handleState({
              desired: response.state.desired,
              delta: response.state.delta,
              reported: response.state.reported
            })
          }
          globals.logger.info({ role: 'breadcrumb' }, 'Updated modules in response to IoT shadow update.')
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
        for (const module in globals.modules) {
          globals.modules[module].handleState({
            desired: response.state.desired,
            delta: response.state.delta,
            reported: response.state.reported
          })
        }

        if (err || !response) {
          globals.logger.error({ err: 'breadcrumb' }, '')
        }
        shadowUpdateComplete = true
        resolve(true)
      }

      function getRejected(err, response) {
        const details = (err || response)
        if (details) {
          globals.logger.error({ err: details }, 'Request for shadow state was rejected.')
        }

        shadowUpdateComplete = true
        reject(details)
      }

      globals.logger.info({ role: 'breadcrumb' }, 'Subscribing to get shadow events...')
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
      await Promise.all(promises)
      globals.logger.info({ role: 'breadcrumb' }, 'Subscribed to get shadow events.')

      resolve(true)
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
        for (const module in globals.modules) {
          globals.modules[module].handleDeltaState(response.state)
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
    }
    catch (error) {
      reject(error)
    }
  })
}

async function getCurrentShadow() {
  return new Promise(async (resolve, reject) => {
    try {
      const getShadow = {
        thingName: globals.name
      }

      shadowUpdateComplete = false
      globals.logger.info({ role: 'breadcrumb' }, "Requesting current shadow state...")
      await globals.shadow.publishGetShadow(
        getShadow,
        mqtt.QoS.AtLeastOnce)
      globals.logger.info({ role: 'breadcrumb' }, "Current shadow state requested.")

      resolve(true)
    }
    catch (error) {
      reject(error)
    }
  })
}

export function updateShadow(newValue) {
  return new Promise(async (resolve, reject) => {
    try {
          var updateShadow = {
            state: {
              reported: newValue,
            },
            thingName: globals.name
          }

      globals.logger.info({ role: 'breadcrumb' }, 'Publishing new shadow value.')
          await globals.shadow.publishUpdateShadow(
            updateShadow,
            mqtt.QoS.AtLeastOnce)
      globals.logger.info({ role: 'breadcrumb' }, 'Published new shadow value.')
    } catch (err) {
      globals.logger.error({ err }, 'Failed to publish new shadow value.')
      reject(err)
    }
    resolve(true)
  })
}

export async function setupShadow() {
  globals.shadow = new iotshadow.IotShadowClient(globals.connection)

  try {
    await subToShadowUpdate()
    await subToShadowGet()
    await subToShadowDelta()
    await getCurrentShadow()
  } catch (err) {
    globals.logger.fatal({ err }, 'Failed to set up AWS IOT Shadow. Terminating now.')
  }
}
