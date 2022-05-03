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
const parsed = CID.parse(cid).toString(base16.encoder)
const parsed2 = CID.parse(cid2).toString(base16.encoder)
const cidDigest = "0x" + parsed.slice(9);
const cidDigest2 = "0x" + parsed2.slice(9);
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
      blockNumber: 10612780
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
    await expect(tx).to.be.revertedWith("10");

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
    await expect(tx).to.be.revertedWith("10");

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
  it.only('mint single', async () => {
    let token = await c0.token.create({
      domain,
      body: { cid }
    })
    console.log("token", token)
    console.log("sender", c0.account)
    let tx = await c0.token.send([token], [])
    console.log("Tx", tx)
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
  it('merkle proof based auth', async () => {
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
  it('mint based on local ownership', async () => {

    // try minting with a token that I don't own yet

    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    let token2 = await c0.token.create({
      domain,
      body: {
        cid: cid2,
        owns: [{
          id: id(cidDigest)
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
    await expect(tx).to.be.revertedWith("9")

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
  it('mint based on remote collection ownership', async () => {
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
//          collection: "0x3ad4a8773a078c6a2fd4e4aaf86c4e95d63143f2",
//          id: 5
          collection: "0x023457063ac8f3cdbc75d910183b57c873b11d34",
          id: 1
        }]
      }
    })


    // Account1 owns the NFT 0x023457063ac8f3cdbc75d910183b57c873b11d34/1
    // Try to mint from account2 => should fail
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY2 })
    tx = c0.token.send([token])
    await expect(tx).to.be.revertedWith("9");

    // Now switch back to account1 and mint
    await c0.init({ web3, key: process.env.RINKEBY_PRIVATE_KEY })
    tx = await c0.token.send([token])

    owner = await c0.token.methods(domain.address).ownerOf(token.body.id).call()
    console.log("owner", owner)
    expect(owner).to.equal(c0.account)

  })
})
