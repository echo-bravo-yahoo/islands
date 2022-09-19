import { Config } from './generic-config.js'
import { updateDesiredShadow } from '../shadow.js'
import { globals } from '../index.js'

export class Island extends Config {
  constructor(stateKey) {
    super(stateKey)
  }

  triggerStateChange() {
    // this will always try to update the shadow
    updateDesiredShadow({ [this.stateKey]: globals[this.stateKey] })
  }

  handleStateChange(newState, reported) {
    globals[this.stateKey] = newState

    if (!isEqual(newState, reported))
      updateShadow(set({}, path, newState))
  }
}
const island = new Island('island')
export default island
