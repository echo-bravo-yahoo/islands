import get from "lodash/get.js";

import { globals } from "../index.js";
import { Temp } from "../util/temp.js";
import { Sensor } from "./generic-sensor.js";
import { logWeatherToInflux } from "./influxdb.js";

let bme280Sensor;

export class BME280 extends Sensor {
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
        offsets: {
          temp: get(this.currentState, "offsets.temp", 0),
          humidity: get(this.currentState, "offsets.humidity", 0),
          pressure: get(this.currentState, "offsets.pressure", 0),
        },
      },
      temp: new Temp(this.aggregateMeasurement("temp.result"), "f").value({
        precision: 2,
      }),
      humidity: Number(this.aggregateMeasurement("humidity.result")).toFixed(2),
      pressure: Number(this.aggregateMeasurement("pressure.result")).toFixed(2),
    };

    this.samples = [];

    return aggregated;
  }

  async sample() {
    if (!this.currentState.enabled) return;
    const sensorData = await this.sensor.read();

    const datapoint = {
      metadata: {
        island: globals.name,
        timestamp: new Date(),
      },
      temp: {
        raw: sensorData.temperature,
        converted: new Temp(sensorData.temperature, "c").to("f").value(),
        offset: get(this.currentState, "offsets.temp"),
        result: new Temp(sensorData.temperature, "c")
          .to("f")
          .add(get(this.currentState, "offsets.temp", 0), "f")
          .value(),
      },
      humidity: {
        raw: sensorData.humidity,
        offset: get(this.currentState, "offsets.humidity", 0),
        result:
          sensorData.humidity + get(this.currentState, "offsets.humidity", 0),
      },
      pressure: {
        raw: sensorData.pressure,
        offset: get(this.currentState, "offsets.pressure", 0),
        result:
          sensorData.pressure + get(this.currentState, "offsets.pressure", 0),
      },
    };

    this.debug({}, `Sampled new data point`);
    this.samples.push(datapoint);
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
      `data/weather/${globals.state.location || "unknown"}`,
      JSON.stringify(payload)
    );

    await logWeatherToInflux(payload, { ...globals.state, ...this.currentState });

    if (this.currentState.remoteSensor) {
      // cmnd/destination/HVACRemoteTemp degreesC
      // HVACRemoteTemp 22
      // HVACRemoteTempClearTime 300000

      const sensorPayload = new Temp(payload.temp, "f")
        .to("c")
        .value({ precision: 1, stepSize: 0.5 });

      globals.connection.publish(
        this.currentState.remoteSensor.topic,
        JSON.stringify(sensorPayload)
      );
      this.info(
        { role: "blob", blob: payload },
        `Publishing new bme280 remote sensor data to ${this.currentState.remoteSensor.topic}: ${sensorPayload}`
      );
    }

    this.info(
      { role: "blob", blob: payload },
      `Publishing new bme280 data to data/weather/${globals.state.location || "unknown"}: ${JSON.stringify(payload)}`
    );
  }

  async enable() {
    bme280Sensor = await import("bme280");
    this.sensor = await bme280Sensor.open({
      i2cAddress: Number(this.currentState.i2cAddress) || 0x76,
    });
    this.setupPublisher();
    this.info({}, `Enabled bme280.`);
    this.currentState.enabled = true;
  }

  async disable() {
    clearInterval(this.interval);
    if (this.sensor) await this.sensor.close();
    this.info({}, `Disabled bme280.`);
    this.currentState.enabled = false;
  }
}

/*
{
  "enabled": true,
  "offsets": {
    "temp": "",
    "gas": "",
    "light": "",
    "sound": "",
    "humidity": "",
    "pressure": ""
  },
  "sampling": {
    "interval": "",
    "aggregation": "latest|average|median|pX"
  },
  "reporting": {
    "interval": ""
  }
}
*/

const bme280 = new BME280("bme280");
export default bme280;
