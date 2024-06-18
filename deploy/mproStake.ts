import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'
import {getDeploymentAddresses} from '../utils/readStatic'
import {ethers} from 'hardhat'

// npx hardhat deploy --tags MPROStake --network base
// npx hardhat deploy --tags MPROStake --network base-sepolia

const MPRO_TOKEN = '0xbf31DE649bA7AC79e92FEe4171B16c84B7c352A0'

module.exports = async function ({
	deployments,
	getNamedAccounts,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
}) {
	let tx
	const {deployer} = await getNamedAccounts()
	const updaterSigner = await ethers.getSigner(deployer)

	const {deploy} = deployments

	const mproStakeDeployment = await deploy(`MPROStake`, {
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

	await verifyContractWithRetry(
		'contracts/MPROStake.sol:MPROStake',
		mproStakeDeployment.address,
		mproStakeDeployment.args,
	)

	console.log('MPROStake deployed to:', mproStakeDeployment.address)

	const mproStake = await ethers.getContractAt(
		`MPROStake`,
		mproStakeDeployment.address,
	)

	const currentTimestamp = Math.floor(Date.now() / 1000) + 10 // 10 seconds in the future

	tx = await mproStake.connect(updaterSigner).setStakeConfig(
		currentTimestamp, // _stakeStartTimestamp
		currentTimestamp + 62 * 24 * 60 * 60, // _stakeEndTimestamp
	)
	await tx.wait()
	console.log(`Stake config set in tx: ${tx.hash}`)

	tx = await mproStake.connect(updaterSigner).setClaimRewardConfig(
		currentTimestamp, // _stakeStartTimestamp
		currentTimestamp + 62 * 24 * 60 * 60, // _stakeEndTimestamp
		100, // _rewardUnlockPercentPerPeriod
	)
	await tx.wait()
	console.log(`Claim reward config set in tx: ${tx.hash}`)
}

module.exports.tags = ['MPROStake']
