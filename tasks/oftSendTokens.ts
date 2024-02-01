const CHAIN_ID = require("../constants/chainIds.json")
import { ethers } from 'ethers'
import { JAKANTToken } from '../typechain-types';

module.exports = async function (taskArgs: any, hre: any) {
    const { helper } = await hre.getNamedAccounts()

    let toAddress = helper
    let qty = ethers.parseEther(taskArgs.qty)

    const helperSigner = await hre.ethers.getSigner(helper)

    let localContract, remoteContract

    if (taskArgs.contract) {
        localContract = taskArgs.contract
        remoteContract = taskArgs.contract
    } else {
        localContract = taskArgs.localContract
        remoteContract = taskArgs.remoteContract
    }

    if (!localContract || !remoteContract) {
        console.log("Must pass in contract name OR pass in both localContract name and remoteContract name")
        return
    }

    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    let toAddressBytes = abiCoder.encode(["address"], [toAddress])

    // get remote chain id
    const remoteChainId = CHAIN_ID[taskArgs.targetNetwork]

    // get local contract
    const localContractInstance = await hre.ethers.getContract(localContract) as JAKANTToken

    // quote fee with default adapterParams
    let adapterParams = ethers.solidityPacked(["uint16", "uint256"], [1, 200000]) // default adapterParams example

    let fees = await localContractInstance.estimateSendFee(remoteChainId, toAddressBytes, qty, false, "0x")
    console.log(`fees[0] (wei): ${fees[0]} / (eth): ${ethers.formatEther(fees[0])}`)

    let tx = await (
        await localContractInstance.connect(helperSigner).sendFrom(
            helper, // 'from' address to send tokens
            remoteChainId, // remote LayerZero chainId
            toAddressBytes, // 'to' address to send tokens
            qty, // amount of tokens to send (in wei)
            {
                refundAddress: helper,
                zroPaymentAddress: ethers.ZeroAddress,
                adapterParams,
            },
            { value: fees[0] }
        )
    ).wait()
    console.log(`✅ Message Sent [${hre.network.name}] sendTokens() to OFT @ LZ chainId[${remoteChainId}] token:[${remoteContract}]`)
    console.log(` tx: ${tx?.hash}`)
    console.log(`* check your address [${helperSigner.address}] on the destination chain, in the ERC20 transaction tab !"`)
}
