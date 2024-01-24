import { ethers } from "hardhat";
import { LZ_ENDPOINTS } from "../constants/layerzeroEndpoints"
import hre from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";
import { MPROMasterDistributor } from "../typechain-types";

// npx hardhat deploy --tags MPROToken --network bsc-testnet

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner } = await getNamedAccounts()

    const TOKEN_NAME = "MPROToken";
    const TOKEN_SYMBOL = "MPRO";

    const { deploy } = deployments
    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

    const mproMasterDistributor = await deploy("MPROMasterDistributor", {
        from: deployer,
        args: [owner],
        log: true,
        waitConfirmations: 1,
    })

    console.log("MPROMasterDistributor deployed to:", mproMasterDistributor.address);

    await verifyContractWithRetry("MPROMasterDistributor", mproMasterDistributor.address, mproMasterDistributor.args);

    const mproToken = await deploy("MPROToken", {
        from: deployer,
        args: [
            TOKEN_NAME,
            TOKEN_SYMBOL,
            [deployer], // Premint addresses
            [ethers.parseEther("100")], // Premint values
            lzEndpointAddress, // LayerZero Endpoint
            mproMasterDistributor.address,
            owner
        ],
        log: true,
        waitConfirmations: 1,
    })

    console.log("MPROToken deployed to:", mproToken);

    await verifyContractWithRetry("MPROToken", mproToken.address, mproToken.args);
}

module.exports.tags = ["MPROToken"]
