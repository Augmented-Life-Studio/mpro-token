import { ethers } from "hardhat";
import { LZ_ENDPOINTS } from "../constants/layerzeroEndpoints"
import hre from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";
import { JAKANTMasterDistributor } from "../typechain-types";

// npx hardhat deploy --tags JAKANTSource --network goerli

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner, helper } = await getNamedAccounts()

    const accounts = await ethers.getSigners();
    const helperSigner = accounts.find((account) => account.address === helper);

    const MPRO_MASTER_DISTRIBUTOR = owner;
    const TOKEN_NAME = "JAKANTToken";
    const TOKEN_SYMBOL = "JAKANT";

    const { deploy } = deployments
    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name as keyof typeof LZ_ENDPOINTS]

    const mproMasterDistributor = await deploy("JAKANTMasterDistributor", {
        from: deployer,
        args: [helper],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
        contract: "contracts/MPROMasterDistributor.sol:JAKANTMasterDistributor",
    })

    console.log("JAKANTMasterDistributor deployed to:", mproMasterDistributor.address);

    await verifyContractWithRetry("contracts/MPROMasterDistributor.sol:JAKANTMasterDistributor", mproMasterDistributor.address, mproMasterDistributor.args);


    const MproMasterDistributorFactory = await ethers.getContractFactory("contracts/MPROMasterDistributor.sol:JAKANTMasterDistributor")
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
            helper
        ],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
        contract: "contracts/MPRO.sol:JAKANTToken",
    })

    await verifyContractWithRetry("contracts/MPRO.sol:JAKANTToken", mproToken.address, mproToken.args);

    // // Set JakantToken to master distributor
    // await MproMasterDistributor.connect(helperSigner).setJAKANTToken(mproToken.address, { from: helper });
    // // Grant role master distributor to mproMasterDistributor
    // await MproMasterDistributor.connect(helperSigner).grantRole(await MproMasterDistributor.JAKANT_MASTER_DISTRIBUTOR_ROLE(), MPRO_MASTER_DISTRIBUTOR);
    // await MproMasterDistributor.connect(helperSigner).transferOwnership(owner);
}

module.exports.tags = ["JAKANTSource"]
