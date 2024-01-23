import { MPROToken } from "../typechain-types"
import CHAIN_ID from '../constants/chainIds.json'

module.exports = async function (taskArgs: any, hre: any) {
    const contract: MPROToken = await hre.ethers.getContract(taskArgs.contract)
    const dstChainId = CHAIN_ID[taskArgs.targetNetwork as keyof typeof CHAIN_ID]
    const tx = await contract.setMinDstGas(dstChainId, taskArgs.packetType, taskArgs.minGas)

    console.log(`[${hre.network.name}] setMinDstGas tx hash ${tx.hash}`)
    await tx.wait()
}
