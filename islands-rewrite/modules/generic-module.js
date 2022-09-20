import set from 'lodash/set.js'
import isEqual from 'lodash/isEqual.js'

import { Stateful } from './generic-stateful.js'
import { updateReportedShadow } from '../shadow.js'

export class Module extends Stateful {
  constructor(stateKey, enable, disable, register) {
    super(stateKey)
    this.register = register
    this.enable = enable
    this.disable = disable
  }

  async handleDeltaState(delta) {
    this.handleState({ delta })
  }

  async handleStateChange(newState, reported) {
    this.currentState = newState
    if (newState.enabled) {
      await this.enable()
    } else {
      await this.disable()
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
}
