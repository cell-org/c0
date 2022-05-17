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
  console.log("factory address", util.factory.address)

  let implementation = await c0.collection.methods(util.factory.address).implementation().call()
  console.log("implementation", implementation)

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

describe('send', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it('send duplicate tokens should fail', async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token], [])
    let token2 = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    let tx2 = c0.token.send([token2], [])
    await expect(tx2).to.be.revertedWith("ERC721: token already minted");
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
    // try to mint as the first account => should fail
    let tx1 = await c0.token.send([token1], [])
    let owner1 = await c0.token.methods(domain.address).ownerOf(token1.body.id).call()
    expect(owner1).to.equal(firstAccount)


    let token2 = await c0.token.create({
      domain,
      body: { cid: cid2, }
    })
    // switch to account2 a and try to mint
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })

    // try to mint as the first account => should fail
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
  it("if the receiver is specified, the mint goes to the receiver", async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, receiver: util.alice.address }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    console.log("owner", owner)
    expect(owner.toLowerCase()).to.equal(util.alice.address.toLowerCase())
  })
  it("if the receiver is NOT specified, the mint goes to the msgSender()", async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    console.log("owner", owner)
    expect(owner.toLowerCase()).to.equal(c0.account.toLowerCase())
  })
  it("if the receiver is NOT specified, the mint goes to the msgSender() (puzzle hash)", async () => {
    let token = await c0.token.create({
      domain,
      body: { cid: cid, puzzle: "this is the solution" }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token], [{ puzzle: "this is the solution" }] )
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    console.log("owner", owner)
    expect(owner.toLowerCase()).to.equal(c0.account.toLowerCase())
  })
  it("if the receiver is NOT specified, the mint goes to the msgSender() (senders)", async () => {
    let signers = await ethers.getSigners();
    let senders = signers.map(s => s.address)
    senders.push(c0.account)
    let token = await c0.token.create({
      domain,
      body: { cid: cid, senders }
    })
    console.log("TOKEN", token)
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    console.log("owner", owner)
    expect(owner.toLowerCase()).to.equal(c0.account.toLowerCase())
  })
  it('cannot mint if the signature is not from the owner of the contract', async () => {
    // send some money to the second account
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: c0.account,
      value: "" + Math.pow(10, 20)
    })
    // initialize c0 with the second account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let token = await c0.token.create({
      domain,
      body: { cid: cid, }
    })
    let tx = c0.token.send([token], [])
    await expect(tx).to.be.revertedWith("2");

  })
  it('mint value must match: single mint', async () => {
    let cids = []
    for(let i=0; i<2; i++) {
      let cid = await nebulus.add(Buffer.from("" + i))
      cids.push(cid)
    }
    let token = await c0.token.create({
      domain,
      body: {
        cid: cids[0],
        value: "" + Math.pow(10, 18),
      }
    })

    // Incorrect amount => should fail with error code 8
    let tx = c0.token.send([token], [], {
      value: "" + Math.pow(10, 17)
    })
    await expect(tx).to.be.revertedWith("11");

    // correct amount => should succeed
    let tx2 = await c0.token.send([token], [], {
      value: "" + Math.pow(10, 18)
    })
    console.log("token", token)

    let owner1 = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner1).to.equal(c0.account)
  })
  it('mint value must match: multiple mint', async () => {
    let cids = []
    for(let i=0; i<4; i++) {
      let cid = await nebulus.add(Buffer.from("" + i))
      cids.push(cid)
    }
    let tokens = await Promise.all(cids.map((cid) => {
      return c0.token.create({
        domain,
        body: {
          cid: cid,
          value: "" + Math.pow(10, 16),
        }
      })
    }))

    // Incorrect amount => should fail with error code 8
    let tx = c0.token.send(tokens, [], {
      value: "" + Math.pow(10, 16)
    })
    await expect(tx).to.be.revertedWith("11");

    // Correct amount => should succeed
    let tx2 = await c0.token.send(tokens, [], {
      value: "" + 4 * Math.pow(10, 16)
    })

    for(let i=0; i<4; i++) {
      let owner = await c0.token.methods(domain.address).ownerOf(tokens[i].body.id).call()
      expect(owner).to.equal(c0.account)
    }

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
    console.log("token" ,token)
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
    await network.provider.send("evm_increaseTime", [100])
    await network.provider.send("evm_mine")

    let tx = c0.token.send([token], [])
    await expect(tx).to.be.revertedWith("5");
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
  it('mint one', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        start: 0,
      }
    })
    let tx = await c0.token.send([token])
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)
  })
  it('mint multiple one at a time', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
      }
    })
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
      }
    })
    let tx = await c0.token.send([token], [])
    let tx2 = await c0.token.send([token2], [])
    //await expect(tx2).to.be.revertedWith("ERC721: token already minted")
    let owner1 = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    let owner2 = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    expect(owner1).to.equal(c0.account)
    expect(owner2).to.equal(c0.account)
  })
  it('mint multiple simultaneously', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
      }
    })
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
      }
    })
    let tx = await c0.token.send([token, token2])
    //await expect(tx2).to.be.revertedWith("ERC721: token already minted")
    let owner1 = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    let owner2 = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    expect(owner1).to.equal(c0.account)
    expect(owner2).to.equal(c0.account)
  })
  it('mint single', async () => {
    let token = await c0.token.create({
      domain,
      body: { cid }
    })
    console.log("token", token)
    console.log("sender", c0.account)
    let tx = await c0.token.send([token], [])
    console.log("Tx", tx)
  })
  it('if body.receiver is set, the token must go to the body.receiver', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        receiver: util.bob.address
      }
    })
    console.log("token", token)
    console.log("sender", c0.account)
    let tx = await c0.token.send([token], [])
    console.log("Tx", tx)
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", owner)
    expect(owner).to.equal(util.bob.address)
  })
  it('if body.receiver is set, the token must go to the body.receiver EVEN if you pass a different input.receiver', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        receiver: util.bob.address
      }
    })
    console.log("token", token)
    console.log("sender", c0.account)
    let tx = await c0.token.send([token], [{ receiver: util.alice.address }])
    console.log("Tx", tx)
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", owner)
    expect(owner).to.equal(util.bob.address)
  })
  it('if body.receiver is not set + input.receiver is not set, the mint goes to the minter by default', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
      }
    })
    console.log("token", token)
    console.log("sender", c0.account)
    let tx = await c0.token.send([token])
    console.log("Tx", tx)
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)
  })
  it('if body.receiver is not set + input.receiver is set, the mint goes to the input.receiver', async () => {
    let token = await c0.token.create({
      domain,
      body: {
        cid,
      }
    })
    console.log("token", token)
    console.log("sender", c0.account)
    let tx = await c0.token.send([token], [{ receiver: util.bob.address }])
    console.log("Tx", tx)
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", owner)
    expect(owner).to.equal(util.bob.address)
  })
  it('mint with sender merkle tree should work when a correct proof is provided', async () => {
    let signers = await ethers.getSigners();
    let senders = signers.map(s => s.address)
    senders.push(c0.account)

    let token = await c0.token.create({
      domain,
      body: { cid, senders }
    })
    console.log("token", token)
    console.log("sender", c0.account)
    let tx = await c0.token.send([token], [])
    console.log("Tx", tx)

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)

  })
  it('mint with sender  merkle tree should fail if the user is not in the tree', async () => {
    let signers = await ethers.getSigners();
    let senders = signers.map(s => s.address)

    let token = await c0.token.create({
      domain,
      body: { cid, senders }
    })
    console.log("token", token)
    console.log("sender", c0.account)
    let tx = c0.token.send([token], [])
    await expect(tx).to.be.revertedWith("7")
  })
  it('mint with hash puzzle', async () => {

    let token = await c0.token.create({
      domain,
      body: {
        cid: cid,
        puzzle: "this is a secret"
      }
    })
    console.log("token", token)
    let tx = await c0.token.send([token], [{ puzzle: "this is a secret" }])

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", owner)
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
    console.log("token", token)
    let tx = c0.token.send([token], [{ puzzle: "this is not a secret" }])
    await expect(tx).to.be.revertedWith("6")
  })
  it('senders merkle proof based auth', async () => {
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let account2 = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    // create a merkle tree with alice, bob and account2
    let token = await c0.token.create({
      domain,
      body: {
        cid,
        senders: [
          util.alice.address,
          util.bob.address,
          account2 
        ]
      }
    })
    // send some money to account2
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: account2,
      value: "" + Math.pow(10, 20)
    })

    // try to mint as owner => should fail because not part of the tree
    let tx = c0.token.send([token])
    await expect(tx).to.be.revertedWith("7")

    // try to mint as account2 => should work because part of the tree

    // switch to account2
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    console.log("token", token)
    tx = await c0.token.send([token])

    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    expect(owner).to.equal(account2)
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

    // try to mint as owner => should fail because not part of the tree
    let tx = c0.token.send([token], [{ receiver: c0.account }])
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
    console.log("token", token)

    // try to mint as owner => should fail because not part of the tree
    let tx = await c0.token.send([token], [{ receiver: util.alice.address }])
    let owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    console.log("owner", owner)
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
    console.log("token", token)

    // try to mint as account2 => should fail because the current account not part of the senders
    let tx = c0.token.send([token], [{ receiver: util.alice.address }])
    await expect(tx).to.be.revertedWith("7a")

    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })

    // should fail because the receiver is empty therefore will try to mint to account2, but account2 is not part of the receivers
    console.log("CURRENT ACCOUNT", c0.account)
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
    console.log("owner", owner)
    expect(owner).to.equal(util.bob.address)

  })
  it('mint based on local ownership', async () => {

    // try minting with a token that I don't own yet

    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
        owns: [{
          who: "sender",
          what: id(cidDigest)
        }]
      }
    })
    console.log("token2", token2)

    // The cid1 hasn't been minted yet so it should fail
    let tx = c0.token.send([token2])
    await expect(tx).to.be.revertedWith("ERC721: owner query for nonexistent token")

    //mint cid1 but to account2
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    let account2 = c0.account
    // send some funds to account2
    let tx0 = await web3.eth.sendTransaction({
      from: util.deployer.address,
      to: account2,
      value: "" + Math.pow(10, 20)
    })

    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    let token1 = await c0.token.create({
      domain,
      body: {
        cid: cid,
        receiver: account2
      }
    })
    console.log("token1", token1)
    tx = await c0.token.send([token1])
    let owner = await c0.token.methods(domain.address).ownerOf(token1.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(account2)

    // switch to account1 and try to mint the token2 again => should fail because account1 doesn't own token1
    // try to mint token2 => should fail again because account1 doesn't own token1
    // and you need token1 to mint token2
    // account2 owns token1
    tx = c0.token.send([token2])
    await expect(tx).to.be.revertedWith("9a")

    // switch to account2 and try to mint token2
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY_2 })
    tx = await c0.token.send([token2])

    owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(account2)




