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
describe('royalty', () => {
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
  it("royalty", async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        royalty: {
          where: util.bob.address,
          what: 10000
        }
//        royaltyReceiver: util.bob.address,
//        royaltyAmount: 10000
      }
    })
    let tx = await c0.token.send([token])

    // 300 wei revenue => should receive 10000/1M = 1% => 3 wei
    let ro = await c0.token.methods(domain.address).royaltyInfo(token.body.id, 300).call()
    console.log("ro", ro)
    expect(ro.receiver).to.equal(util.bob.address)
    expect(ro.royaltyAmount).to.equal("3");
  })
  it('royalty should work even when theres no royalty' ,async () => {
    let token = await c0.token.create({
      domain,
      body: { cid, }
    })
    let tx = await c0.token.send([token])

    // 300 wei revenue => null address should receive 0 wei
    let ro = await c0.token.methods(domain.address).royaltyInfo(token.body.id, 300).call()
    console.log(ro)
    expect(ro.royaltyAmount).to.equal('0')
    expect(ro.receiver).to.equal("0x0000000000000000000000000000000000000000")
  })
  it("mint with royalty", async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        royalty: {
          where: "0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41",
          what: 10 ** 5  // 10%
        }
//        royaltyReceiver: "0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41",
//        royaltyAmount: 10**5 // 10%
      }
    })
    console.log("token", token)
    let tx = await c0.token.send([token], [])
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)

    let royaltyInfo = await c0.token.methods(domain.address).royaltyInfo(id(cidDigest), 42 * 10 ** 6).call()
    console.log("royaltyInfo", royaltyInfo)
    expect(royaltyInfo.royaltyAmount).to.equal("" + 42 * 10 ** 5)
    expect(royaltyInfo.receiver).to.equal("0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41")
    
  })
  it('gift with royalty', async () => {
    let gift = await c0.gift.create({
      body: {
        cid,
        receiver: "0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41",
        royalty: {
          where: "0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41",
          what: 10 ** 5  // 10%
        }
      },
      domain
    })
    console.log("gift", JSON.stringify(gift, null, 2))
    let tx = await c0.gift.send([gift])
    let owner = await c0.token.methods(domain.address).ownerOf(gift.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal("0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41")
    let ro = await c0.token.methods(domain.address).royaltyInfo(gift.body.id, 300).call()
    console.log(ro)
    expect(ro.royaltyAmount).to.equal('30')
    expect(ro.receiver).to.equal("0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41")
  })
})
