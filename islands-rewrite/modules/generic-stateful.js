import isEqual from 'lodash/isEqual.js'
import get from 'lodash/get.js'
import merge from 'lodash/merge.js'

import { globals } from '../index.js'

export class Stateful {
  constructor(stateKey) {
    // set the initial state
    this.enabled = undefined
    this.currentState = {}
    this.stateKey = stateKey
    this.log = (...args) => globals.logger.info({ ...args[0], role: 'breadcrumb', component: this.stateKey }, args[1], args[2])
    this.logBlob = (...args) => globals.logger.debug({ ...args[0], role: 'blob', component: this.stateKey }, args[1], args[2])
  }

  async handleDeltaState(delta) {
    this.handleState({ delta })
  }

  // TODO: mostly a carbon copy of generic-module.genericHandleState
  async genericHandleState({ desired: _desired, delta: _delta, reported: _reported, path, type, shortPath }) {
    if (type === shortPath) {
      globals.logger.info({ role: 'breadcrumb' }, `Received new state for ${shortPath}.`)
    } else {
      globals.logger.info({ role: 'breadcrumb' }, `Received new state for ${type} ${shortPath}.`)
    }
    const desired = get(_desired, path)
    const delta = get(_delta, path)
    const reported = get(_reported, path)

    let merged
    if (delta) {
      merged = merge({}, this.currentState, delta)
    } else if (desired) {
      merged = merge({}, this.currentState, desired)
    } else {
      merged = merge({}, this.currentState, reported)
    }

    function logIfDefined(name, value) {
      return `${name} is currently ${value !== undefined ? 'defined:' : 'undefined.'}`
    }

    globals.logger.debug({ role: 'blob', tags: ['shadow'], state: { delta, desired, reported, currentState: this.currentState, merged }, path, shortPath }, 'Shadow state:')

    if (desired === undefined && !isEqual(merged, reported)) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `${shortPath} not specified in shadow. Skipping.`)
    } else if (delta && !isEqual(this.currentState, merged)) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `Modifying ${shortPath} to reflect a merge of delta state and current state.`)
      globals.logger.debug({ role: 'blob', tags: ['shadow'], currentState: this.currentState }, logIfDefined('Merged state', this.currentState))
      this.handleStateChange(merged, reported)
    } else if (desired && !isEqual(desired, this.currentState)) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `Modifying ${shortPath} because it does not match the desired state.`)
      this.handleStateChange(desired, reported)
    } else {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `No change to ${shortPath} necessary for this state update.`)
    }
  }
}
