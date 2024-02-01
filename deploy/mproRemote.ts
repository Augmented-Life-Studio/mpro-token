import { ethers } from "hardhat";
import { LZ_ENDPOINTS } from "../constants/layerzeroEndpoints"
import hre from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";
import { JAKANTMasterDistributor } from "../typechain-types";

// npx hardhat deploy --tags JAKANTRemote --network bsc-testnet

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner } = await getNamedAccounts()

    const TOKEN_NAME = "JAKANTToken";
    const TOKEN_SYMBOL = "JAKANT";

    const { deploy } = deployments
    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

    const mproMasterDistributor = await deploy("JAKANTMasterDistributorLight", {
        from: deployer,
        args: [owner],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
        contract: "contracts/MPROMasterDistributorLight.sol:JAKANTMasterDistributor",
    })

    console.log("JAKANTMasterDistributor deployed to:", mproMasterDistributor.address);

    await verifyContractWithRetry("contracts/MPROMasterDistributorLight.sol:JAKANTMasterDistributor", mproMasterDistributor.address, mproMasterDistributor.args);

    const mproToken = await deploy("JAKANTTokenLight", {
        from: deployer,
        args: [
            TOKEN_NAME,
            TOKEN_SYMBOL,
            lzEndpointAddress, // LayerZero Endpoint
            mproMasterDistributor.address,
            owner
        ],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
        contract: "contracts/MPROLight.sol:JAKANTToken",
    })

    console.log("MPJAKANTTokenRO deployed to:", mproToken);

    await verifyContractWithRetry("contracts/MPROLight.sol:JAKANTToken", mproToken.address, mproToken.args);
}

module.exports.tags = ["JAKANTRemote"]
