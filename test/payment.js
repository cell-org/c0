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
const getBalance = async (address) => {
  const b = await ethers.provider.getBalance(address)
  return b;
//  return b.toString();
//  return ethers.utils.formatEther(b)
}
describe('send', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it('single payment split', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        value: 10 ** 2,
        payments: [{
          where: util.alice.address,
          what: 10 ** 5 // 10%
        }]
      }
    })
    let balanceContractBefore = await getBalance(domain.address)
    let balanceAliceBefore = await getBalance(util.alice.address)
    let tx = await c0.token.send([token], [])
    let balanceContractAfter = await getBalance(domain.address)
    let balanceAliceAfter = await getBalance(util.alice.address)

    expect(balanceContractAfter.sub(balanceContractBefore).toString()).to.equal("90");
    expect(balanceAliceAfter.sub(balanceAliceBefore).toString()).to.equal("10");

  })
  it('multiple split', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        value: 10 ** 2,
        payments: [{
          where: util.alice.address,
          what: 10 ** 5 // 10%
        }, {
          where: util.bob.address,
          what: 2 * (10 ** 5) // 20%
        }]
      }
    })
    let balanceContractBefore = await getBalance(domain.address)
    let balanceAliceBefore = await getBalance(util.alice.address)
    let balanceBobBefore = await getBalance(util.bob.address)
    let tx = await c0.token.send([token], [])
    let balanceContractAfter = await getBalance(domain.address)
    let balanceAliceAfter = await getBalance(util.alice.address)
    let balanceBobAfter = await getBalance(util.bob.address)


    expect(balanceContractAfter.sub(balanceContractBefore).toString()).to.equal("70");
    expect(balanceAliceAfter.sub(balanceAliceBefore).toString()).to.equal("10");
    expect(balanceBobAfter.sub(balanceBobBefore).toString()).to.equal("20");

  })
  it('if a single payment exceeds 1000000, must fail', async () => {

    // first put some money into the contract, so the calls don't fail because there's no money in the conract
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: domain.address,
      value: "" + Math.pow(10, 20)
    })
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        value: 10 ** 2,
        payments: [{
          where: util.alice.address,
          what: 2 * (10 ** 6) // 10%
        }]
      }
    })
    let balanceContractBefore = await getBalance(domain.address)
    let balanceAliceBefore = await getBalance(util.alice.address)
    let balanceBobBefore = await getBalance(util.bob.address)
    let tx = c0.token.send([token], [])
    await expect(tx).to.be.revertedWith("10c");
  })
  it('if a single payment exactly matches 1000000, must go through and the entire money should go to the payment receiver', async () => {

    // first put some money into the contract, so the calls don't fail because there's no money in the conract
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: domain.address,
      value: "" + Math.pow(10, 20)
    })
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        value: 10 ** 2,
        payments: [{
          where: util.alice.address,
          what: (10 ** 6) // 100%
        }]
      }
    })
    let balanceContractBefore = await getBalance(domain.address)
    let balanceAliceBefore = await getBalance(util.alice.address)
    let tx = await c0.token.send([token], [])

    let balanceContractAfter = await getBalance(domain.address)
    let balanceAliceAfter = await getBalance(util.alice.address)

    expect(balanceContractAfter.sub(balanceContractBefore).toString()).to.equal("0");
    expect(balanceAliceAfter.sub(balanceAliceBefore).toString()).to.equal("100");
  })
  it('if the total payment exceeds 1000000, must fail', async () => {

    // first put some money into the contract, so the calls don't fail because there's no money in the conract
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: domain.address,
      value: "" + Math.pow(10, 20)
    })
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        value: 10 ** 2,
        payments: [{
          where: util.alice.address,
          what: 7 * (10 ** 5) // 70%
        }, {
          where: util.bob.address,
          what: 5 * (10 ** 5) // 50%
        }]
      }
    })
    let balanceContractBefore = await getBalance(domain.address)
    let balanceAliceBefore = await getBalance(util.alice.address)
    let balanceBobBefore = await getBalance(util.bob.address)
    let tx = c0.token.send([token], [])
    await expect(tx).to.be.revertedWith("10c");
  })
  it('if the total payment exceeds 1000000, it should fail even if the value is 0', async () => {

    // first put some money into the contract, so the calls don't fail because there's no money in the conract
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: domain.address,
      value: "" + Math.pow(10, 20)
    })
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        value: 10 ** 2,
        payments: [{
          where: util.alice.address,
          what: 7 * (10 ** 5) // 70%
        }, {
          where: util.bob.address,
          what: 5 * (10 ** 5) // 50%
        }]
      }
    })
    let balanceContractBefore = await getBalance(domain.address)
    let balanceAliceBefore = await getBalance(util.alice.address)
    let balanceBobBefore = await getBalance(util.bob.address)
    let tx = c0.token.send([token], [])
    await expect(tx).to.be.revertedWith("10c");
  })
  it('if the total payment exactly matches 1000000, should work', async () => {

    // first put some money into the contract, so the calls don't fail because there's no money in the conract
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        value: 10 ** 2,
        payments: [{
          where: util.alice.address,
          what: 6 * (10 ** 5) // 10%
        }, {
          where: util.bob.address,
          what: 4 * (10 ** 5) // 20%
        }]
      }
    })
    let balanceContractBefore = await getBalance(domain.address)
    let balanceAliceBefore = await getBalance(util.alice.address)
    let balanceBobBefore = await getBalance(util.bob.address)
    let tx = await c0.token.send([token], [])

    let balanceContractAfter = await getBalance(domain.address)
    let balanceAliceAfter = await getBalance(util.alice.address)
    let balanceBobAfter = await getBalance(util.bob.address)

    expect(balanceContractAfter.sub(balanceContractBefore).toString()).to.equal("0");
    expect(balanceAliceAfter.sub(balanceAliceBefore).toString()).to.equal("60");
    expect(balanceBobAfter.sub(balanceBobBefore).toString()).to.equal("40");

  })
})
