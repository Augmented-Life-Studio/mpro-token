import CHAIN_ID from '../constants/chainIds.json'
import {getDeploymentAddresses} from '../utils/readStatic'
import {MPRO, MPROMasterDistributor} from '../typechain-types'
import {ethers} from 'ethers'

module.exports = async function (taskArgs: any, hre: any) {
	const contract = await hre.ethers.getContractAt(
		'contracts/MPROAutoStake.sol:MPROAutoStake',
		'0x8beaacF2563a6D225CC8cE11C076a6bCFDCD85AD',
	)

	const stakeStart = await contract.stakeStartTimestamp()
	const stakeEnd = await contract.stakeEndTimestamp()
	const updateStart = await contract.updateStakersStartTimestamp()
	const updateEnd = await contract.updateStakersEndTimestamp()
	const rewardPerSecond = await contract.rewardPerSecond()
	const declarationStart = await contract.declarationStartTimestamp()
	const declarationEnd = await contract.declarationEndTimestamp()

	console.log(
		`stakeStart: ${stakeStart}\n
        stakeEnd: ${stakeEnd}\n
        updateStart: ${updateStart}\n
        updateEnd: ${updateEnd}\n
        rewardPerSecond: ${rewardPerSecond}\n
        declarationStart: ${declarationStart}\n
        declarationEnd: ${declarationEnd}\n
        `,
	)
}
