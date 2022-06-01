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
describe('receive', () => {
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
  it('send money to the contract => should not fail', async () => {
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: domain.address,
      value: "" + Math.pow(10, 20)
    })
    let balance = await web3.eth.getBalance(domain.address)
    expect("" + balance).to.equal("" + Math.pow(10, 20))
  })
  it('send money to the contract and withdraw', async () => {
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: domain.address,
      value: "" + Math.pow(10, 20)
    })
    let balance = await web3.eth.getBalance(domain.address)
    expect("" + balance).to.equal("" + Math.pow(10, 20))

    let myBalanceBefore = await web3.eth.getBalance(c0.account)

    let tx = await c0.token.methods(domain.address).withdraw(0).send()

    balance = await web3.eth.getBalance(domain.address)
    expect("" + balance).to.equal("0")

    let myBalanceAfter = await web3.eth.getBalance(c0.account)

    let expected = new web3.utils.BN(myBalanceBefore)
      .add(new web3.utils.BN(10).pow(new web3.utils.BN(20)))
      .sub(new web3.utils.BN(tx.gasUsed * tx.effectiveGasPrice)).toString()

    expect(myBalanceAfter).to.equal(expected)

  })
})
