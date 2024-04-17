import { ethers } from "hardhat";
import { LZ_ENDPOINTS } from "../constants/layerzeroEndpoints"
import hre from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";

// npx hardhat deploy --tags MPROSource --network ethereum

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner, treasury } = await getNamedAccounts()

    const TOKEN_NAME = "MPRO";
    const TOKEN_SYMBOL = "MPRO";

    const { deploy } = deployments
    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

    const mproMasterDistributor = await deploy("MPROMasterDistributor", {
        from: deployer,
        args: [owner],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
        contract: "contracts/MPROMasterDistributor.sol:MPROMasterDistributor"
    })

    console.log("MPROMasterDistributor deployed to:", mproMasterDistributor.address);

    await verifyContractWithRetry("contracts/MPROMasterDistributor.sol:MPROMasterDistributor", mproMasterDistributor.address, mproMasterDistributor.args);

    const mproToken = await deploy("MPRO", {
        from: deployer,
        args: [
            TOKEN_NAME,
            TOKEN_SYMBOL,
            [treasury], // Premint addresses
            [ethers.parseEther("246880158")], // Premint values
            lzEndpointAddress, // LayerZero Endpoint
            mproMasterDistributor.address,
            owner
        ],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
        contract: "contracts/MPRO.sol:MPRO"
    })

    console.log("MPRO deployed to:", mproToken);

    await verifyContractWithRetry("contracts/MPRO.sol:MPRO", mproToken.address, mproToken.args);
}

module.exports.tags = ["MPROSource"]
