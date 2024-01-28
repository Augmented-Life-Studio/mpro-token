import CHAIN_ID from '../constants/chainIds.json'
import { getDeploymentAddresses } from '../utils/readStatic'
import { JAKANTToken } from "../typechain-types"
import { ethers } from 'ethers'

module.exports = async function (taskArgs: any, hre: any) {
	let localContract, remoteContract

	if (taskArgs.contract) {
		localContract = taskArgs.contract
		remoteContract = taskArgs.contract
	} else {
		localContract = taskArgs.localContract
		remoteContract = taskArgs.remoteContract
	}

	if (!localContract || !remoteContract) {
		console.log(
			'Must pass in contract name OR pass in both localContract name and remoteContract name',
		)
		return
	}

	// get local contract
	const localContractInstance: JAKANTToken = await hre.ethers.getContract(localContract)

	// get deployed remote contract address
	const remoteAddress = getDeploymentAddresses(taskArgs.targetNetwork)[
		remoteContract
	]

	// get remote chain id
	const remoteChainId = CHAIN_ID[taskArgs.targetNetwork as keyof typeof CHAIN_ID]

	// concat remote and local address
	let remoteAndLocal = ethers.solidityPacked(
		['address', 'address'],
		[remoteAddress, localContractInstance.target],
	)

	// check if pathway is already set
	const isTrustedRemoteSet = await localContractInstance.isTrustedRemote(
		remoteChainId,
		remoteAndLocal,
	)

	if (!isTrustedRemoteSet) {
		try {
			let tx = await (
				await localContractInstance.setTrustedRemote(
					remoteChainId,
					remoteAndLocal,
				)
			).wait()
			console.log(
				`✅ [${hre.network.name}] setTrustedRemote(${remoteChainId}, ${remoteAndLocal})`,
			)
			console.log(` tx: ${tx?.hash}`)
		} catch (e: any) {
			if (
				e.error.message.includes('The chainId + address is already trusted')
			) {
				console.log('*source already set*')
			} else {
				console.log(
					`❌ [${hre.network.name}] setTrustedRemote(${remoteChainId}, ${remoteAndLocal})`,
				)
			}
		}
	} else {
		console.log('*source already set*')
	}
}
