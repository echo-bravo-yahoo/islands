import { mqtt } from "aws-iot-device-sdk-v2";

import get from "lodash/get.js";

let Bme680;

import { globals } from "../index.js";
import { Sensor } from "./generic-sensor.js";
import { Temp } from "../util/temp.js";

export class BME680 extends Sensor {
  constructor(stateKey) {
    super(stateKey);

    this.paths = {
      virtual: { handler: this.copyState, order: 0 },
      enabled: { handler: this.handleEnabled, order: 1 },
      reporting: { handler: this.handleReporting, order: 2 },
    };
  }

  aggregate() {
    const aggregation =
      this.samples.length === 1
        ? "latest"
        : get(this.currentState, "sampling.aggregation");

    return {
      // is this preferable? or is globals.configs[0].currentState.name preferable?
      metadata: { island: globals.name, timestamp: new Date() },
      aggregationMetadata: {
        samples: this.samples.length,
        aggregation,
        offsets: {
          temp: get(this.currentState, "offsets.temp", 0),
          humidity: get(this.currentState, "offsets.humidity", 0),
          pressure: get(this.currentState, "offsets.pressure", 0),
          gas: get(this.currentState, "offsets.gas", 0),
        },
      },
      temp: new Temp(this.aggregateMeasurement("temp.result"))
        .to("f")
        .add(get(this.currentState, "offsets.temp", 0), "f")
        .value({ precision: 2 }),
      humidity:
        this.aggregateMeasurement("humidity.result") +
        get(this.currentState, "offsets.humidity", 0),
      pressure:
        this.aggregateMeasurement("pressure.result") +
        get(this.currentState, "offsets.pressure", 0),
      gas:
        this.aggregateMeasurement("gas") +
        get(this.currentState, "offsets.gas", 0),
    };
  }

  async sample() {
    const sensorData = await this.sensor.read();

    const datapoint = {
      metadata: {
        island: globals.configs[0].currentState.name,
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
      gas: {
        raw: sensorData.gas_resistance,
        offset: get(this.currentState, "offsets.gas", 0),
        result:
          sensorData.gas_resistance + get(this.currentState, "offsets.gas", 0),
      },
    };

    this.debug({}, `Sampled new data point`);
    this.samples.push(datapoint);
  }

  async publishReading() {
    if (get(this.currentState, "sampling") === undefined) {
      await this.sample();
    }

    if (this.currentState.virtual) {
      this.info(
        { role: "blob", blob: this.generateVirtualPayload() },
        `Publishing new bme680 data to data/weather/${globals.configs[0].currentState.location || "unknown"}: ${JSON.stringify(this.generateVirtualPayload())}`
      );
      return;
    }

    const payload = this.aggregate();

    globals.connection.publish(
      `data/weather/${globals.configs[0].currentState.location || "unknown"}`,
      payload,
      mqtt.QoS.AtLeastOnce
    );

    this.info(
      { role: "blob", blob: payload },
      `Publishing new bme680 data to data/weather/${globals.configs[0].currentState.location || "unknown"}: ${JSON.stringify(payload)}`
    );
  }

  async enable() {
    if (!this.currentState.virtual) {
      Bme680 = (await import("bme680-sensor")).default.Bme680;
      this.sensor = new Bme680(1, Number(this.currentState.i2cAddress) || 0x77);
      await this.sensor.initialize();
    }

    // TODO: ideally, this would re-calculate the next invocation to the correct time
    // right now, it sort of just is randomly between (newInterval) and
    // (newInterval+oldInterval)
    this.setupPublisher();
    this.info({}, `Enabled bme680.`);
    this.currentState.enabled = true;
  }

  async disable() {
    // TODO: do I need to turn off the sensor / close the connection?
    clearInterval(this.interval);
    this.info({}, `Disabled bme680.`);
    this.currentState.enabled = false;
  }

  generateVirtualPayload() {
    return {
      metadata: {
        island: globals.configs[0].currentState.name,
        timestamp: new Date(),
      },
      temp: 72 + get(this.currentState, "offsets.temp", 0),
      gas: 1000 + get(this.currentState, "offsets.gas", 0),
      humidity: 20 + get(this.currentState, "offsets.humidity", 0),
      pressure: 1000 + get(this.currentState, "offsets.pressure", 0),
    };
  }
}

const bme680 = new BME680("bme680");
export default bme680;
