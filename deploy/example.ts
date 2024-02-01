import { ethers } from "hardhat";
import { LZ_ENDPOINTS } from "../constants/layerzeroEndpoints"
import hre from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";
import { JAKANTMasterDistributor } from "../typechain-types";

// npx hardhat deploy --tags EXAMPLE --network goerli

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner, vesting1, vesting2 } = await getNamedAccounts()

    console.log('====================================');
    console.log('deployer', deployer, 'owner', owner, 'vesting1', vesting1, 'vesting2', vesting2);
    console.log('====================================');


}

module.exports.tags = ["EXAMPLE"]
