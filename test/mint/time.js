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

describe('time lock', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it('should fail if trying to mint before start time, but should work if done after start time', async () => {
    let cid = await nebulus.add(Buffer.from("x"))
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        start: Math.floor(Date.now()/1000) + 3,
      }
    })
    let tx = c0.token.send([token], [], {
      value: "" + Math.pow(10, 18)
    })
    await expect(tx).to.be.revertedWith("4");

    // wait 6 seconds and try to mint again => should work
    //await new Promise(resolve => setTimeout(resolve, 10000));
    await hre.network.provider.send("evm_increaseTime", [100])
    await hre.network.provider.send("evm_mine")

    let tx2 = await c0.token.send([token], [])
    let owner1 = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner1).to.equal(c0.account)
  })
  it("should work if minting before the end", async () => {
    let cid = await nebulus.add(Buffer.from("x"))
    // end time is 6 second later
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        end: Math.floor(Date.now()/1000) + 6,
      }
    })
    let tx = await c0.token.send([token], [])
    let owner1 = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner1).to.equal(c0.account)
  })
  it("should fail if minting AFTER the end", async () => {
    let cid = await nebulus.add(Buffer.from("x"))
    // end time is 1 second later
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        end: Math.floor(Date.now()/1000),
      }
    })
    // wait 6 seconds and try to mint again => should work
    //await new Promise(resolve => setTimeout(resolve, 6000));
    await network.provider.send("evm_increaseTime", [1000])
    await network.provider.send("evm_mine")

    let tx = c0.token.send([token], [])
    await expect(tx).to.be.revertedWith("5");
  })
})
