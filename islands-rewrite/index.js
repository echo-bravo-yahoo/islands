import { createRequire } from "module";
const require = createRequire(import.meta.url);

// docs: https://aws.github.io/aws-iot-device-sdk-js-v2/node/index.html
import { mqtt, iot } from 'aws-iot-device-sdk-v2'

import { readFile } from 'fs'

const config = require("./config.json");

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
    var decoder = new TextDecoder("utf-8");
    const json = JSON.parse(decoder.decode(payload))
    console.log(`Publish received. topic:"${topic}" dup:${dup} qos:${qos} retain:${retain}`);
    console.log(JSON.stringify(json, null, 2))
}

// this non-resolved promise keeps the process running
const shouldRun = new Promise(() => {})

console.log("Connecting...")
const connection = build_connection()
console.log(await connection.connect())
console.log("Connection completed.")
console.log("Subscribing...")
console.log(await connection.subscribe("test", mqtt.QoS.AtLeastOnce, onPublish))
console.log("Subscribe completed.")
console.log("Publishing...")
console.log(await connection.publish("test", { test: "test" }, mqtt.QoS.AtLeastOnce))
console.log("Publish completed.")
console.log("Starting up python script...")
exec('python3 ./weather-and-light.py', (error, stdout, stderr) => {
  if (error) { console.error(`error: ${error.message}`) }
  if (stderr) { console.error(`stderr: ${stderr}`) }
})
console.log("Python script started")
setInterval(() => {
  readFile('./handoff.json', (err, data) => {
    const handoff = JSON.parse(data.toString())
    console.log('Checking for new handoff...')
    if (handoff.timestamp > lastTimestamp) {
      console.log('New handoff found, emitting', handoff.message, 'via mqtt.')
      connection.publish('test', { message: handoff.message }, mqtt.QoS.AtLeastOnce)
    } else {
      console.log('No new handoff found.')
    }
  })
}, 333)

// TODO: clean up on sigkill, etc
// console.log("Disconnecting...")
// console.log(await connection.disconnect())
// console.log("Disconnecting completed.")
