#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { readFileSync } from 'fs'
import { spawn, spawnSync, execSync } from 'child_process'
import { normalize, join } from 'path'
import { Client } from 'ssh2';

const islands = [
  {
    "name": "skidaway",
    "ip": "129.168.1.127",
    "location": "den",
    "locationHuman": "home office",
    "attached": ["bme680", "thermal-printer"],
    "user": "pi",
    "certLocation": "/home/swift/.ssh/diag-instance.key"
  },
  {
    "name": "fiji",
    "ip": "129.168.1.126",
    "location": "porch",
    "locationHuman": "outside porch",
    "attached": [],
    "user": "pi",
    "certLocation": "/home/swift/.ssh/diag-instance.key"
  }
]

yargs(hideBin(process.argv))
  .command({
    command: 'info',
    description: 'list all the known islands',
    builder: yargs => {
      return yargs
    },
    handler: args => {
      function formatIsland(island) {
        let ret = ''

        ret += `${island.name} (${island.ip})\n`
        ret += `  ${island.location}\n`
        ret += `  ${island.attached}`

        return ret
      }

      islands.forEach((island) => console.log(formatIsland(island)))
    }
  })
  .command({
    command: 'ssh <island>',
    description: 'ssh to an island',
    builder: yargs => {
      return yargs
    },
    handler: args => {
      const destination = islands.find((island) => island.name === args.island)
      const config = {
          host: destination.ip,
          port: 22,
          username: destination.user
      }

      if (destination.password) {
        config.password = destination.password
      }

      if (destination) {
        console.log('sshing...')
        /*
        console.log(execSync('whoami').toString())
        process.stdin.setRawMode(false)
        let a = spawn(`ssh`, ['-l pi', `-i ${destination.certLocation}`, `pi@${destination.ip}`, '-T', '-o StrictHostKeyChecking=no'], {
          stdio: [process.stdin, process.stdout, process.stderr],
          shell: '/bin/zsh'
        })
        a.on('connection', () => { console.log('connected') })
        a.on('data', () => { console.log('data') })
        a.on('error', () => { console.log('error') })
        const { readFileSync } = require('fs');
        */

        const conn = new Client();
        conn.on('ready', () => {
          console.log('Client :: ready');
          conn.shell((err, stream) => {
            if (err) throw err;
            stream.on('close', () => {
              console.log('Stream :: close');
              conn.end();
            }).on('data', (data) => {
              console.log('OUTPUT: ' + data);
            });
            stream.end('ls -l\nexit\n');
          });
        }).connect({
          host: destination.ip,
          port: 22,
          username: 'pi',
          privateKey: readFileSync(destination.certLocation),
          debug: console.log
        });
      } else {
        console.error(`could not find island ${args.island}`)
      }
    }
  })
  .help()
  .argv
