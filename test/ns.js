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
const cid2 = "bafkreibwb3avav7qxnckwwzdzddmwp2xuogjtfgrdbgqlnzjquvg7chxpa"
const parsed = CID.parse(cid).toString(base16.encoder)
const parsed2 = CID.parse(cid2).toString(base16.encoder)
const cidDigest = "0x" + parsed.slice(9);
const cidDigest2 = "0x" + parsed2.slice(9);
const id = (x) => {
  return ethers.BigNumber.from(x).toString()
}
const c0 = new C0()
var domain = {}
describe('ns', () => {
  beforeEach(async () => {
    await hre.network.provider.send("hardhat_reset")
    await util.deploy();
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    // get address for the custom wallet
    // send some funds to the custom wallet address so it has the money to do stuff
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: c0.account,
      value: "" + Math.pow(10, 20)
    })
    let tx1 = await c0.collection.create({
      factory: util.factory.address,
      index: 0,
      name: "Hello",
      symbol: "WORLD"
    })
    domain.address = tx1.logs[0].address
    domain.chainId = await web3.eth.getChainId()
    domain.name = "Hello"
  })
  it('setNS() should update the name and symbol', async () => {
    let name = await c0.token.methods(domain.address).name().call()
    let symbol = await c0.token.methods(domain.address).symbol().call()
    expect(name).to.equal("Hello")
    expect(symbol).to.equal("WORLD")
    let tx = await c0.token.methods(domain.address).setNS("Bye", "Land").send()

    name = await c0.token.methods(domain.address).name().call()
    symbol = await c0.token.methods(domain.address).symbol().call()
    expect(name).to.equal("Bye")
    expect(symbol).to.equal("Land")

  })
  it('setNS() should not change the results of factory.find() is called', async () => {

    const implementation = await c0.collection.methods(util.factory.address).implementation().call()
    let collections = await c0.collection.find({
      factory: util.factory.address,
      implementation: implementation,
      creator: c0.account,
      start: 0,
      count: 10
    })

    let tx = await c0.token.methods(domain.address).setNS("Bye", "Land").send()

    let collections2 = await c0.collection.find({
      factory: util.factory.address,
      implementation: implementation,
      creator: c0.account,
      start: 0,
      count: 10
    })
    expect(collections).to.deep.equal(collections2)
  })
  it("name and symbol do not influence the generated contract address", async () => {

    // Reset
    await hre.network.provider.send("hardhat_reset")
    await util.deploy();
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })

    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: c0.account,
      value:  new web3.utils.BN(10).pow(new web3.utils.BN(21))
    })

    // Create 10 collections
    let addresses0 = []
    for(let i=0; i<5; i++) {
      let tx = await c0.collection.create({
        factory: util.factory.address,
        index: i,
        name: "ALICE",
        symbol: "ALICE",
      })
      let contractAddress = tx.logs[1].address
      addresses0.push(contractAddress)
    }

    // Reset
    await hre.network.provider.send("hardhat_reset")
    await util.deploy();
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })

    tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: c0.account,
      value:  new web3.utils.BN(10).pow(new web3.utils.BN(21))
    })

    let addresses1 = []
    for(let i=0; i<5; i++) {
      let tx = await c0.collection.create({
        factory: util.factory.address,
        index: i,
        name: "BOB",
        symbol: "BOB",
      })
      let contractAddress = tx.logs[1].address
      addresses1.push(contractAddress)
    }
    expect(addresses0).to.deep.equal(addresses1)

    const implementation = await c0.collection.methods(util.factory.address).implementation().call()
    // predict collection addresses
    const calculated = await c0.collection.find({
      factory: util.factory.address,
      implementation: implementation,
      creator: c0.account,
      start: 0,
      count: 5
    })
    expect(addresses0.map((x) => { return x.toLowerCase() }))
      .to.deep.equal(calculated.map((x) => { return x.toLowerCase() }))
  })
})
