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
var domain = {}
describe('factory', () => {
  beforeEach(async () => {
    await hre.network.provider.send("hardhat_reset")
    await util.deploy();
    await c0.init({
      web3,
      key: process.env.RINKEBY_PRIVATE_KEY
    })
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
  it('burn', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        price: "" + Math.pow(10, 16),
        start: 0,
      }
    })
    let tx = await c0.token.mint([token], [], { value: "" + Math.pow(10, 16) })
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner).to.equal(c0.account)

    tx = await c0.token.methods(domain.address).burn(token.body.id).send()

    owner = c0.token.methods(domain.address).ownerOf(token.body.id).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    // mint the same token again
    token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        price: "" + Math.pow(10, 16),
        start: 0,
      }
    })
    tx = await c0.token.mint([token], [], { value: "" + Math.pow(10, 16) })
    owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner).to.equal(c0.account)

  })
  it('trying to mint twice should fail', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        price: "" + Math.pow(10, 16),
        start: 0,
        end: ethers.BigNumber.from(2).pow(64).sub(1).toString()
      }
    })
    let tx = await c0.token.mint([token], {
      value: "" + Math.pow(10, 16)
    })
    let token2 = await c0.token.create({
      domain,
      body: {
        cid,
        price: "" + Math.pow(10, 16),
        start: 0,
        end: ethers.BigNumber.from(2).pow(64).sub(1).toString()
      }
    })
    let tx2 = c0.token.mint([token2], {
      value: "" + Math.pow(10, 16)
    })
    await expect(tx2).to.be.revertedWith("ERC721: token already minted")
  })
  it('minting the same tokenId after burning should be possible', async () => {
    // Mint once
    let token = await c0.token.create({
      domain: domain,
      body: {
        cid: cid,
        price: "" + Math.pow(10, 18),
        start: 0,
        end: ethers.BigNumber.from(2).pow(64).sub(1).toString()
      }
    })
    let tx = await c0.token.mint([token], { value: "" + Math.pow(10, 18) })
    // Check the owner of the token
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)

    // Burn the token
    tx = await c0.token.methods(domain.address).burn(id(cidDigest)).send()

    // The burned token should NOT exist anymore
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    // Re-mint the token
    // mint the same token again
    let token2 = await c0.token.create({
      domain: domain,
      body: {
        cid: cid,
        price: "" + Math.pow(10, 18),
        start: 0,
        end: ethers.BigNumber.from(2).pow(64).sub(1).toString()
      }
    })
    tx = await c0.token.mint([token2], {
      value: "" + Math.pow(10, 18)
    })
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)

  })
  it('burn and mint again', async () => {
  })
})
