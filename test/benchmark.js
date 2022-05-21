const hre = require('hardhat');
const { printTable } = require('console-table-printer');
const fetch = require('cross-fetch')
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

const getrate = async () => {
  let r = await fetch('https://ethgasstation.info/api/ethgasAPI.json').then((res) => {
    return res.json()
  })
  return {
    fast: r.fast,
    fastest: r.fastest,
    slow: r.safeLow,
    average: r.average
  }
}
const getprice = async () => {
  let r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum').then((res) => {
    return res.json()
  })
  return r[0].current_price
}


describe('benchmark', () => {
  beforeEach(async () => {
    await bootstrap()
  })
  it('bulk mint', async () => {
    let table = []
    let rates = await getrate()
    let price = await getprice()
    let s = "slow"
    for(let i=0; i<20; i++) {
      let tokens = []
      for(let j=0; j<i+1; j++) {
        let cid = await nebulus.add(Buffer.from("" + i + "-" + j))
        let token = await c0.token.create({
          domain,
          body: {
            cid,
          }
        })
        tokens.push(token)
      }
      console.log(tokens)
      let tx = await c0.token.send(tokens, [])
      let r = rates[s] / 10
      let eth = tx.gasUsed * r / Math.pow(10, 9)
      let estimate = Math.floor(tx.gasUsed * r / Math.pow(10, 9) * price)
//      console.log("gas", tx.gasUsed, "eth", eth, "usd", estimate)
      table.push({
        count: i,
        gas: tx.gasUsed,
        eth: eth,
        usd: `$${estimate}`
      })
    }
    printTable(table)
  })
  it('mint revenue split', async () => {

    let rates = await getrate()
    let price = await getprice()
    let s = "slow"


    let accounts = util.addresses

    // create payments
    let cids = []
    for(let i=0; i<accounts.length; i++) {
      let cid = await nebulus.add(Buffer.from("" + i))
      cids.push(cid)
    }
    let table = []
    for(let i=1; i<accounts.length; i++) {
      let payments = accounts.slice(0, i).map((a) => {
        return {
          where: a,
          what: 10 ** 4
        }
      })
//      console.log("payments", payments)
      let token = await c0.token.create({
        domain,
        body: {
          cid: cids[i-1],
          payments
        }
      })
//      console.log(token)
      let tx = await c0.token.send([token], [])

      let r = rates[s] / 10
      let eth = tx.gasUsed * r / Math.pow(10, 9)
      let estimate = Math.floor(tx.gasUsed * r / Math.pow(10, 9) * price)
//      console.log("gas", tx.gasUsed, "eth", eth, "usd", estimate)
      table.push({
        receivers: i,
        gas: tx.gasUsed,
        eth: eth,
        usd: `$${estimate}`
      })
    }
    console.log("##############################################################################")
    console.log("#")
    console.log("#   BENCHMARK")
    console.log("#")
    console.log("#   The effect of revenue share receivers on the mint gas fee")
    console.log("#")
    console.log("##############################################################################")
    printTable(table)
  })
})