//    let token1 = await c0.token.create({
//      domain,
//      body: { cid, }
//    })
//    let tx = await c0.token.send([token1])
//
//    let owner = await c0.token.methods(domain.address).ownerOf(token1.id).call()
//    console.log("owner", owner)
//    expect(owner).to.equal(c0.account)
//    console.log("token1", token1)
//
  })
  it('mint based on remote collection ownership of the sender', async () => {
    await fork("mainnet")

    // sanity check => check the owner
    const abi = [{
      "inputs": [
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "ownerOf",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }]
    const contract = new web3.eth.Contract(abi, "0x023457063ac8f3cdbc75d910183b57c873b11d34")
    let owner = await contract.methods.ownerOf(1).call()
    await expect(owner).to.equal("0x73316d4224263496201c3420b36Cdda9c0249574")

    let token = await c0.token.create({
      domain,
      body: {
        cid: cid2,
        owns: [{
//          addr: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
//          id: 5
          who: "sender",
          where: "0x023457063ac8f3cdbc75d910183b57c873b11d34",
          what: 1
        }]
      }
    })


    // Account1 owns the NFT 0x023457063ac8f3cdbc75d910183b57c873b11d34/1
    // Try to mint from account2 => should fail
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    tx = c0.token.send([token])
    await expect(tx).to.be.revertedWith("9a");

    // Now switch back to account1 and mint
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    tx = await c0.token.send([token])

    owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)

  })
  it('mint based on remote collection ownership of the receiver', async () => {
    await fork("mainnet")

    // sanity check => check the owner
    const abi = [{
      "inputs": [
        {
          "internalType": "uint256",
          "name": "tokenId",
          "type": "uint256"
        }
      ],
      "name": "ownerOf",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }]
    const contract = new web3.eth.Contract(abi, "0x023457063ac8f3cdbc75d910183b57c873b11d34")
    let owner = await contract.methods.ownerOf(1).call()
    await expect(owner).to.equal("0x73316d4224263496201c3420b36Cdda9c0249574")

    let token = await c0.token.create({
      domain,
      body: {
        cid: cid2,
        owns: [{
          who: "receiver",      // receiver owns
          where: "0x023457063ac8f3cdbc75d910183b57c873b11d34",
          what: 1
        }]
      }
    })

    // Account1 owns the NFT 0x023457063ac8f3cdbc75d910183b57c873b11d34/1
    // Try to mint from account2 => should fail because no receiver is specified and the sender is not the owner
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    let account2 = c0.account
    tx = c0.token.send([token])
    await expect(tx).to.be.revertedWith("9b");

    // Try to mint from from account2 => should fail

    // Now switch back to account1 and try to mint TO account2 => should fail because the receiver needs to own the token
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    tx = c0.token.send([token], [{ receiver: account2 }])
    await expect(tx).to.be.revertedWith("9b");

    // Now try to mint to account1 => should work
    tx = await c0.token.send([token], [{ receiver: c0.account }])

    owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)

  })
  it('mint based on senders local balance', async () => {
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


    // Now lets mint token2
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
      }
    })
    tx = await c0.token.send([token2])
    owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)


    // try to mint token1 again => should fail again because we need at least 2

    tx = c0.token.send([token1])
    await expect(tx).to.be.revertedWith("10a")

    let balance = await c0.token.methods(domain.address).balanceOf(c0.account).call()
    expect(balance).to.equal("1")


    // Now lets mint token3
    let token3 = await c0.token.create({
      domain,
      body: {
        cid: cid3,
      }
    })
    tx = await c0.token.send([token3])
    owner = await c0.token.methods(domain.address).ownerOf(token3.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)

    balance = await c0.token.methods(domain.address).balanceOf(c0.account).call()
    expect(balance).to.equal("2")


    // Now the balance is 2.
    // try to mint => should succeed because account 1 now owns 2 NFTs
    console.log("token1", JSON.stringify(token1, null, 2))

    tx = await c0.token.send([token1])
    owner = await c0.token.methods(domain.address).ownerOf(token1.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)


    balance = await c0.token.methods(domain.address).balanceOf(c0.account).call()
    expect(balance).to.equal("3")


  })
  it('mint based on receivers local balance', async () => {
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

    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    let account2 = c0.account
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
    console.log("owner", owner)
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
    console.log("owner", owner)
    expect(owner).to.equal(account2)

    balance = await c0.token.methods(domain.address).balanceOf(account2).call()
    expect(balance).to.equal("2")


    // Now the receiver (account2) balance is 2.
    // try to mint => should succeed because account 1 now owns 2 NFTs

    tx = await c0.token.send([token1], [{ receiver: account2 }])
    owner = await c0.token.methods(domain.address).ownerOf(token1.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(account2)


    balance = await c0.token.methods(domain.address).balanceOf(account2).call()
    expect(balance).to.equal("3")


  })
  it('mint based on remote ERC721 balance', async () => {
    await fork("rinkeby")

    let balance  = await c0.token.methods("0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2").balanceOf(c0.account).call()
    console.log("balance", balance)
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
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)

  })
  it('mint based on senders remote ERC20 balance', async () => {
    await fork("rinkeby")

    let balance  = await c0.token.methods("0xb5959246b4e514aea910d5f218aa179870751ff2").balanceOf(c0.account).call()
    console.log("balance", balance)
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
    console.log("token1", JSON.stringify(token1, null, 2))

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
    console.log("TOKEN2", JSON.stringify(token2, null, 2))
    tx = await c0.token.send([token2])

    let owner = await c0.token.methods(domain.address).ownerOf(token2.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)
  })
  it('mint with burn condition', async() => {
    let tokens_to_burn = [
      await c0.token.create({
        domain,
        body: {
          cid: cid,
        }
      }),
      await c0.token.create({
        domain,
        body: {
          cid: cid2,
        }
      })
    ]
    let tx = await c0.token.send(tokens_to_burn)

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", id(cidDigest), owner)
    expect(owner).to.equal(c0.account)
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    console.log("owner", id(cidDigest2), owner)
    expect(owner).to.equal(c0.account)

    // Burn
    tx = await c0.token.methods(domain.address).burn([id(cidDigest), id(cidDigest2)]).send()

    // Mint with burn condition
    let next_gen = await c0.token.create({
      domain,
      body: {
        cid: cid3,
        burned: [{
          who: "sender",
          where: "0x0000000000000000000000000000000000000000",
          what: id(cidDigest)
        }, {
          who: "sender",
          where: "0x0000000000000000000000000000000000000000",
          what: id(cidDigest2)
        }]
      }
    })
    console.log("nextgen", next_gen)

    tx = await c0.token.send([next_gen])

    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest3)).call()
    console.log("owner", id(cidDigest3), cidDigest3, owner)
    expect(owner).to.equal(c0.account)

  })
  it('try to mint without meeting the sender burned condition => fail', async () => {
    let tokens_to_burn = [
      await c0.token.create({
        domain,
        body: {
          cid: cid,
        }
      }),
      await c0.token.create({
        domain,
        body: {
          cid: cid2,
        }
      })
    ]
    console.log(tokens_to_burn)
    let tx = await c0.token.send(tokens_to_burn)

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", id(cidDigest), owner)
    expect(owner).to.equal(c0.account)
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    console.log("owner", id(cidDigest2), owner)
    expect(owner).to.equal(c0.account)

    // Burn => only burn the first token
    tx = await c0.token.methods(domain.address).burn([id(cidDigest)]).send()

    // Mint with burn condition with token1 and token2 => should fail because token2 hasn't been burned
    let next_gen = await c0.token.create({
      domain,
      body: {
        cid: cid3,
        burned: [{
          who: "sender",
          what: id(cidDigest)
        }, {
          who: "sender",
          what: id(cidDigest2)
        }]
      }
    })
    console.log("nextgen", next_gen)

    tx = c0.token.send([next_gen])
    await expect(tx).to.be.revertedWith("8a")

    // Now burn token2 and retry
    tx = await c0.token.methods(domain.address).burn([id(cidDigest2)]).send()

    tx = await c0.token.send([next_gen])

    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest3)).call()
    console.log("owner", id(cidDigest3), cidDigest3, owner)
    expect(owner).to.equal(c0.account)

    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")
  })
  it('try to mint without meeting the receiver burned condition => fail', async () => {
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    let account2 = c0.account
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })

    // Mint to account2
    let tokens_to_burn = [
      await c0.token.create({
        domain,
        body: {
          cid: cid,
          receiver: account2
        }
      }),
      await c0.token.create({
        domain,
        body: {
          cid: cid2,
          receiver: account2
        }
      })
    ]
    console.log(tokens_to_burn)


    // send as account1
    let tx = await c0.token.send(tokens_to_burn)

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    console.log("owner", id(cidDigest), owner)
    expect(owner).to.equal(account2)
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    console.log("owner", id(cidDigest2), owner)
    expect(owner).to.equal(account2)

    // Switch to account 2 and burn the first token
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    tx = await c0.token.methods(domain.address).burn([id(cidDigest)]).send()

    // Switch back to account1
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })

    // Mint with burn condition with token1 and token2 => should fail because token2 hasn't been burned
    let next_gen = await c0.token.create({
      domain,
      body: {
        cid: cid3,
        burned: [{
          who: "receiver",
          what: id(cidDigest)
        }, {
          who: "receiver",
          what: id(cidDigest2)
        }]
      }
    })
    console.log("nextgen", next_gen)

    tx = c0.token.send([next_gen], [{ receiver: account2 }])
    await expect(tx).to.be.revertedWith("8b")

    // Now switch to account2 and burn token2 and retry
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    tx = await c0.token.methods(domain.address).burn([id(cidDigest2)]).send()
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })

    tx = await c0.token.send([next_gen], [{ receiver: account2 }])

    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest3)).call()
    console.log("owner", id(cidDigest3), cidDigest3, owner)
    expect(owner).to.equal(account2)

  })
})
