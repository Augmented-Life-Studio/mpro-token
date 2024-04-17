
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import addresses from "../vestingAddresses/marketingBenaficiaries.json"
import { ethers } from "hardhat";

const VESTING_CONTRACT_NAME = "MarketingVesting"

const MPRO_ADDRESS = "0xd88611a629265c9af294ffdd2e7fa4546612273e"
const TGE_UNLOCK_TIMESTAMP = 1713362400 // Wed Apr 17 2024 12:00:00 GMT+0000
const TGE_UNLOCK_PERCENT = 500 // 5%
const CLIFF_DELAY = 0 // 0 seconds
const VESTING_UNLOCK_PERCENT_PER_PERIOD = 396 // 7.91%
const VESTING_PERIOD_DURATION = 2629743 // 1 month

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer } = await getNamedAccounts()

    const { deploy } = deployments

    const vesting = await deploy(VESTING_CONTRACT_NAME, {
        from: deployer,
        args: [
            TGE_UNLOCK_TIMESTAMP,
            TGE_UNLOCK_PERCENT,
            CLIFF_DELAY,
            VESTING_UNLOCK_PERCENT_PER_PERIOD,
            VESTING_PERIOD_DURATION,
            deployer
        ],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true
    })

    console.log(`MarketingVesting ${VESTING_CONTRACT_NAME} deployed to:`, vesting.address);

    const addrs = addresses.map((el: any) => el.Adress)
    const amounts = addresses.map((el: any) => Number(el.Amount))
    const ves = await ethers.getContractAt(`${VESTING_CONTRACT_NAME}`, vesting.address);

    await ves.setVestingToken(MPRO_ADDRESS, { from: deployer })

    await ves.registerBeneficiaries(
        addrs,
        amounts,
        { from: deployer }
    )
}

module.exports.tags = ["MarketingVesting"]