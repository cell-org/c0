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

describe('sender lock', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it("if sender is NOT specified, anyone can mint", async () => {
    let firstAccount = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let secondAccount = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    // send some money to both accounts
    await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: firstAccount,
      value: "" + Math.pow(10, 20)
    })
    await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: secondAccount,
      value: "" + Math.pow(10, 20)
    })

    let token1 = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    // try to mint as the first account => should work
    let tx1 = await c0.token.send([token1], [])
    let owner1 = await c0.token.methods(domain.address).ownerOf(token1.body.id).call()
    expect(owner1).to.equal(firstAccount)

    let token2 = await c0.token.create({
      domain,
      body: { cid: cid2, }
    })
    // switch to account2 a and try to mint
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    // try to mint as the first account => should work
    let tx2 = await c0.token.send([token2], [])
    let owner2 = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner2).to.equal(secondAccount)

  })
  it("if sender is specified, only the specified sender can mint", async () => {

    // find the second account address
    let firstAccount = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let secondAccount = c0.account

    // send some money to both accounts
    await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: firstAccount,
      value: "" + Math.pow(10, 20)
    })
    await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: secondAccount,
      value: "" + Math.pow(10, 20)
    })

    // switch back to the owner account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })

    // 1.
    // create a token for the second account as the sender
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        sender: secondAccount
      }
    })
    // try to mint as the first account => should fail
    let tx = c0.token.send([token], [])
    await expect(tx).to.be.revertedWith("3")

    // 2.
    // create a token for the first account as the sender 
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        sender: firstAccount
      }
    })
    // try to mint as the second account => should fail
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let tx2 = c0.token.send([token2], [])
    await expect(tx2).to.be.revertedWith("3")

    // 3.
    // create a token for the second account as the sender
    // try to mint as the second account => should work
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    let token3 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
        sender: secondAccount
      }
    })
    // try to mint as the second account => should fail
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let tx3 = await c0.token.send([token3], [])
    let owner3 = await c0.token.methods(domain.address).ownerOf(token3.body.id).call()
    expect(owner3).to.equal(secondAccount)

    // 4.
    // create a token for the first account as the sender
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    let token4 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        sender: firstAccount
      }
    })
    // try to mint as the first account => should work
    let tx4 = await c0.token.send([token4], [])
    let owner4 = await c0.token.methods(domain.address).ownerOf(token4.body.id).call()
    expect(owner4).to.equal(firstAccount)

  })
  it('cannot mint a token with a sender attribute assigned to someone else', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        sender: "0x701facAd49e0349Ad5b782A2A785Db705fC265E4"
      }
    })
    let tx = c0.token.send([token])
    await expect(tx).to.be.revertedWith("3");
  })
})
