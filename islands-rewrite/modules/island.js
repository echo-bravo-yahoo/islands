import { Config } from './generic-config.js'

export class Island extends Config {
  constructor(stateKey) {
    super(stateKey)
  }

  init() {}
}

const island = new Island('island')
export default island
