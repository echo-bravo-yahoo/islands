import set from 'lodash/set.js'
import isEqual from 'lodash/isEqual.js'
import merge from 'lodash/merge.js'
import get from 'lodash/get.js'

import { Stateful } from './generic-stateful.js'
import { updateReportedShadow } from '../shadow.js'

import { globals } from '../index.js'

export class Module extends Stateful {
  constructor(stateKey, enable, disable, register) {
    super(stateKey)
    this.register = register
    this.enable = enable
    this.disable = disable
  }

  // TODO: mostly a carbon-copy of generic-module.handleStateChange
  async handleStateChange(newState, reported) {
    this.currentState = newState
    if (newState.enabled) {
      await this.enable(newState)
    } else {
      await this.disable(newState)
    }

    if (!isEqual(newState, reported))
      updateReportedShadow(set({}, `modules[${this.stateKey}]`, newState))
  }

  // takes in the entire state tree and decomposes it to the ones relevant to this module
  async handleState({ desired, delta, reported }) {
    this.genericHandleState({
      desired, delta, reported,
      shortPath: this.stateKey,
      path: `modules[${this.stateKey}]`,
      type: 'module'
    })
  }

  // TODO: mostly a carbon copy of generic-stateful.genericHandleState
  async genericHandleState({ desired: _desired, delta: _delta, reported: _reported, path, type, shortPath }) {
    if (type === shortPath) {
      globals.logger.info({ role: 'breadcrumb' }, `Received new state for ${shortPath}.`)
    } else {
      globals.logger.info({ role: 'breadcrumb' }, `Received new state for ${type} ${shortPath}.`)
    }
    const desired = get(_desired, path)
    const delta = get(_delta, path)
    const reported = get(_reported, path)
    const merged = merge({ ...this.currentState }, delta)

    function logIfDefined(name, value) {
      return `${name} is currently ${value !== undefined ? 'defined:' : 'undefined.'}`
    }

    globals.logger.debug({ role: 'blob', tags: ['shadow'], state: { delta, desired, reported, currentState: this.currentState, merged } }, 'Shadow state:')

    if (this.enabled === undefined && desired === undefined) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `${shortPath} not specified in shadow. Skipping.`)
    } else if (this.enabled === undefined) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `${shortPath} not yet enabled or disabled. Setting ${shortPath} to ${desired.enabled ? 'enabled' : 'disabled'} to match desired state.`)
      this.handleStateChange(desired, reported)
    } else if (delta && !isEqual(this.currentState, merged)) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `Modifying ${shortPath} to reflect a merge of delta state and current state.`)
      globals.logger.debug({ role: 'blob', tags: ['shadow'], currentState: this.currentState }, logIfDefined('Merged state', merged))
      this.handleStateChange(merged, reported)
    } else if (desired && !isEqual(desired, this.currentState)) {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `Modifying ${shortPath} because it does not match the desired state.`)
      this.handleStateChange(desired, reported)
    } else {
      globals.logger.info({ role: 'breadcrumb', tags: ['shadow'] }, `No change to ${shortPath} necessary for this state update.`)
    }
  }
}
