import {ethers} from 'ethers'
const CHAIN_ID = require('../constants/chainIdsV1.json')

module.exports = async function (taskArgs: any, hre: any) {
	const {owner} = await hre.getNamedAccounts()

	const helperSigner = await hre.ethers.getSigner(owner)

	let toAddress = owner
	let qty = ethers.parseEther(taskArgs.qty)

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

	// get remote chain id
	const remoteChainId = CHAIN_ID[taskArgs.targetNetwork]

	// get local contract
	const localContractInstance = await hre.ethers.getContract(localContract)

	// quote fee with default adapterParams
	let adapterParams = ethers.solidityPacked(['uint16', 'uint256'], [1, 200000]) // default adapterParams example

	let fees = await localContractInstance.estimateSendFee(
		remoteChainId,
		toAddress,
		qty,
		false,
		adapterParams,
	)
	console.log(
		`fees[0] (wei): ${fees[0]} / (eth): ${ethers.formatEther(fees[0])}`,
	)

	let tx = await (
		await localContractInstance.connect(helperSigner).sendFrom(
			owner, // 'from' address to send tokens
			remoteChainId, // remote LayerZero chainId
			toAddress, // 'to' address to send tokens
			qty, // amount of tokens to send (in wei)
			owner, // refund address (if too much message fee is sent, it gets refunded)
			ethers.ZeroAddress, // address(0x0) if not paying in ZRO (LayerZero Token)
			'0x', // flexible bytes array to indicate messaging adapter services
			{value: fees[0]},
		)
	).wait()
	console.log(
		`✅ Message Sent [${hre.network.name}] sendTokens() to OFT @ LZ chainId[${remoteChainId}] token:[${toAddress}]`,
	)
	console.log(` tx: ${tx.transactionHash}`)
	console.log(
		`* check your address [${owner.address}] on the destination chain, in the ERC20 transaction tab !"`,
	)
}
