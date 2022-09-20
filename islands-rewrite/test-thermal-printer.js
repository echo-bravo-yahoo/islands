import { SerialPort } from 'serialport'
const serialPort = new SerialPort({ path: '/dev/ttyS0', baudRate: 19200 })
import Printer from 'thermalprinter'

import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const imagePath = __dirname + '/modules/thermal-printer-images/nodebot.png'

serialPort.on('open',function() {
  var printer = new Printer(serialPort, {
    maxPrintingDots: 1,
    heatingTime: 255,
    heatingInterval: 255
  })
  printer.on('ready', function() {
    printer
      .indent(10)
      .horizontalLine(16)
      .bold(true)
      .indent(10)
      .printLine('first line')
      .bold(false)
      .inverse(true)
      .big(true)
      .right()
      .printLine('second line')
      .printImage(imagePath)
      .printLine('')
      .printLine('')
      .printLine('')
      .print(function() {
        console.log('done')
        process.exit()
      })
  })
})
