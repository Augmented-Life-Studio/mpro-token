import {LZ_ENDPOINTS} from '../constants/layerzeroEndpoints'
import hre from 'hardhat'
import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'

// npx hardhat deploy --tags OFTV2 --network sepolia
// npx hardhat deploy --tags OFTV2 --network base-sepolia

module.exports = async function ({
	deployments,
	getNamedAccounts,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
}) {
	const {deployer, owner} = await getNamedAccounts()

	const TOKEN_NAME = 'OFTV2'
	const TOKEN_SYMBOL = 'OFTV2'

	const {deploy} = deployments

	const lzEndpointAddress =
		LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

	const oftV2 = await deploy('OFTV2Receiver', {
		from: deployer,
		args: [TOKEN_NAME, TOKEN_SYMBOL, lzEndpointAddress, owner],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/mocks/OFTV2.sol:OFTV2',
	})

	console.log('OFTV2 deployed to:', oftV2)

	await verifyContractWithRetry(
		'contracts/mocks/OFTV2.sol:OFTV2',
		oftV2.address,
		oftV2.args,
	)
}

module.exports.tags = ['OFTV2']
