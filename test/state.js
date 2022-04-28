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
describe('mint', () => {
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
  it('if paused, cannot mint', async () => {
    // pause
    let tx = await c0.token.methods(domain.address).setState(1).send()
    let cid = await nebulus.add(Buffer.from("abc"))
    let token = await c0.token.create({
      domain,
      body: { cid, }
    })
    tx = c0.token.mint([token])

    // try to mint => should fail
    await expect(tx).to.be.revertedWith(0)
  })
  it('can pause, and then re-open', async () => {
    let state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('0')
    // 1. pause
    let tx = await c0.token.methods(domain.address).setState(1).send()
    state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('1')
    // 2. open
    tx = await c0.token.methods(domain.address).setState(0).send()
    state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('0')
  })
  it('if frozen, cannot mint', async () => {
    let tx = await c0.token.methods(domain.address).setState(2).send()
    let cid = await nebulus.add(Buffer.from("abc"))
    let token = await c0.token.create({
      domain,
      body: { cid, }
    })
    tx = c0.token.mint([token])
    await expect(tx).to.be.revertedWith("0")
  })
  it('once frozen, cannot reopen', async () => {
    // 1. freeze
    let tx = await c0.token.methods(domain.address).setState(2).send()
    state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('2')
    // 2. try to open
    tx = c0.token.methods(domain.address).setState(0).send()
    await expect(tx).to.be.revertedWith("14")
  })
  it('once frozen, cannot change to paused', async () => {
    // 1. freeze
    let tx = await c0.token.methods(domain.address).setState(2).send()
    state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('2')
    // 2. try to open
    tx = c0.token.methods(domain.address).setState(1).send()
    await expect(tx).to.be.revertedWith("14")
  })
  it('can open when paused, cant open when frozen, can freeze when paused, cant pause when frozen', async () => {
    // can pause when open
    let tx = c0.token.methods(domain.address).setState(1).send()
    await expect(tx).to.not.be.reverted

    // try to open when paused => should work
    tx = c0.token.methods(domain.address).setState(0).send()
    await expect(tx).to.not.be.reverted

    // freeze and try to open  => should fail
    tx = await c0.token.methods(domain.address).setState(2).send()
    tx = c0.token.methods(domain.address).setState(0).send()
    await expect(tx).to.be.revertedWith("14")
    // try to pause when frozen => should fail
    tx = c0.token.methods(domain.address).setState(1).send()
    await expect(tx).to.be.revertedWith("14")


  })


  it('if paused, cannot setNS()', async () => {
    // pause
    let tx = await c0.token.methods(domain.address).setState(1).send()
    tx = c0.token.methods(domain.address).setNS("New name", "new symbol").send()
    await expect(tx).to.be.revertedWith("16")
  })
  it('if frozen, cannot setNS()', async () => {
    let tx = await c0.token.methods(domain.address).setState(2).send()
    tx = c0.token.methods(domain.address).setNS("New name", "new symbol").send()
    await expect(tx).to.be.revertedWith("16")
  })
  it('can pause, and then re-open and setNS()', async () => {
    let name = await c0.token.methods(domain.address).name().call()
    let symbol = await c0.token.methods(domain.address).symbol().call()
    expect(name).to.equal("Hello")
    expect(symbol).to.equal("WORLD")

    let state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('0')
    // 1. pause
    let tx = await c0.token.methods(domain.address).setState(1).send()
    state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('1')
    // 2. open
    tx = await c0.token.methods(domain.address).setState(0).send()
    state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('0')

    tx = await c0.token.methods(domain.address).setNS("New name", "new symbol").send()
    name = await c0.token.methods(domain.address).name().call()
    symbol = await c0.token.methods(domain.address).symbol().call()
    expect(name).to.equal("New name")
    expect(symbol).to.equal("new symbol")
  })


  it('if paused, cannot setBaseURI()', async () => {
    // pause
    let tx = await c0.token.methods(domain.address).setState(1).send()
    tx = c0.token.methods(domain.address).setBaseURI("https://mysite.com/files").send()
    await expect(tx).to.be.revertedWith("15")
  })
  it('if frozen, cannot setBaseURI()', async () => {
    let tx = await c0.token.methods(domain.address).setState(2).send()
    tx = c0.token.methods(domain.address).setBaseURI("https://mysite.com/files").send()
    await expect(tx).to.be.revertedWith("15")
  })
  it('can pause, and then re-open and setBaseURI()', async () => {
    let baseURI = await c0.token.methods(domain.address).baseURI().call()
    console.log("baseURI", baseURI)
    expect(baseURI).to.equal("")

    let state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('0')
    // 1. pause
    let tx = await c0.token.methods(domain.address).setState(1).send()
    state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('1')
    // 2. open
    tx = await c0.token.methods(domain.address).setState(0).send()
    state = await c0.token.methods(domain.address).state().call()
    expect(state).to.equal('0')

    tx = await c0.token.methods(domain.address).setBaseURI("https://mysite.com/files").send()
    baseURI = await c0.token.methods(domain.address).baseURI().call()
    console.log("baseURI", baseURI)
  })


})
