import isEqual from 'lodash/isEqual.js'
import get from 'lodash/get.js'
import merge from 'lodash/merge.js'

import { globals } from '../index.js'
import { updateShadow } from '../shadow.js'

export class Module {
  constructor(stateKey, enable, disable, register) {
    this.register = register
    this.enable = enable
    this.disable = disable
    this.stateKey = stateKey

    // set the initial state
    this.enabled = undefined
    this.currentState = {}
  }

  handleDeltaState(delta) {
    handleState({ delta })
  }

  // takes in the entire state tree and decomposes it to the ones relevant to this module
  async handleState({ desired: _desired, delta: _delta, reported: _reported }) {
    globals.logger.info({ role: 'breadcrumb' }, `Received new state for module ${this.stateKey}.`)
    const desired = get(_desired, `modules[${this.stateKey}]`)
    const delta = get(_delta, `modules[${this.stateKey}]`)
    const reported = get(_reported, `modules[${this.stateKey}]`)
    const merged = merge({ ...this.currentState }, delta)

    function logIfDefined(name, value) {
      return `${name} is currently ${value !== undefined ? 'defined:' : 'undefined.'}`
    }

    globals.logger.debug({ role: 'blob', tags: ['shadow'], state: { delta, desired, reported, currentState: this.currentState, merged } }, 'Shadow state:')

    if (this.enabled === undefined && desired === undefined) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `${this.stateKey} not specified in shadow. Skipping.`)
    } else if (this.enabled === undefined) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `${this.stateKey} not yet enabled or disabled. Setting ${this.stateKey} to ${desired.enabled ? 'enabled' : 'disabled'} to match desired state.`)
      this.currentState = desired
      if (desired.enabled) {
        await this.enable()
      } else {
        await this.disable()
      }

      if (!isEqual(desired, reported))
        updateShadow({ modules: { [this.stateKey]: desired } })

    } else if (delta && !isEqual(this.currentState, merged)) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `Modifying ${this.stateKey} to reflect a merge of delta state and current state.`)
      this.currentState = merged
      globals.logger.debug({ role: 'blob', tags: ['shadow'], currentState: this.currentState }, logIfDefined('Merged state', this.currentState))
      //TODO: this is sort of a duplicate of this.enabled...
      if (this.currentState.enabled) {
        await this.enable()
      } else {
        await this.disable()
      }

      updateShadow({ modules: { [this.stateKey]: merged } })
    } else if (desired && !isEqual(desired, this.currentState)) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `Modifying ${this.stateKey} because it does not match the desired state.`)
      this.currentState = desired
      if (desired.enabled) {
        await this.enable()
      } else {
        await this.disable()
      }
      updateShadow({ modules: { [stateKey]: desired } })
    } else {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `No change to ${stateKey} necessary for this state update.`)
    }
  }
}
