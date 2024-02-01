import { ethers } from "hardhat";
import { LZ_ENDPOINTS } from "../constants/layerzeroEndpoints"
import hre from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";
import { JAKANTMasterDistributor } from "../typechain-types";

// npx hardhat deploy --tags JAKANTToken --network goerli

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner } = await getNamedAccounts()

    const MPRO_MASTER_DISTRIBUTOR = owner;
    const TOKEN_NAME = "JAKANTToken";
    const TOKEN_SYMBOL = "JAKANT";

    const { deploy } = deployments
    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

    const mproMasterDistributor = await deploy("JAKANTMasterDistributor", {
        from: deployer,
        args: [deployer],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
    })

    console.log("JAKANTMasterDistributor deployed to:", mproMasterDistributor.address);

    await verifyContractWithRetry("contracts/MPROMasterDistributor.sol:JAKANTMasterDistributor", mproMasterDistributor.address, mproMasterDistributor.args);


    const MproMasterDistributorFactory = await ethers.getContractFactory("JAKANTMasterDistributor")
    const MproMasterDistributor = await MproMasterDistributorFactory.attach(mproMasterDistributor.address) as JAKANTMasterDistributor;

    const mproToken = await deploy("JAKANTToken", {
        from: deployer,
        args: [
            TOKEN_NAME,
            TOKEN_SYMBOL,
            [deployer, owner], // Premint addresses
            [ethers.parseEther("1000000"), ethers.parseEther("1000000")], // Premint values
            lzEndpointAddress, // LayerZero Endpoint
            mproMasterDistributor.address,
            deployer
        ],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
    })

    await verifyContractWithRetry("contracts/MPROtoken.sol:JAKANTToken", mproToken.address, mproToken.args);

    // Set JakantToken to master distributor
    await MproMasterDistributor.setJAKANTToken(mproToken.address);
    // Grant role master distributor to mproMasterDistributor
    await MproMasterDistributor.grantRole(await MproMasterDistributor.JAKANT_MASTER_DISTRIBUTOR_ROLE(), MPRO_MASTER_DISTRIBUTOR);
    await MproMasterDistributor.transferOwnership(owner);

}

module.exports.tags = ["JAKANTToken"]
