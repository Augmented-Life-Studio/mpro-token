import {LZ_ENDPOINTS} from '../constants/layerzeroEndpointsV1'
import hre from 'hardhat'
import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'

// npx hardhat deploy --tags OFTV1Legacy --network sepolia
// npx hardhat deploy --tags OFTV1Legacy --network base-sepolia

module.exports = async function ({
	deployments,
	getNamedAccounts,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
}) {
	const {deployer, owner} = await getNamedAccounts()

	const TOKEN_NAME = 'OFTV1Legacy'
	const TOKEN_SYMBOL = 'OFTV1L'

	const {deploy} = deployments

	const lzEndpointAddress =
		LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

	const oftV1 = await deploy('OFTV1Legacy', {
		from: deployer,
		args: [TOKEN_NAME, TOKEN_SYMBOL, lzEndpointAddress, owner],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/mocks/OFTV1Legacy.sol:OFTV1',
	})

	console.log('OFTV1 deployed to:', oftV1)

	await verifyContractWithRetry(
		'contracts/mocks/OFTV1Legacy.sol:OFTV1',
		oftV1.address,
		oftV1.args,
	)
}

module.exports.tags = ['OFTV1Legacy']
