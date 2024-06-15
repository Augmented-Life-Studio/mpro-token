import {ethers} from 'ethers'
const fs = require('fs')
const CHAIN_ID = require('../constants/chainIds.json')
import {getDeploymentAddresses} from '../utils/readStatic'
import {MPRO, MPROMasterDistributor} from '../typechain-types'
import {Options} from '@layerzerolabs/lz-v2-utilities'
import {SendParamStruct} from '../typechain-types/contracts/MPRO.sol/MPRO'

const zeroPad = (data: string, length: number): Uint8Array => {
	return ethers.getBytes(ethers.zeroPadValue(data, length), 'hex')
}
const zero = ethers.toBigInt(0)

const createSendParams = (
	chainId: number,
	receiver: string,
	quantity: bigint,
): SendParamStruct => {
	let zeroPadReceiver = zeroPad(receiver, 32)
	const options = Options.newOptions()
		.addExecutorLzReceiveOption(200000, 0)
		.toHex()
		.toString()

	const sendParam = [
		chainId,
		zeroPadReceiver,
		quantity,
		quantity,
		options,
		'0x',
		'0x',
	] as unknown as SendParamStruct
	return sendParam
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
	const updateStakersCycleData = JSON.parse(
		fs.readFileSync(updateStakersCycleFile, 'utf8'),
	) as DBStakersData
	const {mproDistributor} = await hre.getNamedAccounts() // Updated address
	const ownerSigner = await hre.ethers.getSigner(mproDistributor)
	const masterDistributorAddress = getDeploymentAddresses(hre.network.name)[
		'MPROMasterDistributor'
	]
	const mproAddress = getDeploymentAddresses(hre.network.name)['MPRO']

	const masterDistributor = (await hre.ethers.getContractAt(
		'contracts/MPROMasterDistributor.sol:MPROMasterDistributor',
		masterDistributorAddress,
	)) as MPROMasterDistributor

	const mproToken = (await hre.ethers.getContractAt(
		'contracts/MPROLight.sol:MPRO',
		mproAddress,
	)) as MPRO

	const mproDistributorRole = await masterDistributor.isDistributor(
		mproDistributor,
	)

	if (!mproDistributorRole) {
		console.log(
			`❌ [${hre.network.name}] walles is not a distributor for MPROMasterDistributor contract. Please add the wallet as a distributor first.`,
		)
		return
	}

	const bigIntAmount = BigInt(args.amount)

	// get remote chain id
	const remoteChainId = CHAIN_ID.base

	// quote fee with default adapterParams
	const sendParams = createSendParams(
		remoteChainId,
		mproDistributor,
		bigIntAmount,
	)

	let [nativeFee] = await mproToken.quoteSend(sendParams, false)

	console.log(
		`fees[0] (wei): ${nativeFee} / (eth): ${ethers.formatEther(nativeFee)}`,
	)

	const txDistribution = await masterDistributor
		.connect(ownerSigner)
		.distribute(mproDistributor, bigIntAmount)

	await txDistribution.wait()

	// Bridge tokens
	const txBridge = await mproToken
		.connect(ownerSigner)
		.send(sendParams, [nativeFee, zero] as any, mproDistributor, {
			value: nativeFee,
		})

	await txBridge.wait()

	console.log(
		`✅ [${hre.network.name}] Successfully distributed ${args.amount} MPRO tokens and bridged to ${remoteChainId} chain. Distribution tx hash: ${txDistribution.hash} Bridge tx hash: ${txBridge.hash}`,
	)

	const dbDataToPass: DBStakersData = {
		...updateStakersCycleData,
		rewardDistributionTxHash: txDistribution.hash,
		bridgeTxHash: txBridge.hash,
	}

	const dbDataString = JSON.stringify(dbDataToPass, null, 2)

	fs.writeFileSync(`./manualUpdateStakers/${args.cycleId}.json`, dbDataString)
}
