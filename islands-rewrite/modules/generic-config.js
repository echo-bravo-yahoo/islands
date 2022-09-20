import { Stateful } from './generic-stateful.js'

export class Config extends Stateful {
  constructor(stateKey) {
    super(stateKey)
  }

  handleDeltaState(delta) {
    handleState({ delta })
  }


  // takes in the entire state tree and decomposes it to the ones relevant to this module
  async handleState({ desired, delta, reported }) {
    this.genericHandleState({
      desired, delta, reported,
      shortPath: this.stateKey,
      path: this.stateKey,
      type: this.stateKey
    })
  }
}
