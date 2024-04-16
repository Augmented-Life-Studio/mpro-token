import CHAIN_ID from '../constants/chainIds.json'
import { getDeploymentAddresses } from '../utils/readStatic'
import { MPRO } from "../typechain-types"
import { ethers } from 'ethers'

const zeroPad = (data: string, length: number): Uint8Array => {
	return ethers.getBytes(ethers.zeroPadValue(data, length), "hex")
}

module.exports = async function (taskArgs: any, hre: any) {
	let localContract, remoteContract
	const { owner, deployer, treasury } = await hre.getNamedAccounts()

	console.log(owner, deployer, treasury, "ownerownerownerownerownerownerownerownerownerowner");

	const helperSigner = await hre.ethers.getSigner(owner)

	if (taskArgs.contract) {
		localContract = taskArgs.contract
		remoteContract = taskArgs.contract
	} else {
		localContract = taskArgs.localContract
		remoteContract = taskArgs.remoteContract
	}

	console.log('localContract:', localContract, helperSigner.address);


	if (!localContract || !remoteContract) {
		console.log(
			'Must pass in contract name OR pass in both localContract name and remoteContract name',
		)
		return
	}

	// get local contract
	const localContractInstance: MPRO = await hre.ethers.getContract(localContract)

	// get deployed remote contract address
	const remoteAddress = getDeploymentAddresses(taskArgs.targetNetwork)[
		remoteContract
	]

	// get remote chain id
	const remoteChainId = CHAIN_ID[taskArgs.targetNetwork as keyof typeof CHAIN_ID]

	const peer = zeroPad(
		remoteAddress, 32
	);

	// check if pathway is already set
	const isTrustedRemoteSet = await localContractInstance.isPeer(
		remoteChainId,
		peer,
	)

	if (!isTrustedRemoteSet) {
		try {
			let tx = await localContractInstance.connect(helperSigner).setPeer(
				remoteChainId,
				peer,
			)

			console.log(tx);

			const transaction = await tx.getTransaction()
			console.log(` tx: ${transaction?.hash}`)
		} catch (e: any) {
			console.log('====================================');
			console.log(e);
			console.log('====================================');
			if (
				e.error.message.includes('The chainId + address is already trusted')
			) {
				console.log('*source already set*')
			} else {
				console.log(
					`❌ [${hre.network.name}] setPeer(${remoteChainId})`,
				)
			}
		}
	} else {
		console.log('*source already set*')
	}
}
