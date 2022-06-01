const hre = require('hardhat');
const { CID } = require('multiformats/cid')
const { base16 } = require("multiformats/bases/base16")
const { ethers, web3, Web3 } = hre
const { expect } = require('chai')
const Nebulus = require('nebulus')
const path = require('path')
const Util = require('./util.js')
const C0 = require('c0js')
const util = new Util()
const NAME = "test"
const SYMBOL = "TS"
const nebulus = new Nebulus()
var f1
const cid = "bafybeibfcfoxxarcrduavcl5uc2hugizg4k3ytlva64hev6xegjmcbu7va"
const parsed = CID.parse(cid).toString(base16.encoder)
const cidDigest = "0x" + parsed.slice(9);
const id = (x) => {
  return ethers.BigNumber.from(x).toString()
}
const c0 = new C0()
describe('collection', () => {
  beforeEach(async () => {
    await hre.network.provider.send("hardhat_reset")
    await util.deploy();
    await c0.init({ web3, })
  })
  it('should be able to predict future contract addresses from offline', async () => {
    const implementation = await c0.collection.methods(util.factory.address).implementation().call()
    // predict collection addresses
    const collections = await c0.collection.find({
      factory: util.factory.address,
      implementation: implementation,
      creator: c0.account,
      start: 0,
      count: 10
    })
    // actually create collections
    for(let i=0; i<10; i++) {
      let tx = await c0.collection.create({
        factory: util.factory.address,
        index: i,
        name: "Hello",
        symbol: "WORLD"
      })
      // compare created contract addresses with the predicted addresses
      expect(tx.events.OwnershipTransferred[0].address.toLowerCase())
      .to.equal(collections[i].toLowerCase())
    }
  })
  it('should be able to predict future contract addresses onchain', async () => {
    // predict collection addresses on-chain (factory method)
    let cs = await c0.collection.methods(util.factory.address).find(
      c0.account,
      0,
      10
    ).call()

    // actually create collections
    for(let i=0; i<10; i++) {
      let tx = await c0.collection.create({
        factory: util.factory.address,
        index: i,
        name: "Hello",
        symbol: "WORLD"
      })
      // compare created contract addresses with the predicted addresses
      expect(tx.events.OwnershipTransferred[0].address.toLowerCase())
      .to.equal(cs[i].toLowerCase())
    }
  })
  it('create collection', async () => {
    let addresses = []
    for(let i=0; i<10; i++) {
      let tx = await c0.collection.create({
        factory: util.factory.address,
        index: i,
        name: "Hello",
        symbol: "WORLD"
      })
      // compare created contract addresses with the predicted addresses
      addresses.push(tx.events.OwnershipTransferred[0].address.toLowerCase())
    }
    for(let address of addresses) {
      // try getting owner of the collections
      let owner = await c0.token.methods(address).owner().call()
      expect(owner).to.equal(c0.account)
    }
  })
})
