import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const config = require('./config.json')
import { globals } from './index.js'

// docs: https://aws.github.io/aws-iot-device-sdk-js-v2/node/index.html
import { mqtt, iot } from 'aws-iot-device-sdk-v2'

export function buildConnection() {
  let config_builder =
    iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(config.certFilePath, config.privateKeyFilePath)

  config_builder.with_certificate_authority_from_path(undefined, config.awsCertFilePath)
  config_builder.with_clean_session(false)
  config_builder.with_client_id(config.name + '2')
  config_builder.with_endpoint(config.endpoint)
  const clientConfig = config_builder.build()
  const client = new mqtt.MqttClient()
  const connection = client.new_connection(clientConfig)

  connection.on('connect', (session_present) => globals.logger.info({ role: 'breadcrumb', tags: ['mqtt'] }, `Connected to MQTT ${session_present ? 'with a new' : 'with an existing'} session.`))

  connection.on('disconnect', (session_present) => globals.logger.info({ role: 'breadcrumb', tags: ['mqtt'] }, `Disconnected from MQTT session.`))

  connection.on('error', (err) => globals.logger.error({ err, tags: ['mqtt'] }, `Error with MQTT session.`))

  connection.on('interrupt', (err) => globals.logger.error({ err, tags: ['mqtt'] }, `MQTT session interrupted.`))

  connection.on('resume', (err) => globals.logger.info({ role: 'breadcrumb', tags: ['mqtt'] }, `MQTT session resumed.`))

  return connection
}
