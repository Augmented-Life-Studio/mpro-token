import {LZ_ENDPOINTS} from '../constants/layerzeroEndpoints'
import hre from 'hardhat'
import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'

module.exports = async function ({
	deployments,
	getNamedAccounts,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
}) {
	const {deployer, owner} = await getNamedAccounts()

	const TOKEN_NAME = 'MPROTest'
	const TOKEN_SYMBOL = 'MPROTest'

	const {deploy} = deployments
	const lzEndpointAddress =
		LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

	const mproMasterDistributor = await deploy('MPROMasterDistributorLight', {
		from: deployer,
		args: [owner],
		log: true,
		waitConfirmations: 5,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/MPROMasterDistributorLight.sol:MPROMasterDistributor',
	})

	console.log(
		'MPROMasterDistributor deployed to:',
		mproMasterDistributor.address,
	)

	await verifyContractWithRetry(
		'contracts/MPROMasterDistributorLight.sol:MPROMasterDistributor',
		mproMasterDistributor.address,
		mproMasterDistributor.args,
	)

	const mproToken = await deploy('MPROLight', {
		from: deployer,
		args: [
			TOKEN_NAME,
			TOKEN_SYMBOL,
			lzEndpointAddress, // LayerZero Endpoint
			mproMasterDistributor.address,
			owner,
		],
		log: true,
		waitConfirmations: 5,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/MPROLight.sol:MPRO',
	})

	console.log('MPRO deployed to:', mproToken)

	await verifyContractWithRetry(
		'contracts/MPROLight.sol:MPRO',
		mproToken.address,
		mproToken.args,
	)
}

module.exports.tags = ['MPRORemote']
