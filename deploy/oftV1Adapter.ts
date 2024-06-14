import {LZ_ENDPOINTS} from '../constants/layerzeroEndpointsV1'
import hre from 'hardhat'
import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'

// npx hardhat deploy --tags OFTV1Adapter --network sepolia
// npx hardhat deploy --tags OFTV1Adapter --network base-sepolia

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

	const oftPlainToken = await deploy('OFTPlainToken', {
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

	const oftV1Adapter = await deploy('OFTV1Adapter', {
		from: deployer,
		args: [oftPlainToken.address, lzEndpointAddress, owner],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/mocks/OFTV1Adapter.sol:OFTV1Adapter',
	})

	console.log('OFTV1Adapter deployed to:', oftV1Adapter)

	await verifyContractWithRetry(
		'contracts/mocks/OFTV1Adapter.sol:OFTV1Adapter',
		oftV1Adapter.address,
		oftV1Adapter.args,
	)
}

module.exports.tags = ['OFTV1Adapter']
