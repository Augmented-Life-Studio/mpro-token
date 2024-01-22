import { ethers } from "hardhat";
import { LZ_ENDPOINTS } from "../constants/layerzeroEndpoints"
import hre from "hardhat";
import { Deployment, DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { MPROMasterDistributor, MPRORoleManager } from "../typechain-types";

// npx hardhat deploy --tags MPROToken --network bsc-testnet

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer } = await getNamedAccounts()

    const MPRO_MASTER_DISTRIBUTOR = deployer;
    const TOKEN_NAME = "MPROToken";
    const TOKEN_SYMBOL = "MPRO";

    const { deploy } = deployments
    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]


    const mproRoleManager = await deploy("MPRORoleManager", {
        from: deployer,
        args: [deployer],
        log: true,
        waitConfirmations: 1,
    })

    const MproRoleManagerFactory = await ethers.getContractFactory("MPRORoleManager")
    const MproRoleManager = await MproRoleManagerFactory.attach(mproRoleManager.address) as MPRORoleManager;

    console.log("MPRORoleManager deployed to:", mproRoleManager.address);

    await verifyContractWithRetry("MPRORoleManager", mproRoleManager.address, mproRoleManager.args);


    const mproMasterDistributor = await deploy("MPROMasterDistributor", {
        from: deployer,
        args: [deployer, mproRoleManager.address],
        log: true,
        waitConfirmations: 1,
    })

    const MproMasterDistributorFactory = await ethers.getContractFactory("MPROMasterDistributor")
    const MproMasterDistributor = await MproMasterDistributorFactory.attach(mproMasterDistributor.address) as MPROMasterDistributor;

    console.log("MPROMasterDistributor deployed to:", mproMasterDistributor.address);

    await verifyContractWithRetry("MPROMasterDistributor", mproMasterDistributor.address, mproMasterDistributor.args);

    // Grant role master distributor to mproMasterDistributor
    await MproMasterDistributor.grantRole(await MproMasterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE(), MPRO_MASTER_DISTRIBUTOR);

    // Grant role distributor to mproMasterDistributor
    await MproRoleManager.grantRole(await MproRoleManager.DISTRIBUTOR_ROLE(), mproMasterDistributor.address);



    const mproToken = await deploy("MPROToken", {
        from: deployer,
        args: [
            TOKEN_NAME,
            TOKEN_SYMBOL,
            [deployer], // Premint addresses
            [ethers.parseEther("100")], // Premint values
            lzEndpointAddress, // LayerZero Endpoint
            mproRoleManager.address,
            mproMasterDistributor.address
        ],
        log: true,
        waitConfirmations: 1,
    })

    console.log("MPROToken deployed to:", mproToken);

    await verifyContractWithRetry("MPROToken", mproToken.address, mproToken.args);
}

module.exports.tags = ["MPROToken"]
