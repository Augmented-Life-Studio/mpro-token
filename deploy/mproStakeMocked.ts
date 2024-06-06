import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'
import {getDeploymentAddresses} from '../utils/readStatic'

// npx hardhat deploy --tags MproStakeMocked --network base-sepolia

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

	const mproRewardStake = await deploy(`MockedMPROStake`, {
		from: deployer,
		args: [],
		log: true,
		waitConfirmations: 5,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/mocks/MockedMPROStake.sol:MockedMPROStake',
	})

	console.log('MockedMPROStake deployed to:', mproRewardStake.address)

	await verifyContractWithRetry(
		'contracts/mocks/MockedMPROStake.sol:MockedMPROStake',
		mproRewardStake.address,
		mproRewardStake.args,
	)
}

module.exports.tags = ['MproStakeMocked']
