import { mqtt } from 'aws-iot-device-sdk-v2'

import { SerialPort } from 'serialport'
import Printer from 'thermalprinter'

import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const imagePath = __dirname + '/thermal-printer-images/nodebot.png'

let lastReceived = 0
let printer

import { globals } from '../index.js'
import { Module } from './generic-module.js'

const log = (...args) => globals.logger.info({ ...args[0], role: 'breadcrumb', component: 'thermalPrinter' }, args[1], args[2])
const logBlob = (...args) => globals.logger.debug({ ...args[0], role: 'blob', component: 'thermalPrinter' }, args[1], args[2])

async function register() {
}

function processLine(line, printer) {
  if(line.startsWith("# ")) {
    printer.bold(true).big(true).printLine(line.substring(2)).bold(false).big(false)
  } else if(line.startsWith("## ")) {
    printer.big(true).printLine(line.substring(3)).big(false)
  } else if(line.startsWith("### ")) {
    printer.underline(6).printLine(line.substring(4)).underline(0)
  } else if(line.startsWith("#### ")) {
    printer.underline(1).printLine(line.substring(5)).underline(0)
  } else if(line.startsWith("##### ")) {
    printer.printLine(line.substring(6))
  } else if(line.startsWith("###### ")) {
    printer.small(true).bold(true).printLine(line.substring(7)).small(false).bold(false)
  } else if(line.startsWith("- ")) {
    printer.small(true).printLine("  " + line).small(false)
  } else {
    printer.small(true).printLine(line).small(false)
  }
}

async function handlePrintRequest(topic, request) {
  log({}, `Handling thermal printer print request...`)
  const payload = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(request)))
  logBlob({ blob: payload }, `Print request:`)
  if (payload.timestamp <= lastReceived) {
    log({}, `Disregarding old message with timestamp ${payload.timestamp}, which is older than lastReceived of ${lastReceived}.`)
  } else {
    const message = payload.message
    lastReceived = payload.lastReceived
    const lines = message.split('\n')
    for(let i = 0; i < lines.length; i++) {
      printer.reset()
      processLine(lines[i], printer)
    }
    printer.printLine('\n\n\n')
    printer.print(() => {
      log({}, `Handled thermal printer print request.`)
    })
  }
}

async function enable() {
  return new Promise((resolve, reject) => {
    log({}, `Enabling thermal printer...`)
    this.enabled = true

    // TODO: Support checking paper status
    // TODO: Consider printing QR codes or arbitrary images
    log({}, `Enabling thermal printer serial connection...`)
    const serialPort = new SerialPort({ path: '/dev/ttyS0', baudRate: 19200 })
    serialPort.on('open',function() {
      printer = new Printer(serialPort)
      printer.on('ready', async function() {
        const topic = `commands/printer/${globals.configs[0].location}`
        log({}, `Enabled thermal printer serial connection.`)
        log({}, `Enabling thermal printer mqtt subscription to topic ${topic}...`)
        await globals.connection.subscribe(topic, mqtt.QoS.AtLeastOnce, handlePrintRequest)
        log({}, `Enabled thermal printer mqtt subscription to topic ${topic}.`)
        resolve()
      }).on('error', function(error) {
        reject(error)
        globals.logger.error(error)
      })
    }).on('error', function(error) {
      reject(error)
      globals.logger.error(error)
    }).on('close', function(close) {
      reject(error)
      globals.logger.error(close)
    })
  })
}

async function disable() {
  globals.logger.info({ role: 'breadcrumb' }, `Disabling thermal printer...`)
  this.enabled = false
  this.printer = undefined
  globals.logger.info({ role: 'breadcrumb' }, `Disabled thermal printer.`)
}

const thermalPrinter = new Module('thermalPrinter', enable, disable, register)
export default thermalPrinter
