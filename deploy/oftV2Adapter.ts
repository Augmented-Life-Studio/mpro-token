import {LZ_ENDPOINTS} from '../constants/layerzeroEndpoints'
import hre from 'hardhat'
import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'

// npx hardhat deploy --tags OFTV2Adapter --network sepolia
// npx hardhat deploy --tags OFTV2Adapter --network base-sepolia

module.exports = async function ({
	deployments,
	getNamedAccounts,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
}) {
	const {deployer, owner} = await getNamedAccounts()

	const TOKEN_NAME = 'OFTPlainToken'
	const TOKEN_SYMBOL = 'OFTP'

	const {deploy} = deployments

	const lzEndpointAddress =
		LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

	const oftPlainToken = await deploy('OFTPlainTokenV2', {
		from: deployer,
		args: [TOKEN_NAME, TOKEN_SYMBOL, owner],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/mocks/OFTPlainToken.sol:OFTPlainToken',
	})

	console.log('OFTPlainToken deployed to:', oftPlainToken)

	await verifyContractWithRetry(
		'contracts/mocks/OFTPlainToken.sol:OFTPlainToken',
		oftPlainToken.address,
		oftPlainToken.args,
	)

	const oftV2Adapter = await deploy('OFTV2Adapter', {
		from: deployer,
		args: [oftPlainToken.address, lzEndpointAddress, owner],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/mocks/OFTV2Adapter.sol:OFTV2Adapter',
	})

	console.log('OFTV2Adapter deployed to:', oftV2Adapter)

	await verifyContractWithRetry(
		'contracts/mocks/OFTV2Adapter.sol:OFTV2Adapter',
		oftV2Adapter.address,
		oftV2Adapter.args,
	)
}

module.exports.tags = ['OFTV2Adapter']
