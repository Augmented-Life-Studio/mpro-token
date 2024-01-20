import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";

const {
	mnemonic,
	bscscanApiKey,
	polygonMumbaiApiKey,
	ethApiKey,
	privateKey,
} = require('./secrets.json')

const config: HardhatUserConfig = {
  gasReporter: {
		currency: 'USD',
		token: 'BNB',
		gasPriceApi: 'https://api.bscscan.com/api?module=proxy&action=eth_gasPrice',
		gasPrice: 20,
		coinmarketcap: '48fdecb5-5c9f-4424-8f58-c985679e3b90',
		// enabled: process.env.GAS_REPORT ? true : false,
		enabled: false,
	},
	solidity: {
		compilers: [
			{
				version: '0.8.20',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: '0.8.12',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
		],
  },
  networks: {
		mumbai: {
			url: 'https://polygon-testnet-rpc.allthatnode.com:8545',
			chainId: 80001,
			accounts: [privateKey],
		},
		polygon_mainnet: {
			url: 'https://rpc-mainnet.matic.quiknode.pro',
			chainId: 137,
			accounts: [privateKey],
		},
		testnet: {
			url: 'https://bsc-testnet.publicnode.com',
			chainId: 97,
			gasPrice: 20000000000,
			accounts: {mnemonic: mnemonic},
		},
		mainnet: {
			url: 'https://bsc-dataseed.binance.org/',
			chainId: 56,
			gasPrice: 20000000000,
			accounts: {mnemonic: mnemonic},
		},
		ganache: {
			url: 'http://127.0.0.1:8545',
			accounts: {
				mnemonic: mnemonic,
			},
		},
		goerli: {
			url: 'https://eth-goerli.public.blastapi.io',
			accounts: {
				mnemonic: mnemonic,
			},
			chainId: 5,
		},
  },
  mocha: {
		timeout: 20000,
	},
  etherscan: {
		// Change it based on scan
		apiKey: bscscanApiKey,
	},
};

export default config;
