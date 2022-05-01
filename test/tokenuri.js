const hre = require('hardhat');
const fs = require('fs')
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
describe('tokenURI', () => {
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
  it('before setting the base URI, the token URI prefix must be ipfs://', async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token], [])
    // the token URI should be "ipfs://:cid"

    let tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    console.log(tokenURI)
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it('when the base URI changes, the token URI prefix must change', async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token], [])


    // setBaseURI
    await c0.token.methods(domain.address).setBaseURI("https://mydomain.com/ipfs/").send()
    let baseURI = await c0.token.methods(domain.address).baseURI().call()
    expect(baseURI).to.equal("https://mydomain.com/ipfs/")


    let tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    console.log(tokenURI)
    expect(tokenURI).to.equal("https://mydomain.com/ipfs/" + cid)
  })
  it('can set the base URI back to ipfs://', async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token], [])


    // setBaseURI
    await c0.token.methods(domain.address).setBaseURI("https://mydomain.com/ipfs/").send()
    let baseURI = await c0.token.methods(domain.address).baseURI().call()
    expect(baseURI).to.equal("https://mydomain.com/ipfs/")

    await c0.token.methods(domain.address).setBaseURI("ipfs://").send()

    let tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    console.log(tokenURI)
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it('setting the baseURI as ipfs:// works too', async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token], [])

    // setBaseURI
    await c0.token.methods(domain.address).setBaseURI("ipfs://").send()
    let baseURI = await c0.token.methods(domain.address).baseURI().call()
    expect(baseURI).to.equal("ipfs://")

    let tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    console.log(tokenURI)
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it('tokenURI must return the original CID', async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token], [])
    let tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it("tokenURI", async () => {
    let cids = []
    let tokens = []
    for(let i=0; i<10; i++) {
      let cid = await nebulus.add(Buffer.from("" + i))
      cids.push(cid)
      let token = await c0.token.create({
        domain,
        body: { cid: cid, }
      })
      tokens.push(token)
    }
    await c0.token.send(tokens, [])
    for(let i=0; i<10; i++) {
      let tokenURI = await c0.token.methods(domain.address).tokenURI(tokens[i].body.id).call()
      expect(tokenURI).to.equal("ipfs://" + cids[i])
    }
  })
  it("large video file => dag-pb encoding", async () => {
    const buf = await fs.promises.readFile(__dirname + "/oceans.mp4")
    let cid = await nebulus.add(buf)
    console.log("cid", cid)
    expect(cid.startsWith("bafy")).to.equal(true)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    expect(token.body.encoding).to.equal(false)

    await c0.token.send([token])
    const tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it("4mb image file => dag-pb encoding", async () => {
    const buf = await fs.promises.readFile(__dirname + "/pipe.png")
    let cid = await nebulus.add(buf)
    console.log("cid", cid)
    expect(cid.startsWith("bafy")).to.equal(true)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    expect(token.body.encoding).to.equal(1)

    await c0.token.send([token])
    const tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it("236KB image file => dag-pb encoding", async () => {
    const buf = await fs.promises.readFile(__dirname + "/pipe.png")
    let cid = await nebulus.add(buf)
    console.log("cid", cid)
    expect(cid.startsWith("bafy")).to.equal(true)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    expect(token.body.encoding).to.equal(0)

    await c0.token.send([token])
    const tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it("236KB image file => dag-pb encoding", async () => {
    const buf = await fs.promises.readFile(__dirname + "/pipe.png")
    let cid = await nebulus.add(buf)
    console.log("cid", cid)
    expect(cid.startsWith("bafy")).to.equal(true)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    expect(token.body.encoding).to.equal(1)

    await c0.token.send([token])
    const tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it("62KB image file => raw encoding", async () => {
    const buf = await fs.promises.readFile(__dirname + "/factoria.png")
    let cid = await nebulus.add(buf)
    console.log("cid", cid)
    expect(cid.startsWith("bafk")).to.equal(true)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    expect(token.body.encoding).to.equal(0)

    await c0.token.send([token])
    const tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it("1KB image file => raw encoding", async () => {
    const buf = await fs.promises.readFile(__dirname + "/rdice.png")
    let cid = await nebulus.add(buf)
    console.log("cid", cid)
    expect(cid.startsWith("bafk")).to.equal(true)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    expect(token.body.encoding).to.equal(0)

    await c0.token.send([token])
    const tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
  it("12KB text file => raw encoding", async () => {
    const buf = await fs.promises.readFile(path.resolve(__dirname, "../contracts/C0.sol"))
    let cid = await nebulus.add(buf)
    console.log("cid", cid)
    expect(cid.startsWith("bafk")).to.equal(true)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    expect(token.body.encoding).to.equal(0)

    await c0.token.send([token])
    const tokenURI = await c0.token.methods(domain.address).tokenURI(token.body.id).call()
    expect(tokenURI).to.equal("ipfs://" + cid)
  })
})
