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

describe('receivers lock', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it('receivers merkle proof based auth should fail if the minter is not part of the receivers', async () => {
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let account2 = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    // create a merkle tree with alice, bob and account2
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        receivers: [
          util.alice.address,
          util.bob.address,
        ]
      }
    })

    // try to mint as owner => should fail because not part of the tree
    let tx = c0.token.send([token])
    await expect(tx).to.be.revertedWith("7")

    // try to mint as account2 => should work because part of the tree

//    // switch to account2
//    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
//    console.log("token", token)
//    tx = await c0.token.send([token])
//
//    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
//    expect(owner).to.equal(account2)
  })
  it('receivers merkle proof based auth should fail if trying to send to a receiver not in the group', async () => {
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let account2 = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    // create a merkle tree with alice, bob and account2
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        receivers: [
          util.alice.address,
          util.bob.address,
        ]
      }
    })
    expect(token.body.receivers).to.deep.equal([util.alice.address, util.bob.address])

    // try to mint as owner => should fail because not part of the tree
    let tx = c0.token.send([token], [{ receiver: c0.account }])
    await expect(tx).to.be.revertedWith("7")

    tx = c0.token.send([token], [{ receiver: util.carol.address }])
    await expect(tx).to.be.revertedWith("7")
  })
  it('receivers merkle proof based auth should succeed if sent to a member of the group', async () => {
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let account2 = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    // create a merkle tree with alice, bob and account2
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        receivers: [
          util.alice.address,
          util.bob.address,
        ]
      }
    })

    // try to mint as owner => should fail because not part of the tree
    let tx = await c0.token.send([token], [{ receiver: util.alice.address }])
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner).to.equal(util.alice.address)

  })
  it('use both senders and receivers merkle tree', async () => {
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let account2 = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    // create a merkle tree with alice, bob and account2
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        senders: [
          account2
        ],
        receivers: [
          util.alice.address,
          util.bob.address,
        ]
      }
    })

    // try to mint as account2 => should fail because the current account not part of the senders
    let tx = c0.token.send([token], [{ receiver: util.alice.address }])
    await expect(tx).to.be.revertedWith("7a")

    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })

    // should fail because the receiver is empty therefore will try to mint to account2, but account2 is not part of the receivers
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: account2,
      value: "" + Math.pow(10, 20)
    })
    tx = c0.token.send([token])
    await expect(tx).to.be.revertedWith("7b")


    // mint to bob from account2 => should succeed
    tx = await c0.token.send([token], [{ receiver: util.bob.address }])

    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner).to.equal(util.bob.address)

  })
})
