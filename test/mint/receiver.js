const hre = require('hardhat');
const { CID } = require('multiformats/cid')
const { base16 } = require("multiformats/bases/base16")
const { ethers, web3, Web3 } = hre
const { expect } = require('chai')
const Nebulus = require('nebulus')
const path = require('path')
const Util = require('../util.js')
const C0 = require('c0js')
const util = new Util()
const NAME = "test"
const SYMBOL = "TS"
const nebulus = new Nebulus()
var f1
//const cid = "bafybeibfcfoxxarcrduavcl5uc2hugizg4k3ytlva64hev6xegjmcbu7va"
const cid = "bafkreicwqno6pzrospmpufqigjj6dn7ylo7si5reajybci22n55evjgv7y"
const cid2 = "bafkreibwb3avav7qxnckwwzdzddmwp2xuogjtfgrdbgqlnzjquvg7chxpa"
const cid3 = "bafkreif7mc6e5babfrwzdfd7e424a2u7sptvrjlt6eisevnji5vcumhcd4"
const parsed = CID.parse(cid).toString(base16.encoder)
const parsed2 = CID.parse(cid2).toString(base16.encoder)
const parsed3 = CID.parse(cid3).toString(base16.encoder)
const cidDigest = "0x" + parsed.slice(9);
const cidDigest2 = "0x" + parsed2.slice(9);
const cidDigest3 = "0x" + parsed3.slice(9);
const id = (x) => {
  return ethers.BigNumber.from(x).toString()
}
const c0 = new C0()
var domain = {}
const fork = async (net) => {
  let f;
  if (net === "mainnet") {
    f = {
      jsonRpcUrl: process.env.MAINNET,
      blockNumber: 14705649
    }
  } else if (net === "rinkeby") {
    f = {
      jsonRpcUrl: process.env.RINKEBY,
      blockNumber: 10615185
    }
  }
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [ { forking: f }, ],
  });
  await util.deploy();
  await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
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
}
const bootstrap = async () => {
  await hre.network.provider.send("hardhat_reset")
  await util.deploy();
  await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
  // get address for the custom wallet
  // send some funds to the custom wallet address so it has the money to do stuff

  let implementation = await c0.collection.methods(util.factory.address).implementation().call()

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
}

describe('receiver', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it("if the receiver is specified in the token, the mint goes to the receiver", async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, receiver: util.alice.address }
    })
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner.toLowerCase()).to.equal(util.alice.address.toLowerCase())
  })
  it("if the receiver is NOT specified, and no receiver input is supplied, the mint goes to the msgSender()", async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid }
    })
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner.toLowerCase()).to.equal(c0.account.toLowerCase())
  })
  it("if the receiver is NOT specified, and no receiver input is supplied, the mint goes to the msgSender() (puzzle hash)", async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, puzzle: "this is the solution" }
    })
    let tx = await c0.token.send([token], [{ puzzle: "this is the solution" }] )
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner.toLowerCase()).to.equal(c0.account.toLowerCase())
  })
  it("if the receiver is NOT specified, and no receiver input is supplied, the mint goes to the msgSender() (senders)", async () => {
    let signers = await ethers.getSigners();
    let senders = signers.map(s => s.address)
    senders.push(c0.account)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, senders }
    })
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner.toLowerCase()).to.equal(c0.account.toLowerCase())
  })
  it('if body.receiver is set, the token must go to the body.receiver', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        receiver: util.bob.address
      }
    })
    let tx = await c0.token.send([token], [])
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(util.bob.address)
  })
  it('if body.receiver is set, the token must go to the body.receiver EVEN if you pass a different input.receiver', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        receiver: util.bob.address
      }
    })
    let tx = await c0.token.send([token], [{ receiver: util.alice.address }])
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(util.bob.address)
  })
  it('if body.receiver is not set + input.receiver is not set, the mint goes to the minter by default', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
      }
    })
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)
  })
  it('if body.receiver is not set + input.receiver is set, the mint goes to the input.receiver', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
      }
    })
    let tx = await c0.token.send([token], [{ receiver: util.bob.address }])
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(util.bob.address)
  })
})
