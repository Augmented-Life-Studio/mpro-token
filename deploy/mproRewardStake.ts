import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'
import {getDeploymentAddresses} from '../utils/readStatic'

// npx hardhat deploy --tags MPRORewardStake --network base-sepolia

module.exports = async function ({
	deployments,
	getNamedAccounts,
	network,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
	network: any
}) {
	const {deployer, owner} = await getNamedAccounts()

	const {deploy} = deployments

	const netName = network.name

	const deploymentAddresses = getDeploymentAddresses(netName)

	const mproToken = deploymentAddresses['MPROLight']

	const mproRewardStake = await deploy('MPRORewardStake', {
		from: deployer,
		args: [
			mproToken, //MPRO token address,
			deployer,
		],
		log: true,
		waitConfirmations: 5,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/MPRORewardStake.sol:MPRORewardStake',
	})

	console.log('MPRORewardStake deployed to:', mproRewardStake.address)

	await verifyContractWithRetry(
		'contracts/MPRORewardStake.sol:MPRORewardStake',
		mproRewardStake.address,
		mproRewardStake.args,
	)
}

module.exports.tags = ['MPRORewardStake']