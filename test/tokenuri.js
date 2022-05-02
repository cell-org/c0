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
    expect(token.body.encoding).to.equal(1)

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
  it("metadata => raw encoding", async () => {
    const meta = {"description":"NFT Worlds are generative worlds with geography, resource & feature data stored on chain. NFT Worlds can be played, explored and built in.     You can sync changes you make to your world so they reflect on your NFT. Feel free to use NFT Worlds in any way you want. Learn more at nftworlds.com","external_url":"https    ://www.nftworlds.com/2409","image":"https://ipfs.nftworlds.com/ipfs/QmXABHZHLoo4tjLgLnyA2vDnzMDG7qf7t3a5wjZfntSuf3","name":"World #2409","attributes":[{"trait_type":"Land A    rea (km^2)","value":451.99},{"trait_type":"Water Area (km^2)","value":60.01},{"trait_type":"Land Bias (%)","value":88.3},{"trait_type":"Highest Point From Sea Level (m)","v    alue":526.33},{"trait_type":"Lowest Point From Sea Level (m)","value":115.36},{"trait_type":"Elevation Variation (m)","value":410},{"trait_type":"Annual Rainfall (mm)","val    ue":1704},{"trait_type":"Wildlife Density","value":"High"},{"trait_type":"Aquatic Life Density","value":"Low"},{"trait_type":"Foliage Density","value":"Medium"},{"trait_typ    e":"Lumber (%)","value":11.9},{"trait_type":"Coal (%)","value":7.8},{"trait_type":"Oil (%)","value":3.9},{"trait_type":"Dirt (%)","value":47.2},{"trait_type":"Common Metals     (%)","value":12.8},{"trait_type":"Rare Metals (%)","value":2.5},{"trait_type":"Gemstones (%)","value":2.2},{"trait_type":"Fresh Water (%)","value":0.6},{"trait_type":"Salt     Water (%)","value":11.1},{"value":"Plains"},{"value":"Forest"},{"value":"River"},{"value":"Evergreen Forest"},{"value":"Giant Evergreen Forest"},{"value":"Swamp"},{"value"    :"Mountains"},{"value":"Wooded Mountains"},{"value":"Ore Mine"},{"value":"Witch's Hut"},{"value":"Town"},{"value":"Snow"},{"value":"Mountains"},{"value":"Oil Fields"},{"val    ue":"Monsoons"},{"value":"Scarce Freshwater"},{"value":"Ore Rich"},{"value":"Buried Jems"},{"value":"Woodlands"},{"value":"Witch Tales"},{"value":"Multi-Climate"}]}
    let cid = await nebulus.add(Buffer.from(JSON.stringify(meta)))
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
  it("metadata => raw encoding", async () => {
    const meta = []
    for(let i=0; i<10000; i++) {
      meta.push(i)
    }
    console.log(JSON.stringify(meta))
    let buffer = Buffer.from(JSON.stringify(meta))
    console.log("byte", buffer.byteLength);
    let cid = await nebulus.add(buffer)
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
