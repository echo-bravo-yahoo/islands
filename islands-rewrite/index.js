import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// docs: https://aws.github.io/aws-iot-device-sdk-js-v2/node/index.html
import { mqtt, iot } from 'aws-iot-device-sdk-v2'

import { readFile, unlinkSync } from 'fs'
import { exec } from 'child_process'

const config = require('./config.json')
// flag to determine if we should run cleanup code
let dirty = true

function build_connection() {
    let config_builder =
      iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(config.certFilePath, config.privateKeyFilePath)

    config_builder.with_certificate_authority_from_path(undefined, config.awsCertFilePath)
    config_builder.with_clean_session(false)
    config_builder.with_client_id(config.name)
    config_builder.with_endpoint(config.endpoint)
    const clientConfig = config_builder.build()
    const client = new mqtt.MqttClient()
    return client.new_connection(clientConfig)
}

async function onPublish(topic, payload, dup, qos, retain) {
    var decoder = new TextDecoder('utf-8');
    const json = JSON.parse(decoder.decode(payload))
    console.log(`Publish received. topic:'${topic}' dup:${dup} qos:${qos} retain:${retain}`);
    console.log(JSON.stringify(json, null, 2))
}

// this non-resolved promise keeps the process running
const shouldRun = new Promise(() => {})

console.log('Connecting...')
const connection = build_connection()
await connection.connect()
console.log('Connection completed.')
console.log('Deleting old handoff file...')
try {
    unlinkSync('./handoff.json')
    console.log('Deleted old handoff file.')
} catch (e) {
    if (e.code === 'ENOENT') {
        console.log('No old handoff file to delete.')
    } else {
        throw e
    }
}
console.log('Starting up python script...')
let pythonChild = exec('python3 ./weather-and-light.py', (error, stdout, stderr) => {
  if (error) { console.error(`error: ${error.message}`) }
  if (stderr) { console.error(`stderr: ${stderr}`) }
})
console.log('Python script started.')

// the last time we read the handoff file
let lastTimestamp = 0

setInterval(() => {
  readFile('./handoff.json', (err, data) => {
    if (!data) return
    const handoff = JSON.parse(data.toString())
    if (handoff.timestamp > lastTimestamp) {
      lastTimestamp = handoff.timestamp
      console.log('New handoff found, emitting', handoff, 'via mqtt.')
      connection.publish('data/weather/greenhouse1', handoff, mqtt.QoS.AtLeastOnce)
    }
  })
}, 333)

async function cleanUp() {
  if (dirty) {
    dirty = false
    console.log('Killing python child process...')
    pythonChild.kill()
    console.log('Killed python child process.')
    console.log('Disconnecting from AWS IoT...')
    await connection.disconnect()
    console.log('Disconnected from AWS IoT.')
  }
}

process.on('exit', async () => { await cleanUp() })

process.on('SIGTERM', (signal) => {
  console.log(`Process ${process.pid} received a SIGTERM signal.`)
  process.exit(0)
})

process.on('SIGINT', async (signal) => {
  console.log(`Process ${process.pid} has been interrupted.`)
  await cleanUp()
  process.exit(0)
})

process.on('uncaughtException', async (err) => {
  console.log(`Uncaught Exception: ${err.message}`)
  await cleanUp()
  process.exit(1)
})
