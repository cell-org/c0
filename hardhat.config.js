/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const fs = require('fs')
const path = require('path')
require('dotenv').config()
require('@nomiclabs/hardhat-waffle')
require('hardhat-abi-exporter');
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-web3");
task("deploy", "deploys the contract", async (args, hre) => {
  const [deployer] = await hre.ethers.getSigners();
  let Factory = await hre.ethers.getContractFactory('Factory');
  //let factory = await Factory.deploy({nonce: 327 });
  let factory = await Factory.deploy();
  await factory.deployed();
  console.log("factory address", factory.address);
  await fs.promises.mkdir(path.resolve(__dirname, "./deployments"), { recursive: true }).catch((e) => {})
  await fs.promises.writeFile(path.resolve(__dirname, `./deployments/${hre.network.name}.json`), JSON.stringify({ address: factory.address }))
  return factory;
})
task("errorgen", "generates an error code mapping JSON", async (args, hre) => {
  let lines = await fs.promises.readFile("contracts/C0.sol", "utf8").then((c) => {
    return c.split("\n")
  })
  let errorlines = lines.filter((line) => {
    return /require\(/.test(line)
  }).map((line) => {
    return line.trim()
  })

  let errors = {}
  for(let line of errorlines) {
    let match = /"([^\"]+)"\);/.exec(line)
    console.log(match)
    let matched = match[1]
    errors[matched] = line
  }
  console.log(errors)
})
task("v", "verify on etherscan", async (args, hre) => {
  console.log("x")
  const FACTORY_ABI = require(path.resolve(__dirname, "./abi/contracts/Factory.sol/Factory.json"));
  const FACTORY_JSON = require(path.resolve(__dirname, `./deployments/${hre.network.name}.json`));
  let factoryAddress = FACTORY_JSON.address
  console.log("verify factory", factoryAddress)
  try {
    await hre.run("verify:verify", {
      address: factoryAddress
    });
  } catch (e) {
    console.log("already verified")
  }
  const [deployer] = await ethers.getSigners();
  let contract = new ethers.Contract(factoryAddress, FACTORY_ABI, deployer)
  let implementation = await contract.implementation()
  console.log("verify implementation", implementation)
  try {
    await hre.run("verify:verify", {
      address: implementation
    })
  } catch (e) {
    console.log("already verified")
  }
})
module.exports = {
  gasReporter: {
    currency: "USD",
    //gasPrice: 80,
//    gasPrice: 15,
//    gasPrice: 150,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    enabled: true,
  },
  solidity: {
    //version: "0.8.4",
    version: "0.8.9",
    //version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    }
  },
  mocha: {
    timeout: 2000000000
  },
  networks: {
    hardhat: {
//      forking: {
//        url: process.env.MAINNET,
//        //url: process.env.RINKEBY
//        blockNumber: 14705649
//
//      },
      chainId: 1337,
      timeout: 1000 * 60 * 60 * 24, // 1 day
      //gas: 12000000,
      gas: 15000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,

//      accounts: [{
//        privateKey: process.env.CLEAN2_PRIVATE_KEY,
//        balance: "100000000000000000"
//      }]
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [process.env.RINKEBY_PRIVATE_KEY]
//      accounts: [process.env.CLEAN2_PRIVATE_KEY]
    },
    rinkeby: {
      url: process.env.RINKEBY,
//      gasPrice: 3000000000,
//      timeout: 1000 * 60 * 60 * 24, // 1 day
      //accounts: [process.env.RINKEBY_PRIVATE_KEY],
      accounts: [process.env.CELL_PRIVATE_KEY],
//      accounts: [process.env.CLEAN2_PRIVATE_KEY],
    },
    mainnet: {
//      gasPrice: 74000000000,
//      gasPrice: 70000000000,
      gasPrice: 15000000000,
      //gasPrice: 16000000000,
      timeout: 1000 * 60 * 60 * 24, // 1 day
      url: process.env.MAINNET,
      //accounts: [process.env.MAINNET_PRIVATE_KEY],
      accounts: [process.env.CELL_PRIVATE_KEY],
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
