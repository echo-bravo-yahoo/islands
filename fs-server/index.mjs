import { WebUSB } from 'usb'
import { usb } from 'usb'
const webusb = new WebUSB({ allowAllDevices: true })

console.log(usb.getDeviceList())

/*
usb.addEventListener('connect', function(device) {
  console.log('connected:', JSON.stringify(device))
})

usb.addEventListener('disconnect', function(device) {
  console.log('disconnected:', JSON.stringify(device))
})
*/

//(async () => {
    // Uses blocking calls, so is async
    const devices = await webusb.getDevices();
console.log('devices', devices.length)

    for (const device of devices) {
        console.log(device); // WebUSB device
    }
//})();
