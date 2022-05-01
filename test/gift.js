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
describe('gift', () => {
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
  it('gift single token', async () => {
    let gift = await c0.gift.create({
      body: {
        cid,
        receiver: "0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41"
      },
      domain
    })
    console.log("gift", gift)
    let tx = await c0.gift.send([gift])
    let owner = await c0.token.methods(domain.address).ownerOf(gift.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal("0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41")
  })
  it('gift multiple tokens', async () => {
    let gifts = []
    let cid1 = await nebulus.add(Buffer.from("alice"))
    let gift1 = await c0.gift.create({
      body: { cid: cid1, receiver: util.alice.address },
      domain
    })
    gifts.push(gift1)

    let cid2 = await nebulus.add(Buffer.from("bob"))
    let gift2 = await c0.gift.create({
      body: { cid: cid2, receiver: util.bob.address },
      domain
    })
    gifts.push(gift2)

    let cid3 = await nebulus.add(Buffer.from("deployer"))
    let gift3 = await c0.gift.create({
      body: { cid: cid3, receiver: util.deployer.address },
      domain
    })
    gifts.push(gift3)

    console.log("gifts", gifts)
    let tx = await c0.gift.send(gifts)
    let owner = await c0.token.methods(domain.address).ownerOf(gifts[0].body.id).call()
    expect(owner).to.equal(util.alice.address)

    owner = await c0.token.methods(domain.address).ownerOf(gifts[1].body.id).call()
    expect(owner).to.equal(util.bob.address)

    owner = await c0.token.methods(domain.address).ownerOf(gifts[2].body.id).call()
    expect(owner).to.equal(util.deployer.address)
  })
})
