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
describe('withdraw', () => {
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
  it("mint one and withdraw", async () => {
    let balance = {
      contract: {},
      deployer: {},
      alice: {},
      factoria: {}
    }

    balance.contract.beforeMint = await web3.eth.getBalance(domain.address)
    balance.deployer.beforeMint = await web3.eth.getBalance(c0.account)

    let token = await c0.token.create({
      domain,
      body: {
        cid,
        value: "" + Math.pow(10, 18)
      }
    })
    let tx = await c0.token.send([token], [])

    balance.contract.beforeWithdraw = await web3.eth.getBalance(domain.address)
    balance.deployer.beforeWithdraw = await web3.eth.getBalance(c0.account)

    // contract balance is 0 
    expect(balance.contract.beforeMint).to.equal("0")
    // contract balance after mint is 10**18 wei
    expect(balance.contract.beforeWithdraw).to.equal("" + Math.pow(10, 18))

    // withdraw all
    tx = await c0.token.methods(domain.address).withdraw(0).send()

    balance.contract.afterWithdraw = await web3.eth.getBalance(domain.address)
    balance.deployer.afterWithdraw = await web3.eth.getBalance(c0.account)

    // contract balance is 0 because all the money is withdrawn
    expect(balance.contract.afterWithdraw).to.equal("0")

    let spentEth = new web3.utils.BN(tx.cumulativeGasUsed).mul(new web3.utils.BN(tx.effectiveGasPrice))

    // deployer's balance has increased 1ETH minus gas fee
    let expectedBalance = new web3.utils.BN(balance.deployer.beforeWithdraw)
      .sub(spentEth)                                // minus gas fee
      .add(new web3.utils.BN("" + 10 ** 18))
    expect(expectedBalance.toString()).to.equal(new web3.utils.BN(balance.deployer.afterWithdraw).toString())

  })
  it("mint 10 ETH and withdraw 3ETH", async () => {
    let balance = {
      contract: {},
      deployer: {},
      alice: {},
      factoria: {}
    }

    balance.contract.beforeMint = await web3.eth.getBalance(domain.address)
    balance.deployer.beforeMint = await web3.eth.getBalance(c0.account)

    let token = await c0.token.create({
      domain,
      body: {
        cid,
        value: "" + Math.pow(10, 19)  // 10ETH
      }
    })
    let tx = await c0.token.send([token], [])

    balance.contract.beforeWithdraw = await web3.eth.getBalance(domain.address)
    balance.deployer.beforeWithdraw = await web3.eth.getBalance(c0.account)

    // contract balance is 0 
    expect(balance.contract.beforeMint).to.equal("0")
    // contract balance after mint is 10**18 wei
    expect(balance.contract.beforeWithdraw).to.equal("" + Math.pow(10, 19))

    // withdraw only 3ETH
    tx = await c0.token.methods(domain.address).withdraw("" + 3 * Math.pow(10, 18)).send()

    balance.contract.afterWithdraw = await web3.eth.getBalance(domain.address)
    balance.deployer.afterWithdraw = await web3.eth.getBalance(c0.account)

    // the contract's balance is 7ETH
    expect(balance.contract.afterWithdraw.toString()).to.equal("" + 7 * 10**18)

    // deployer's balance has increased 1ETH minus gas fee
    let spentEth = new web3.utils.BN(tx.cumulativeGasUsed).mul(new web3.utils.BN(tx.effectiveGasPrice))
    let expectedBalance = new web3.utils.BN(balance.deployer.beforeWithdraw)
      .sub(spentEth)                                // minus gas fee
      .add(new web3.utils.BN("" + 3 * 10 ** 18))
    expect(expectedBalance.toString()).to.equal(new web3.utils.BN(balance.deployer.afterWithdraw).toString())


  })
  it('setWithdrawer can be only called by owner', async () => {
    // connect with account2
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    let tx = c0.token.methods(domain.address).setWithdrawer({ account: util.alice.address, }).send()
    await expect(tx).to.be.revertedWith("Ownable: caller is not the owner")
  })
  it('can not withdraw if youre not the owner', async () => {
    // connect with account2
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    // try to withdraw
    let tx = c0.token.methods(domain.address).withdraw(0).send()
    await expect(tx).to.be.revertedWith("30")
  })
  it("setting the withdrawer to permanent means permanent", async () => {
    // set alice as the withdrawer
    let tx = await c0.token.methods(domain.address).setWithdrawer({
      account: util.alice.address,
      permanent: true
    }).send()

    // try to set withdrawer again to another address => should fail because it's permanent
    tx = c0.token.methods(domain.address).setWithdrawer({
      account: util.bob.address,
    }).send()
    await expect(tx).to.be.revertedWith("20");
  })
  it('setWithdrawer: if account2 is set as withdrawer, both the owner and account2 can withdraw', async () => {
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    let account2 = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    let tx = await c0.token.methods(domain.address).setWithdrawer({
      account: account2,
      permanent: true
    }).send()

    // mint
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        value: "" + Math.pow(10, 19)  // 10ETH
      }
    })
    tx = await c0.token.send([token], [])

    let balance = {
      contract: {},
      owner: {},
      account2: {}
    }
    balance.contract.beforeWithdraw = await web3.eth.getBalance(domain.address)
    balance.owner.beforeWithdraw = await web3.eth.getBalance(c0.account)
    balance.account2.beforeWithdraw = await web3.eth.getBalance(account2)


    // try to withdraw by owner
    tx = await c0.token.methods(domain.address).withdraw("" + Math.pow(10, 18)).send()
    balance.owner.afterWithdraw = await web3.eth.getBalance(c0.account)
    balance.account2.afterWithdraw = await web3.eth.getBalance(account2)

    // withdrawer balance increased by 1ETH
    expect(new web3.utils.BN(balance.account2.afterWithdraw).toString()).to.equal(
      new web3.utils.BN(balance.account2.beforeWithdraw)
        .add(new web3.utils.BN("" + Math.pow(10, 18))).toString()
    )


    // try to withdraw by account2
    // switch account to account2
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    // withdraw as account2
    tx = await c0.token.methods(domain.address).withdraw("" + Math.pow(10, 18)).send()

    let spentEth = new web3.utils.BN(tx.cumulativeGasUsed).mul(new web3.utils.BN(tx.effectiveGasPrice))
    balance.account2.afterWithdraw2 = await web3.eth.getBalance(account2)
    // account2 balance increased by 1ETH minus gas fee
    expect(new web3.utils.BN(balance.account2.afterWithdraw2).toString()).to.equal(
      new web3.utils.BN(balance.account2.afterWithdraw)
        .add(new web3.utils.BN("" + Math.pow(10, 18)))
        .sub(spentEth).toString()
    )

    balance.contract.afterWithdraw2 = await web3.eth.getBalance(domain.address)

    // contract balance decreased by 2ETH
    expect(new web3.utils.BN(balance.contract.afterWithdraw2).toString()).to.equal(
      new web3.utils.BN(balance.contract.beforeWithdraw).sub(new web3.utils.BN("" + Math.pow(10, 18) * 2)).toString()
    )

  })
  it("setWithdrawer: non approved random user cannot withdraw", async () => {
    // mint
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        value: "" + Math.pow(10, 19)  // 10ETH
      }
    })
    let tx = await c0.token.send([token], [])

    // switch to account2 (not a withdrawer)
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })

    tx = c0.token.methods(domain.address).withdraw(0).send()
    await expect(tx).to.be.revertedWith("30")

  })
  it('setWithdrawer: if the owner sets alice as withdrawer, calling withdraw() sends money to alice, not the owner', async () => {
    // set alice as the withdrawer
    let tx = await c0.token.methods(domain.address).setWithdrawer({
      account: util.alice.address,
      permanent: true
    }).send()

    let withdrawer = await c0.token.methods(domain.address).withdrawer().call()
    expect(withdrawer.account).to.equal(util.alice.address)

    let balance = {
      contract: {},
      deployer: {},
      alice: {},
    }

    balance.contract.beforeMint = await web3.eth.getBalance(domain.address)
    balance.deployer.beforeMint = await web3.eth.getBalance(c0.account)
    balance.alice.beforeMint = await web3.eth.getBalance(util.alice.address)

    let token = await c0.token.create({
      domain,
      body: {
        cid,
        value: "" + Math.pow(10, 19)  // 10ETH
      }
    })
    tx = await c0.token.send([token], [])

    balance.contract.afterMint = await web3.eth.getBalance(domain.address)
    balance.deployer.afterMint = await web3.eth.getBalance(c0.account)
    balance.alice.afterMint = await web3.eth.getBalance(util.alice.address)

    tx = await c0.token.methods(domain.address).withdraw(0).send()

    balance.contract.afterWithdraw = await web3.eth.getBalance(domain.address)
    balance.deployer.afterWithdraw = await web3.eth.getBalance(c0.account)
    balance.alice.afterWithdraw = await web3.eth.getBalance(util.alice.address)

    // 1. deployer's balnce only decreased by gas fee (because the money went to alice)
    let spentEth = new web3.utils.BN(tx.cumulativeGasUsed).mul(new web3.utils.BN(tx.effectiveGasPrice))
    let expectedBalance = new web3.utils.BN(balance.deployer.afterMint).sub(spentEth)
    expect(balance.deployer.afterWithdraw.toString()).to.equal(expectedBalance.toString())

    // 2. alice's balance has increased by 10ETH
    expect(balance.alice.afterWithdraw.toString()).to.equal(
      new web3.utils.BN(balance.alice.beforeMint).add(
        new web3.utils.BN("" + Math.pow(10, 19))
      ).toString()
    )

    // 3. contract balance is 0
    expect(balance.contract.afterWithdraw).to.equal("0")

  })
//  it("cant withdraw if not owner", async () => {
//    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
//
//    tx = c0.token.methods(domain.address).withdraw(0).send()
//  })
})
