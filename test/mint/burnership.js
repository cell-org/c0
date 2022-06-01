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

describe('burnership lock', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it('single burnership lock', async () => {
    // Mint a token first
    let tokens_to_burn = [
      await c0.token.create({
        domain,
        body: {
          cid: cid,
        }
      }),
    ]
    let tx = await c0.token.send(tokens_to_burn)

    // Get each token's owner
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)

    // Burn the token
    tx = await c0.token.burn(domain.address, [id(cidDigest)])

    // Check the burned token to make sure it no longer exists
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    // Mint with the burnership of a token that hasn't been burned yet => should fail
    let next_gen = await c0.token.create({
      domain,
      body: {
        cid: cid3,
        burned: [{
          who: "sender",
          where: "0x0000000000000000000000000000000000000000",
          what: id(cidDigest2)
        }]
      }
    })
    tx = c0.token.send([next_gen])
    await expect(tx).to.be.revertedWith("8a")

    // Mint with the burnership of a token that has been burned => should work

    let next_gen2 = await c0.token.create({
      domain,
      body: {
        cid: cid3,
        burned: [{
          who: "sender",
          where: "0x0000000000000000000000000000000000000000",
          what: id(cidDigest)
        }]
      }
    })
    tx = await c0.token.send([next_gen2])
    // Check the owner of the new token
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest3)).call()
    expect(owner).to.equal(c0.account)
  })
  it('multiple burnership conjunction lock', async() => {
    // Mint two tokens first
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

    // Get each token's owner
    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    expect(owner).to.equal(c0.account)

    // Burn both tokens that were just minted
    tx = await c0.token.methods(domain.address).burn([id(cidDigest), id(cidDigest2)]).send()

    // Check the burned tokens to make sure they no longer exist
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    // Mint with burnership
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
    tx = await c0.token.send([next_gen])
    // Check the owner of the new token
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest3)).call()
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
    let tx = await c0.token.send(tokens_to_burn)

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
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

    tx = c0.token.send([next_gen])
    await expect(tx).to.be.revertedWith("8a")

    // Now burn token2 and retry
    tx = await c0.token.methods(domain.address).burn([id(cidDigest2)]).send()

    tx = await c0.token.send([next_gen])

    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")

    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest3)).call()
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


    // send as account1
    let tx = await c0.token.send(tokens_to_burn)

    let owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(account2)
    owner = await c0.token.methods(domain.address).ownerOf(id(cidDigest2)).call()
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
    expect(owner).to.equal(account2)

  })
  it('single remote burnership lock', async () => {

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
    let tokens_to_burn = [
      await c0.token.create({
        domain: firstDomain,
        body: {
          cid: cid,
        }
      }),
    ]
    expect(tokens_to_burn[0].domain.verifyingContract).to.equal(firstDomain.address)
    let tx = await c0.token.send(tokens_to_burn)

    // Get the token's owner from the first contract
    let owner = await c0.token.methods(firstDomain.address).ownerOf(id(cidDigest)).call()
    expect(owner).to.equal(c0.account)

    // Burn the token from the first contract
    // Burn the token
    tx = await c0.token.burn(firstDomain.address, [id(cidDigest)])
    // Check the burned token to make sure it no longer exists
    owner = c0.token.methods(domain.address).ownerOf(id(cidDigest)).call()
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")



    // Mint a token on the second contract with the burnership from the first contract

    // Mint with the burnership of a token that hasn't been burned yet => should fail
    let next_gen = await c0.token.create({
      domain: secondDomain,
      body: {
        cid: cid3,
        burned: [{
          who: "sender",
          where: firstDomain.address,
          what: id(cidDigest2)
        }]
      }
    })

    // the burnership contract address is the first domain address
    expect(next_gen.body.relations[0].addr).to.equal(firstDomain.address)
    // the burnership id is the cid2
    expect(next_gen.body.relations[0].id).to.equal(id(cidDigest2))
    expect(next_gen.domain.verifyingContract).to.equal(secondDomain.address)
    tx = c0.token.send([next_gen])
    await expect(tx).to.be.revertedWith("8a")

    // Mint with the burnership of a token that has been burned => should work

    let next_gen2 = await c0.token.create({
      domain: secondDomain,
      body: {
        cid: cid3,
        burned: [{
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
})
