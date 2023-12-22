import { Config } from './generic-config.js'
import { updateDesiredShadow, updateReportedShadow } from '../shadow.js'
import { globals } from '../index.js'

export class Island extends Config {
  constructor(stateKey) {
    super(stateKey)
  }

  triggerStateChange() {
    // TODO: this will certainly cause bugs once i try to implement auto-update
    // always try to update the shadows
    updateReportedShadow({ [this.stateKey]: globals[this.stateKey] })
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
