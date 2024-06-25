require('dotenv').config()
import {HardhatUserConfig} from 'hardhat/config'
import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-deploy'
import '@nomiclabs/hardhat-web3'
import 'hardhat-deploy-ethers'
import './tasks/index'
import 'solidity-coverage'
import '@nomicfoundation/hardhat-verify'

const {
	bscscanApiKey,
	polygonMumbaiApiKey,
	ethApiKey,
	arbiApiKey,
	baseApiKey,
} = require('./secrets.json')

function getMnemonic(networkName: string) {
	if (networkName) {
		const mnemonic = process.env['MNEMONIC_' + networkName.toUpperCase()]
		if (mnemonic && mnemonic !== '') {
			return mnemonic
		}
	}

	const mnemonic = process.env.MNEMONIC
	if (!mnemonic || mnemonic === '') {
		return 'test test test test test test test test test test test junk'
	}

	return mnemonic
}

function accounts(chainKey: string) {
	return {mnemonic: getMnemonic(chainKey)}
}

const config: HardhatUserConfig = {
	namedAccounts: {
		// Account used for deployment
		deployer: {
			default: '0x6eE701DE9e3d118c0553Ff45f84179614eb31161', // wallet address 0, of the mnemonic in .env
		},
		// Owner of the contract
		owner: {
			default: '0xcb845d8f5bA2728C531ed04F0c8420533bc4f5db', // wallet address 0, of the mnemonic in .env
		},
		// Treasury address
		treasury: {
			default: '0x68E5CF81eb3c319e47006EAe067E04ebf6610204',
		},
		mproDistributor: {
			default: '0xcb845d8f5bA2728C531ed04F0c8420533bc4f5db',
		},
	},
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
				version: '0.8.22',
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
		ethereum: {
			url: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // public infura endpoint
			chainId: 1,
			accounts: accounts('ethereum'),
		},
		base: {
			url: 'https://mainnet.base.org',
			chainId: 8453,
			accounts: accounts('base'),
		},
		bsc: {
			url: 'https://bsc-dataseed1.binance.org',
			chainId: 56,
			accounts: accounts('bsc'),
		},
		avalanche: {
			url: 'https://api.avax.network/ext/bc/C/rpc',
			chainId: 43114,
			accounts: accounts('avalanche'),
		},
		polygon: {
			url: 'https://rpc-mainnet.matic.quiknode.pro',
			chainId: 137,
			accounts: accounts('polygon'),
		},
		arbitrum: {
			url: `https://arb1.arbitrum.io/rpc`,
			chainId: 42161,
			accounts: accounts('arbitrum'),
		},
		optimism: {
			url: `https://mainnet.optimism.io`,
			chainId: 10,
			accounts: accounts('optimism'),
		},
		fantom: {
			url: `https://rpcapi.fantom.network`,
			chainId: 250,
			accounts: accounts('fantom'),
		},
		metis: {
			url: `https://andromeda.metis.io/?owner=1088`,
			chainId: 1088,
			accounts: accounts('metis'),
		},
		sepolia: {
			url: `https://ethereum-sepolia-rpc.publicnode.com`,
			chainId: 11155111,
			accounts: accounts('sepolia'),
		},

		'bsc-testnet': {
			url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
			chainId: 97,
			accounts: accounts('bsc-testnet'),
		},
		fuji: {
			url: `https://api.avax-test.network/ext/bc/C/rpc`,
			chainId: 43113,
			accounts: accounts('fuji'),
		},
		mumbai: {
			url: 'https://polygon-testnet.public.blastapi.io',
			chainId: 80001,
			accounts: accounts('mumbai'),
		},
		'arbitrum-sepolia': {
			url: `https://goerli-rollup.arbitrum.io/rpc/`,
			chainId: 421613,
			accounts: accounts('arbitrum-goerli'),
		},
		'optimism-sepolia': {
			url: `https://goerli.optimism.io/`,
			chainId: 420,
			accounts: accounts('optimism-goerli'),
		},
		'fantom-testnet': {
			url: `https://rpc.ankr.com/fantom_testnet`,
			chainId: 4002,
			accounts: accounts('fantom-testnet'),
		},
		'base-sepolia': {
			url: `https://sepolia.base.org`,
			chainId: 84532,
			accounts: accounts('base-sepolia'),
		},
	},
	mocha: {
		timeout: 20000,
	},
	etherscan: {
		// Change it based on scan
		apiKey: {
			bscTestnet: bscscanApiKey,
			bsc: bscscanApiKey,
			polygon: polygonMumbaiApiKey,
			polygonMumbai: polygonMumbaiApiKey,
			mainnet: ethApiKey,
			sepolia: ethApiKey,
			arbitrum: arbiApiKey,
			arbitrumSepolia: arbiApiKey,
			arbitrumOne: arbiApiKey,
			base: baseApiKey,
			baseSepolia: baseApiKey,
		},
	},
}

export default config
