import { mqtt } from 'aws-iot-device-sdk-v2'

import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const imagePath = __dirname + '/thermal-printer-images/nodebot.png'

import { globals } from '../index.js'
import { Module } from './generic-module.js'

let SerialPort, Printer

export class ThermalPrinter extends Module {
  constructor(stateKey) {
    super(stateKey)

    this.lastReceived = 0

    this.paths = {
      'enabled': { handler: this.handleEnabled, order: 0 }
    }
  }

  processLine(line) {
    if(line.startsWith("# ")) {
      this.printer.bold(true).big(true).printLine(line.substring(2)).bold(false).big(false)
    } else if(line.startsWith("## ")) {
      this.printer.big(true).printLine(line.substring(3)).big(false)
    } else if(line.startsWith("### ")) {
      this.printer.underline(6).printLine(line.substring(4)).underline(0)
    } else if(line.startsWith("#### ")) {
      this.printer.underline(1).printLine(line.substring(5)).underline(0)
    } else if(line.startsWith("##### ")) {
      this.printer.printLine(line.substring(6))
    } else if(line.startsWith("###### ")) {
      this.printer.small(true).bold(true).printLine(line.substring(7)).small(false).bold(false)
    } else if(line.startsWith("- ")) {
      this.printer.small(true).printLine("  " + line).small(false)
    } else {
      this.printer.small(true).printLine(line).small(false)
    }
  }

  async handlePrintRequest(topic, request) {
    this.info({}, `Handling thermal printer print request...`)
    const payload = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(request)))
    this.info({ role: 'blob', blob: payload }, `Print request:`)
    if (payload.timestamp <= this.lastReceived) {
      this.info({}, `Disregarding old message with timestamp ${payload.timestamp}, which is older than lastReceived of ${this.lastReceived}.`)
    } else {
      const message = payload.message
      this.lastReceived = payload.lastReceived
      const lines = message.split('\n')
      for(let i = 0; i < lines.length; i++) {
        this.printer.reset()
        processLine(lines[i], this.printer)
      }
      this.printer.printLine('\n\n\n')
      this.printer.print(() => {
        this.info({}, `Handled thermal printer print request.`)
      })
    }
  }

  async enable() {
    return new Promise((resolve, reject) => {
      this.info({}, `Enabling thermal printer...`)
      SerialPort = import('serialport').SerialPort
      Printer = import('thermalprinter').Printer

      this.enabled = true

      // TODO: Support checking paper status
      // TODO: Consider printing QR codes or arbitrary images
      this.info({}, `Enabling thermal printer serial connection...`)
      const serialPort = new SerialPort({ path: '/dev/ttyS0', baudRate: 19200 })
      serialPort.on('open',function() {
        this.printer = new Printer(serialPort)
        this.printer.on('ready', async function() {
          const topic = `commands/printer/${globals.configs[0].currentState.location}`
          this.info({}, `Enabled thermal printer serial connection.`)
          this.info({}, `Enabling thermal printer mqtt subscription to topic ${topic}...`)
          await globals.connection.subscribe(topic, mqtt.QoS.AtLeastOnce, handlePrintRequest)
          this.info({}, `Enabled thermal printer mqtt subscription to topic ${topic}.`)
          resolve()
        }).on('error', function(error) {
          reject(error)
          this.error(error)
        })
      }).on('error', function(error) {
        reject(error)
        this.error(error)
      }).on('close', function(close) {
        reject(error)
        this.error(close)
      })
    })
  }

  async disable() {
    this.info({ role: 'breadcrumb' }, `Disabling thermal printer...`)
    this.enabled = false
    this.printer = undefined
    this.info({ role: 'breadcrumb' }, `Disabled thermal printer.`)
  }
}

const thermalPrinter = new ThermalPrinter('thermalPrinter')
export default thermalPrinter
