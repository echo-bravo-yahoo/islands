import get from "lodash/get.js";

import { Module } from "./generic-module.js";

export class Sensor extends Module {
  constructor(stateKey) {
    super(stateKey);

    this.interval = undefined;
    this.sensor = undefined;
  }

  setupPublisher() {
    if (this.interval) clearInterval(this.interval);
    this.publishReading().then(() => {
      this.interval = setInterval(
        this.publishReading.bind(this),
        this.getReportingInterval()
      );
    });
  }

  async handleReporting(newState) {
    this.info(
      {},
      `Updating reporting interval from ${this.getReportingInterval()} to ${newState.reporting.interval}.`
    );
    this.currentState.reporting = newState.reporting;

    // TODO: ideally, this would re-calculate the next invocation to the correct time
    // right now, it sort of just is randomly between (newInterval) and
    // (newInterval+oldInterval)
    this.setupPublisher.bind(this)();
  }

  getReportingInterval() {
    return get(this.currentState, "reporting.interval", 60 * 1000);
  }
}
