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
describe('send', () => {
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
  it('burning works', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        start: 0,
      }
    })
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)


    // burn gets rid of the token
    //tx = await c0.token.methods(domain.address).burn([id(cidDigest)]).send()
    tx = await c0.token.burn(domain.address, [id(cidDigest)])
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    tokenURI = c0.token.methods(domain.address).tokenURI(id(cidDigest)).call()
    await expect(tokenURI).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token")
  })
  it('multi burn', async() => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
      }
    })
    //let tx = await c0.token.send([token])

    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
      }
    })
    let tx = await c0.token.send([token, token2])

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)


    // burn gets rid of the token
    tx = await c0.token.methods(domain.address).burn([id(cidDigest), id(cidDigest2)]).send()
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()

    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")
  })
  it("burning and trying to remint should fail", async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        start: 0,
      }
    })
    let tx = await c0.token.send([token])

    // burn gets rid of the token
    tx = await c0.token.methods(domain.address).burn([id(cidDigest)]).send()

    tx = c0.token.send([token])
    await expect(tx).to.be.revertedWith("1")
  })
  it("cannot burn if not owner", async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        start: 0,
        receiver: util.bob.address
      }
    })
    let tx = await c0.token.send([token])

    // burn gets rid of the token
    tx = c0.token.methods(domain.address).burn([id(cidDigest)]).send()
    await expect(tx).to.be.revertedWith("15")

  })
})
