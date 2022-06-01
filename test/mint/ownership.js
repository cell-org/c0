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

describe('ownership lock', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it('sender local ownership lock', async () => {

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
    tx = await c0.token.send([token1])
    let owner = await c0.token.methods(domain.address).ownerOf(token1.body.id).call()
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
  it('sender remote ownership lock', async () => {
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
    expect(owner).to.equal(c0.account)

  })
  it('receiver remote ownership lock: test offline', async () => {

    let firstDomain = domain
    // Deploy another contract
    let secondCollection = await c0.collection.create({
      factory: util.factory.address,
      index: 1,   // second contract with index 1
      name: "Hello",
      symbol: "WORLD"
    })
    let secondDomain = {
      address: secondCollection.logs[0].address,
      chainId: await web3.eth.getChainId(),
      name: "Hello"
    }

    console.log("firstDomain", firstDomain)
    console.log("secondDomain", secondDomain)

    // get address for the custom wallet
    // send some funds to the custom wallet address so it has the money to do stuff


    // Mint a token first to the first contract
    let token = await c0.token.create({
      domain: firstDomain,
      body: {
        cid: cid,
      }
    })
    expect(token.domain.verifyingContract).to.equal(firstDomain.address)
    let tx = await c0.token.send([token])

    // Get the token's owner from the first contract
    let owner = await c0.token.methods(firstDomain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)

    // Mint with the ownership of a token that hasn't been minted yet => should fail with "token doesnt exist"
    let next_gen = await c0.token.create({
      domain: secondDomain,
      body: {
        cid: cid3,
        owns: [{
          who: "sender",
          where: firstDomain.address,
          what: id(cidDigest2)
        }]
      }
    })
    expect(next_gen.body.relations[0].addr).to.equal(firstDomain.address)
    expect(next_gen.body.relations[0].id).to.equal(id(cidDigest2))
    expect(next_gen.domain.verifyingContract).to.equal(secondDomain.address)
    tx = c0.token.send([next_gen])
    await expect(tx).to.be.revertedWith("ERC721: owner query for nonexistent token")

    // Mint with the ownership from the first contract
    let next_gen2 = await c0.token.create({
      domain: secondDomain,
      body: {
        cid: cid3,
        owns: [{
          who: "sender",
          where: firstDomain.address,
          what: id(cidDigest)
        }]
      }
    })
    // the burnership contract address is the first domain address
    expect(next_gen2.body.relations[0].addr).to.equal(firstDomain.address)
    // the burnership id is the cid
    expect(next_gen2.body.relations[0].id).to.equal(id(cidDigest))
    expect(next_gen2.domain.verifyingContract).to.equal(secondDomain.address)
    tx = await c0.token.send([next_gen2])
    // Check the owner of the new token
    owner = await c0.token.methods(secondDomain.address).ownerOf(id(cidDigest3)).call()
    expect(owner).to.equal(c0.account)
  })
  it('receiver remote ownership lock: test with mainnet tokens', async () => {
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
    expect(owner).to.equal(c0.account)

  })
})
