import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'
import {getDeploymentAddresses} from '../utils/readStatic'
import {ethers} from 'hardhat'

// npx hardhat deploy --tags MPROStake --network base

const MPRO_TOKEN = '0xd88611a629265c9af294ffdd2e7fa4546612273e'

module.exports = async function ({
	deployments,
	getNamedAccounts,
	network,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
	network: any
}) {
	let tx
	const {deployer, owner} = await getNamedAccounts()

	const {deploy} = deployments

	const netName = network.name

	const deploymentAddresses = getDeploymentAddresses(netName)

	const mproRewardStake = await deploy(`MPRORewardStake`, {
		from: deployer,
		args: [
			MPRO_TOKEN, //MPRO token address,
			deployer,
		],
		log: true,
		waitConfirmations: 5,
		skipIfAlreadyDeployed: true,
		contract: 'contracts/MPROStake.sol:MPROStake',
	})

	console.log('MPROStake deployed to:', mproRewardStake.address)

	const mproStake = await ethers.getContractAt(
		`MPRORewardStake`,
		mproRewardStake.address,
	)

	const currentTimestamp = Math.floor(Date.now() / 1000)

	tx = await mproStake.setStakeConfig(
		currentTimestamp, // _stakeStartTimestamp
		currentTimestamp + 62 * 24 * 60 * 60, // _stakeEndTimestamp
		currentTimestamp, // _updateStakersStartTimestamp
		currentTimestamp + 47 * 24 * 60 * 60, // _updateStakersEndTimestamp
		currentTimestamp, // _declarationStartTimestamp
		currentTimestamp + 46 * 24 * 60 * 60, // _declarationEndTimestamp
	)
	await tx.wait()
	console.log(`Stake config set in tx: ${tx.hash}`)
}

module.exports.tags = ['MPROStake']