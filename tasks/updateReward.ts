import CHAIN_ID from '../constants/chainIds.json'
import {getDeploymentAddresses} from '../utils/readStatic'
import {MPRO} from '../typechain-types'
import {ethers} from 'ethers'

const zeroPad = (data: string, length: number): Uint8Array => {
	return ethers.getBytes(ethers.zeroPadValue(data, length), 'hex')
}

const REWARD_VALUE = '700000'

module.exports = async function (taskArgs: any, hre: any) {
	let localContract, remoteContract
	const {owner} = await hre.getNamedAccounts()

	const helperSigner = await hre.ethers.getSigner(owner)

	const stakeAddress = getDeploymentAddresses(hre.network.name)['MPROAutoStake']

	const mproToken = (await hre.ethers.getContractAt(
		'contracts/MPROLight.sol:MPRO',
		getDeploymentAddresses(hre.network.name)['MPROLight'],
	)) as MPRO

	const stakeContarct = await hre.ethers.getContractAt(
		'contracts/MPROStake.sol:MPROAutoStake',
		stakeAddress,
	)

	try {
		let tx
		tx = await mproToken
			.connect(helperSigner)
			.increaseAllowance(stakeAddress, ethers.parseEther(REWARD_VALUE))
		await tx.wait()

		tx = await stakeContarct
			.connect(helperSigner)
			.updateReward(ethers.parseEther(REWARD_VALUE))

		await tx.wait()

		const transaction = await tx.getTransaction()
		console.log(` tx: ${transaction?.hash}`)
	} catch (e: any) {
		console.log(`❌ [${hre.network.name}] updateReward with error: ${e}`)
	}
}
