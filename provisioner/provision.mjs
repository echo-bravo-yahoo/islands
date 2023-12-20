import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const config = require('./config.json')

import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

import { rmSync, cpSync, existsSync, accessSync, constants } from 'node:fs'
import { resolve, dirname } from 'path'
import { execSync, spawn } from 'child_process'

import { promisify } from 'node:util'

import { createKeysAndRegisterThing } from './iot-cp.mjs'

const img = '2023-12-11-raspios-bookworm-armhf-lite.img'

const nodeVersion = '17.9.1'
const arch = 'armv6l'

try {
  existsSync(resolve(`${config.authorizedKeys}`, `../islands/${config.hostname}-certificate.pem.cert`), constants.R_OK)
  existsSync(resolve(`${config.authorizedKeys}`, `../islands/${config.hostname}-private.pem.key`), constants.R_OK)
  existsSync(resolve(`${config.authorizedKeys}`, `../islands/${config.hostname}-public.pem.key`), constants.R_OK)
  console.log(`Found existing keys. Using them.`)
} catch (e) {
  if (e.code === 'ENOENT') {
console.log(e)
    console.log(`Keys not found for hostname ${config.hostname}. Creating new keys now.`)
    console.log(`Looked for keys in ${resolve(`${config.authorizedKeys}`, `../islands/${config.hostname}-public.pem.key`)}`)
    await createKeysAndRegisterThing()
  } else {
    throw e
  }
}

try {
  accessSync(resolve(__dirname, `node-v${nodeVersion}-linux-armv6l`))
  console.log(`Found node v${nodeVersion}, using that.`)
} catch (e) {
  if (e.code === 'ENOENT') {
    console.log(`Could not find node v${nodeVersion}, downloading it now.`)
    execSync(`
      wget --no-check-certificate --quiet https://unofficial-builds.nodejs.org/download/release/v${nodeVersion}/node-v${nodeVersion}-linux-${arch}.tar.xz >/dev/null && \
        tar -xf node-v${nodeVersion}-linux-${arch}.tar.xz >/dev/null
    `)
    console.log(`Done downloading node v${nodeVersion}.`)
 } else {
  throw e
  }
}

try {
  accessSync(resolve(__dirname, img))
  console.log(`Found base image ${img}, using that.`)
} catch (e) {
  if (e.code === 'ENOENT') {
    console.log(`Could not find base image ${img}, downloading it now.`)
    // TODO: Get rid of hardcoded datestamp, extract it from the img name
    execSync(`
      wget --no-check-certificate --quiet https://downloads.raspberrypi.com/raspios_lite_armhf/images/raspios_lite_${'armhf'}-2023-12-11/${img}.xz && \
        unxz ${img}.xz
    `)
    console.log(`Done downloading base image ${img}.`)
 } else {
  throw e
  }
}

if (false) {
  console.log('Deleting local node modules...')
  rmSync(resolve(__dirname, '../islands-rewrite/node_modules'), { recursive: true, force: true })
  console.log('Copying pre-built raspi 0 node modules...')
  cpSync(resolve(__dirname, './node_modules_prebuilt'), resolve(__dirname, '../islands-rewrite/node_modules'), { recursive: true })
}

console.log('Running sdm.')
let customize = 'sudo sdm --customize '
customize += `--plugin user:"setpassword=pi|password=${config.password}" `
customize += `--plugin L10n:host `
customize += `--plugin disables:piwiz `
customize += `--plugin network:"wifissid=${config.wifi.ssid}|wifipassword=${config.wifi.password}" `

// IoT application
customize += `--plugin mkdir:"dir=/home/pi/.ssh|chown=pi:pi" `
customize += `--plugin mkdir:"dir=/home/pi/islands|chown=pi:pi" `
customize += `--plugin mkdir:"dir=/home/pi/logs|chown=pi:pi" `
customize += `--plugin mkdir:"dir=/home/pi/workspace|chown=pi:pi" `
customize += `--plugin copydir:"from=${resolve(config.islands.srcPath)}|to=${config.islands.destPath}" `

// SSH authorized keys
customize += `--plugin copyfile:"from=${config.authorizedKeys}|to=/home/pi/.ssh" `

// AWS IoT certs
customize += `--plugin copyfile:"from=/home/pi/.ssh/islands/${config.hostname}-certificate.pem.crt|to=/home/pi/islands" `
customize += `--plugin copyfile:"from=/home/pi/.ssh/islands/${config.hostname}-private.pem.key|to=/home/pi/islands" `
customize += `--plugin copyfile:"from=/home/pi/.ssh/islands/${config.hostname}-public.pem.key|to=/home/pi/islands" `
customize += `--plugin copyfile:"from=/home/pi/.ssh/islands/AmazonRootCA1.pem|to=/home/pi/islands" `

// aws-iot-device-sdk-v2 build
// cmake and golang are required to build aws-crt
customize += `--plugin apps:"name=dev|apps=git,cmake,golang" `

// default swap is 100 mb, and is too small to compile aws-crt (dependency of aws-iot-device-sdk-v2)
// have not dialed it in yet, but 4 GB does provide enough headroom to build aws-crt
customize += `--plugin system:"name=swap|swap=4096" `

// customize += `--plugin raspiconfig:"overclock=`
customize += `--plugin raspiconfig:"i2c=1|serial=1" `

// extend the image to fit
customize += `--extend --xmb 2048 `

// install nodejs
customize += `--plugin copydir:"from=${resolve(__dirname, `./node-v${nodeVersion}-linux-${arch}`)}|to=/usr/local/node" `
customize += `--plugin runatboot:"user=pi|script=./install-node.sh|output=/home/pi/logs" `

customize += `--regen-ssh-host-keys `
customize += `--restart `
customize += `${img}`

async function sh(cmd) {
  return new Promise((resolve, reject) => {
    const subProcess = spawn(cmd, [], {
      cwd: process.cwd(),
      detached: true,
      shell: true,
      stdio: "inherit"
    })

    subProcess.on('close', resolve)
    subProcess.on('error', reject)
  })
}

await sh(customize)
await sh(`sudo sdm --shrink ${img}`)

const device = '/dev/sde'

let burn = `sudo sdm --burn ${device} `
burn += `--hostname ${config.hostname} `
burn += `--expand-root `
burn += `${img}`

console.log(burn, '\n')
