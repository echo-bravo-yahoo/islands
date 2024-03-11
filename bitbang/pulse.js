function transmitPulse(pulse) {
  let wavePulses = []
  pulse.forEach((segment) => {
    // expectedCSV += `${segment.level},${0}\n`
    // expectedCSV += `${segment.level},${segment.duration}\n`

    if (segment.level === 0) {
      wavePulses = lowWaveFromDuration(segment.duration, wavePulses)
    } else {
      wavePulses = highWaveFromDuration(segment.duration, wavePulses)
    }
  })

  pigpio.waveAddGeneric(wavePulses)
  const waveId = pigpio.waveCreate()
  // fs.writeFileSync('./actual.csv', actualCSV)
  // fs.writeFileSync('./expected.csv', expectedCSV)

  setInterval(() => {
    console.log(`Transmitting new wave (expected length ${pulse.reduce((sum, current) => sum + current.duration, 0)}, actual length ${pigpio.waveGetMicros()}).`)
    pigpio.waveTxSend(waveId, pigpio.WAVE_MODE_ONE_SHOT)
    checkWave()
  }, 5000)
}

function checkWave(pigpio, cb) {
  setImmediate(() => {
    if (!pigpio.waveTxBusy()) {
      cb()
    } else {
      setImmediate(checkWave.bind(this, pigpio, cb))
    }
  })
}


module.exports = {
  transmitPulse,
  checkWave
}
