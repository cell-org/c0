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

describe('hash puzzle lock', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it('single mint with hash puzzle', async () => {

    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        puzzle: "this is a secret"
      }
    })
    let tx = await c0.token.send([token], [{ puzzle: "this is a secret" }])

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)
  })
  it('mint with hash puzzle should fail if incorrect solution', async () => {

    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        puzzle: "this is a secret"
      }
    })
    let tx = c0.token.send([token], [{ puzzle: "this is not a secret" }])
    await expect(tx).to.be.revertedWith("6")
  })
  it('multiple mint with hash puzzle', async () => {

    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        puzzle: "this is a secret"
      }
    })
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
        puzzle: "secret 2"
      }
    })
    // incorrect puzzle solution for the second token => fail
    let tx = c0.token.send([token, token2], [
      { puzzle: "this is a secret" },
      { puzzle: "this is a secret" },
    ])
    await expect(tx).to.be.revertedWith("6")

    // both solutions correct => success
    tx = await c0.token.send([token, token2], [
      { puzzle: "this is a secret" },
      { puzzle: "secret 2" },
    ])

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)

    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    expect(owner).to.equal(c0.account)
  })
})
