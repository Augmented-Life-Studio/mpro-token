import {ethers} from 'ethers'
const fs = require('fs')
import {getDeploymentAddresses} from '../utils/readStatic'
import {MPRO} from '../typechain-types'

interface Staker {
	walletAddress: string
	reward: number
	txHash?: string
}
interface StakersData {
	cycleId: string
	stakers: Staker[]
	amount: number
}

interface DBStakersData {
	cycleId: string
	rewardDistributionTxHash: string
	bridgeTxHash: string
	stakers: {
		[key: string]: {walletAddress: string}[]
	}
}

module.exports = async function (args: any, hre: any) {
	const updateStakersCycleFile = `./manualUpdateStakers/${args.cycleId}.json`
	const stakersData = JSON.parse(
		fs.readFileSync(updateStakersCycleFile, 'utf8'),
	) as StakersData
	const {owner} = await hre.getNamedAccounts() // Updated address
	const updaterSigner = await hre.ethers.getSigner(owner)
	const mproAddress = getDeploymentAddresses(hre.network.name)['MPROLight']
	const stakeAddress = getDeploymentAddresses(hre.network.name)['MPROAutoStake']

	const mproToken = (await hre.ethers.getContractAt(
		'contracts/MPROLight.sol:MPRO',
		mproAddress,
	)) as MPRO

	const stakeContarct = await hre.ethers.getContractAt(
		'contracts/MPROStake.sol:MPROAutoStake',
		stakeAddress,
	)

	const updaterMPROBalance = await mproToken.balanceOf(owner)
	const stakeMPROAllowance = await mproToken.allowance(owner, stakeAddress)

	const amountToUpdate = ethers.parseEther(String(stakersData.amount))

	// Check MPRO balance
	if (updaterMPROBalance < amountToUpdate) {
		console.log(
			`❌ [${hre.network.name}] Not enough MPRO balance for the reward`,
		)
		return
	}

	// Check MPRO allowance
	if (stakeMPROAllowance < amountToUpdate) {
		try {
			console.log(
				`[${hre.network.name}] Updating MPRO allowance to ${amountToUpdate}`,
			)
			const tx = await mproToken
				.connect(updaterSigner)
				.increaseAllowance(stakeAddress, amountToUpdate)
			await tx.wait()
		} catch (e: any) {
			console.log(
				`❌ [${hre.network.name}] Not enough MPRO allowance has ${stakeMPROAllowance} and needs ${amountToUpdate}`,
			)
			return
		}
	}

	const STAKERS_CHUNK = 100
	const unstakedStakers = stakersData.stakers.filter(
		(staker: Staker) => !staker?.txHash,
	)

	for (let i = 0; i < unstakedStakers.length; i += STAKERS_CHUNK) {
		const chunkStakers = unstakedStakers.slice(i, i + STAKERS_CHUNK)
		const stakersAddresses = chunkStakers.map(
			(staker: any) => staker.walletAddress,
		)
		const stakersAmounts = chunkStakers.map((staker: any) =>
			ethers.parseEther(String(staker.reward)),
		)

		try {
			const tx = await stakeContarct
				.connect(updaterSigner)
				.updateStakers(stakersAddresses, stakersAmounts)
			await tx.wait()

			const modifiedStakers = stakersData.stakers.map((staker: Staker) => {
				if (stakersAddresses.includes(staker.walletAddress)) {
					staker.txHash = tx.hash
				}
				return staker
			})
			const modifiedDocument = {
				cycleId: stakersData.cycleId,
				stakers: modifiedStakers,
				amount: stakersData.amount,
			}
			const modifiedString = JSON.stringify(modifiedDocument, null, 2)
			fs.writeFileSync(updateStakersCycleFile, modifiedString)
		} catch (e: any) {
			console.log(`❌ [${hre.network.name}] something went wrong: ${e}`)
			return
		}
	}

	const currentStakersData = JSON.parse(
		fs.readFileSync(updateStakersCycleFile, 'utf8'),
	) as StakersData

	const allStakersUpdated = currentStakersData.stakers.every(
		(staker: Staker) => staker.txHash,
	)

	if (allStakersUpdated) {
		console.log(`✅ [${hre.network.name}] All stakers updated`)
		const dbDataToPass: DBStakersData = {
			cycleId: currentStakersData.cycleId,
			rewardDistributionTxHash: args.distributionTx,
			bridgeTxHash: args.bridgeTx,
			stakers: {},
		}
		currentStakersData.stakers.forEach((staker: Staker) => {
			if (staker.txHash) {
				const walletArray = dbDataToPass.stakers[staker.txHash] || []
				dbDataToPass.stakers[staker.txHash] = [
					...walletArray,
					{walletAddress: staker.walletAddress},
				]
			}
		})

		const dbDataString = JSON.stringify(dbDataToPass, null, 2)
		fs.writeFileSync(
			`./manualUpdateStakers/${args.cycleId}_db.json`,
			dbDataString,
		)
	} else {
		console.log(
			`❌ [${hre.network.name}] Not all stakers updated, please run the task again`,
		)
	}
}
