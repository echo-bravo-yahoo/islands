import get from "lodash/get.js";

import { globals } from "../index.js";
import { Sensor } from "./generic-sensor.js";

let ble, adapter;
const deviceMap = {};

export class BLETracker extends Sensor {
  constructor(stateKey) {
    super(stateKey);

    this.stateKey = stateKey;
  }

  async register() {
    this.currentState = get(globals, `state["${this.stateKey}"]`, {
      enabled: false,
    });

    if (this.currentState.enabled) {
      this.enable();
    }
  }

  aggregate() {
    const aggregation =
      this.samples.length === 1
        ? "latest"
        : get(this.currentState, "sampling.aggregation", "average");

    this.info({ blob: this.samples }, `Aggregating.`);
    const aggregated = {
      metadata: {
        island: globals.name,
        timestamp: new Date(),
      },
      aggregationMetadata: {
        samples: this.samples.length,
        aggregation,
      },
      rssi: Number(this.aggregateMeasurement("rssi.result")).toFixed(0),
    };

    this.samples = [];

    return aggregated;
  }

  async sampleOne(deviceSpec) {
    const deviceKey = deviceSpec.alias || deviceSpec.macAddress;
    let rssi = -99;

    if (deviceMap[deviceKey]) {
      rssi = await device.getRSSI();
    }

    const datapoint = {
      metadata: {
        island: globals.name,
        timestamp: new Date(),
      },
      rssi: {
        raw: rssi,
        result: rssi,
      },
    };

    this.debug({}, `Sampled new data point`);
    if (!this.samples[deviceKey] || !this.samples[deviceKey].length) this.samples[deviceKey] = [];
    this.samples[deviceKey].push(datapoint);
  }

  async sample() {
    if (!this.currentState.enabled) return;

    await this.discoverAdvertisements();

    const promises = [];
    for (let device of this.currentState.devices) {
      promises.push(this.sampleOne(device));
    }

    return Promise.all(promises);
  }

  async publishReading() {
    if (
      get(this.currentState, "sampling") === undefined ||
      this.samples.length === 0
    ) {
      await this.sample();
    }

    const payload = this.aggregate();

    globals.connection.publish(
      `${this.currentState.mqttTopicPrefix || "data/ble"}/${globals.state.location || "unknown"}/${this.currentState.alias || this.currentState.macAddress}`,
      JSON.stringify(payload)
    );

    this.info(
      { role: "blob", blob: payload },
      `Publishing new BLE tracker data to ${this.currentState.mqttTopicPrefix || "data/ble"}/${globals.state.location || "unknown"}/${this.currentState.alias || this.currentState.macAddress}: ${JSON.stringify(payload)}`
    );
  }

  async discoverAdvertisements() {
    const nodeBLE = (await import("node-ble")).default;
    ble = nodeBLE.createBluetooth();
    adapter = await ble.bluetooth.defaultAdapter();

    if (!(await adapter.isDiscovering())) await adapter.startDiscovery();
    for (let device of this.currentState.devices) {
      const deviceKey = device.alias || device.macAddress;
      try {
        deviceMap[deviceKey] = await adapter.waitDevice(
          this.currentState.macAddress,
          1000
        );
      } catch (e) {
        // it's normal for missing devices to timeout
      }
    }
  }

  async enable() {
    await this.discoverAdvertisements();

    this.setupPublisher();
    this.info(
      {},
      `Enabled BLE tracker for device with MAC address ${this.currentState.macAddress}.`
    );
    this.currentState.enabled = true;
  }

  async disable() {
    clearInterval(this.interval);
    for (let device of Object.values(deviceMap)) {
      await device.disconnect();
    }
    ble.destroy();

    this.info(
      {},
      `Disabled BLE tracker for device with MAC address ${this.currentState.macAddress}.`
    );
    this.currentState.enabled = false;
  }
}

/*
{
  "enabled": true,
  "macAddress": "00:00:00:00:00:00",
  "alias": "some name to use for the MQTT topic",
  "sampling": {
    "interval": "",
    "aggregation": "latest|average|median|pX"
  },
  "reporting": {
    "interval": ""
  }
}
*/

const bleTracker = new BLETracker("bleTracker");
export default bleTracker;
