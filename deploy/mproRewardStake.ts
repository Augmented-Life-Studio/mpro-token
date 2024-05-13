import {ethers} from 'hardhat'
import {LZ_ENDPOINTS} from '../constants/layerzeroEndpoints'
import hre from 'hardhat'
import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import {verifyContractWithRetry} from '../utils/verifyContract'

// npx hardhat deploy --tags MPRORewardStake --network base-sepolia

module.exports = async function ({
	deployments,
	getNamedAccounts,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
}) {
	const {deployer, owner} = await getNamedAccounts()

	const {deploy} = deployments

	const mproRewardStake = await deploy('MPRORewardStake', {
		from: deployer,
		args: [
			'0xbf31DE649bA7AC79e92FEe4171B16c84B7c352A0', //MPRO token address,
			1715592976,
			1715932800,
			1715760000,
			owner,
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
