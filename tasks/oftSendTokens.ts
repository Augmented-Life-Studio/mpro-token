const CHAIN_ID = require("../constants/chainIds.json")
import { ethers } from 'ethers'
import { MPRO } from '../typechain-types';
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { SendParamStruct } from "../typechain-types/contracts/MPRO.sol/MPRO";

const zeroPad = (data: string, length: number): Uint8Array => {
    return ethers.getBytes(ethers.zeroPadValue(data, length), "hex")
}
const zero = ethers.toBigInt(0);

const createSendParams = (chainId: number, receiver: string, quantity: bigint): SendParamStruct => {
    let localReceiver = zeroPad(receiver, 32);
    if (receiver === "x0123") {
        localReceiver === Uint8Array.from([]);
    }
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

    const sendParam = [
        chainId,
        localReceiver,
        quantity,
        quantity,
        options,
        '0x',
        '0x',
    ] as unknown as SendParamStruct;
    return sendParam;
}

module.exports = async function (taskArgs: any, hre: any) {
    let fromSigner = await hre.ethers.getSigner(taskArgs.fromAddress)

    let toAddress = taskArgs.toAddress

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
        console.log("Must pass in contract name OR pass in both localContract name and remoteContract name")
        return
    }

    // get remote chain id
    const remoteChainId = CHAIN_ID[taskArgs.targetNetwork]

    // get local contract
    const localContractInstance = await hre.ethers.getContract(localContract) as MPRO
    // const remoteContractInstance = await hre.ethers.getContract(remoteContract) as MPRO

    // quote fee with default adapterParams
    const sendParams = createSendParams(remoteChainId, toAddress, qty);

    let [nativeFee] = await localContractInstance.quoteSend(sendParams, false)
    console.log(`fees[0] (wei): ${nativeFee} / (eth): ${ethers.formatEther(nativeFee)}`)

    try {
        let tx = await (
            await localContractInstance.connect(fromSigner).send(
                sendParams,
                [nativeFee, zero] as any,
                taskArgs.fromAddress,
                { value: nativeFee }
            )
        ).wait()
        const localTotalSupply = await localContractInstance.totalSupply();
        console.log("Supply on local chain: ", localTotalSupply);
        // const remoteTotalSupply = await remoteContractInstance.totalSupply();
        // console.log("Supply on remote chain: ", remoteTotalSupply);

        console.log(`✅ Message Sent [${hre.network.name}] send() to OFT @ LZ chainId[${remoteChainId}] token:[${remoteContract}]`)
        console.log(` tx: ${tx?.hash}`)
        console.log(`* check your address [${toAddress}] on the destination chain, in the ERC20 transaction tab !"`)
    } catch (error) {
        console.log('====================================');
        console.log(error);
        console.log('====================================');
    }
}
