import { Config } from './generic-config.js'
import { updateShadow } from '../shadow.js'
import { globals } from '../index.js'

export class Island extends Config {
  constructor(stateKey) {
    super()
    this.stateKey = stateKey
  }

  handleStateChange(newState, reported) {
    globals[this.stateKey] = newState

    if (!isEqual(newState, reported))
      updateShadow(set({}, path, newState))
  }
}
const island = new Config('island')
export default island
