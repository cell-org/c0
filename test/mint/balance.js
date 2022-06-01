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

describe('balance lock', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it("sender local balance lock", async () => {
    await fork("mainnet")

    // mint only if you own at least two NFTs on this collection
    let token1 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "sender",
          what: 2
        }]
      }
    })

    // default account 1 => owns no nft
    // try to mint token (cid) => should fail because need at least 2
    tx = c0.token.send([token1])
    await expect(tx).to.be.revertedWith("10a");

    // Now lets mint token2 => Should work since there's no condition
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
      }
    })
    tx = await c0.token.send([token2])
    // mint success
    owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner).to.equal(c0.account)

    // The balance should be 1 now that one has been minted
    let balance = await c0.token.methods(domain.address).balanceOf(c0.account).call()
    expect(balance).to.equal("1")

    // Try to mint token1 again => should fail again because we need at least 2 but there's only one
    tx = c0.token.send([token1])
    await expect(tx).to.be.revertedWith("10a")


    // Now lets mint token3 => should work since there's no additional condition
    let token3 = await c0.token.create({
      domain,
      body: {
        cid: cid3,
      }
    })
    tx = await c0.token.send([token3])
    // mint success
    owner = await c0.token.methods(domain.address).ownerOf(token3.body.id).call()
    expect(owner).to.equal(c0.account)

    // now the balance is 2
    balance = await c0.token.methods(domain.address).balanceOf(c0.account).call()
    expect(balance).to.equal("2")

    // try to mint token1 => finally should succeed because account 1 now owns 2 NFTs
    tx = await c0.token.send([token1])
    owner = await c0.token.methods(domain.address).ownerOf(token1.body.id).call()
    expect(owner).to.equal(c0.account)

    // now the balance is 3
    balance = await c0.token.methods(domain.address).balanceOf(c0.account).call()
    expect(balance).to.equal("3")

  })
  it('receiver local balance lock', async () => {
    await fork("mainnet")

    // mint only if you own at least two NFTs on this collection
    let token1 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "receiver",
          what: 2
        }]
      }
    })

    // set account2
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    let account2 = c0.account
    // switch back to account1
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })

    // default account 1 => owns no nft
    // try to mint token (cid) => should fail because need at least 2
    tx = c0.token.send([token1], [{ receiver: account2 }])
    await expect(tx).to.be.revertedWith("10b");


    // Now lets mint token2
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
        receiver: account2
      }
    })
    tx = await c0.token.send([token2])
    owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner).to.equal(account2)


    // try to mint token1 again => should fail again because we need at least 2

    tx = c0.token.send([token1], [{ receiver: account2 }])
    await expect(tx).to.be.revertedWith("10b")

    let balance = await c0.token.methods(domain.address).balanceOf(account2).call()
    expect(balance).to.equal("1")


    // Now lets mint token3
    let token3 = await c0.token.create({
      domain,
      body: {
        cid: cid3,
        receiver: account2
      }
    })
    tx = await c0.token.send([token3])
    owner = await c0.token.methods(domain.address).ownerOf(token3.body.id).call()
    expect(owner).to.equal(account2)

    balance = await c0.token.methods(domain.address).balanceOf(account2).call()
    expect(balance).to.equal("2")


    // Now the receiver (account2) balance is 2.
    // try to mint => should succeed because account 1 now owns 2 NFTs

    tx = await c0.token.send([token1], [{ receiver: account2 }])
    owner = await c0.token.methods(domain.address).ownerOf(token1.body.id).call()
    expect(owner).to.equal(account2)


    balance = await c0.token.methods(domain.address).balanceOf(account2).call()
    expect(balance).to.equal("3")


  })
  it('sender remote ERC721 balance lock', async () => {
    await fork("rinkeby")

    let balance  = await c0.token.methods("0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2").balanceOf(c0.account).call()
    expect(balance).to.equal("2")


    // mint only if you own at least two NFTs on "Mango" collection on Rinkeby
    let token1 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "sender",
          where: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
          what: parseInt(balance) + 1 // "3"
        }]
      }
    })

    // default account 1 => owns 2 mango NFTs
    // try to mint token (cid) => should fail because need at least 3
    tx = c0.token.send([token1])
    await expect(tx).to.be.revertedWith("10a");

    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "sender",
          where: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
          what: balance
        }]
      }
    })
    tx = await c0.token.send([token2])

    let owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner).to.equal(c0.account)

  })
  it('receiver remote ERC721 balance lock: If a receiver input is specified when submitting the transaction, the supported receiver address is used for determining the balance', async () => {
    await fork("rinkeby")

    // sender's account balance is 2
    let balance  = await c0.token.methods("0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2").balanceOf(c0.account).call()
    expect(balance).to.equal("2")


    // mint only if you own at least two NFTs on "Mango" collection on Rinkeby
    let token1 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "receiver",
          where: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
          what: parseInt(balance) + 1 // "3"
        }]
      }
    })

    // try to mint token (cid) to self => should fail because the balance is 2 but the token needs 3 to mint
    tx = c0.token.send([token1])
    await expect(tx).to.be.revertedWith("10b");

    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "receiver",
          where: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
          what: balance
        }]
      }
    })

    // pass the "receiver" "bob" argument => but bob does not have the balance of 2 => should fail
    tx = c0.token.send([token2], [{ receiver: util.bob.address }])
    await expect(tx).to.be.revertedWith("10b")

    // now retry with the correct receiver c0.account => balance is 2 => should work
    tx = await c0.token.send([token2], [{ receiver: c0.account }])

    let owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner).to.equal(c0.account)

  })
  it('receiver remote ERC721 balance lock: If a receiver input is NOT specified when submitting the transaction, the submitter is used as the receiver address for determining the balance', async () => {
    await fork("rinkeby")

    // sender's account balance is 2
    let balance  = await c0.token.methods("0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2").balanceOf(c0.account).call()
    expect(balance).to.equal("2")

    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "receiver",
          where: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
          what: balance
        }]
      }
    })

    // no receiver input => c0.js will automatically set the receiver as the sender address => so the receiver is automatically set as c0.account => should work since c0.account owns 2 NFTs
    tx = await c0.token.send([token2])

    let owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner).to.equal(c0.account)

  })
  it('receiver remote ERC721 balance lock: If the token body includes a receiver field, this value is used to determine the balance', async () => {
    await fork("rinkeby")

    // sender's account balance is 2
    let balance  = await c0.token.methods("0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2").balanceOf(c0.account).call()
    expect(balance).to.equal("2")

    // this token can only be minted TO bob (receiver), ONLY IF he owns at least 2 NFTs from the collection when minting
    let token1 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        receiver: util.bob.address,
        balance: [{
          who: "receiver",
          where: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
          what: balance
        }]
      }
    })

    // no receiver input => therefore use the body.receiver as the receiver => bob doesn't own 2 NFTs so should fail
    tx = c0.token.send([token1])
    await expect(tx).to.be.revertedWith("10b");


    // this token can only be minted TO c0.account (receiver), ONLY IF he owns at least 2 NFTs from the collection when minting
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        receiver: c0.account,
        balance: [{
          who: "receiver",
          where: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
          what: balance
        }]
      }
    })

    tx = await c0.token.send([token2])

    let owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner).to.equal(c0.account)

  })
  it('sender remote ERC20 balance lock', async () => {
    await fork("rinkeby")

    let balance  = await c0.token.methods("0xb5959246b4e514aea910d5f218aa179870751ff2").balanceOf(c0.account).call()
    expect(balance).to.equal("100")


    // mint only if you own at least 101 TT ERC20 tokens
    let token1 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "sender",
          where: "0xb5959246b4e514aea910d5f218aa179870751ff2",
          what: parseInt(balance) + 1 // "101"
        }]
      }
    })

    // default account 1 => owns 100 TT ERC20 tokens
    // try to mint token (cid) => should fail because need at least 101
    tx = c0.token.send([token1])
    await expect(tx).to.be.revertedWith("10a");

    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "sender",
          where: "0xb5959246b4e514aea910d5f218aa179870751ff2",
          what: balance
        }]
      }
    })
    tx = await c0.token.send([token2])

    let owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner).to.equal(c0.account)
  })
  it('receiver remote ERC20 balance lock', async () => {
    await fork("rinkeby")

    let balance  = await c0.token.methods("0xb5959246b4e514aea910d5f218aa179870751ff2").balanceOf(c0.account).call()
    expect(balance).to.equal("100")

    // mint only if you own at least 101 TT ERC20 tokens
    let token1 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "receiver",
          where: "0xb5959246b4e514aea910d5f218aa179870751ff2",
          what: parseInt(balance) + 1 // "101"
        }]
      }
    })

    // default account 1 => owns 100 TT ERC20 tokens
    // try to mint token (cid) => should fail because need at least 101
    tx = c0.token.send([token1], [{ receiver: util.bob.address }])
    await expect(tx).to.be.revertedWith("10b");

    // the receiver will be set as c0.account automatically => still should fail because not enough balance
    tx = c0.token.send([token1])
    await expect(tx).to.be.revertedWith("10b");

    // now retry with the correct balance => should work
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        balance: [{
          who: "receiver",
          where: "0xb5959246b4e514aea910d5f218aa179870751ff2",
          what: balance
        }]
      }
    })
    tx = await c0.token.send([token2], [{ receiver: c0.account }])

    let owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    expect(owner).to.equal(c0.account)
  })
})
