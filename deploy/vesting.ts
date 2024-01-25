
import { ethers } from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";

// npx hardhat deploy --tags MPROVesting --network bsc-testnet

const MPRO_ADDRESS = ""
const TGE_UNLOCK_TIMESTAMP = 0
const TGE_UNLOCK_PERCENT = 0
const CLIFF_DELAY = 0
const VESTING_UNLOCK_PERCENT_PER_PERIOD = 0
const VESTING_PERIOD_DURATION = 0

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner } = await getNamedAccounts()

    const { deploy } = deployments

    const vesting = await deploy("MPROVesting", {
        from: deployer,
        args: [
            MPRO_ADDRESS,
            TGE_UNLOCK_TIMESTAMP,
            TGE_UNLOCK_PERCENT,
            CLIFF_DELAY,
            VESTING_UNLOCK_PERCENT_PER_PERIOD,
            VESTING_PERIOD_DURATION,
            owner
        ],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true
    })

    console.log("MPROVesting deployed to:", vesting.address);

    await verifyContractWithRetry("contracts/MPROVesting.sol:MPROVesting", vesting.address, vesting.args);
}

module.exports.tags = ["MPROVesting"]