const CHAIN_ID = require('../constants/chainIdsV1.json')

module.exports = async function (taskArgs: any, hre: any) {
	const {owner} = await hre.getNamedAccounts()

	const helperSigner = await hre.ethers.getSigner(owner)

	const contract = await hre.ethers.getContract(taskArgs.contract)
	const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
	const tx = await contract
		.connect(helperSigner)
		.setMinDstGas(dstChainId, taskArgs.packetType, taskArgs.minGas)

	console.log(`[${hre.network.name}] setMinDstGas tx hash ${tx.hash}`)
	await tx.wait()
}
