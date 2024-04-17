import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import addresses from "../vestingAddresses/privateBenaficiaries.json"
import { ethers } from "hardhat";

const VESTING_CONTRACT_NAME = "PrivateRoundVesting"

const MPRO_ADDRESS = "0xd88611a629265c9af294ffdd2e7fa4546612273e"
const TGE_UNLOCK_TIMESTAMP = 1713362400 // Wed Apr 17 2024 12:00:00 GMT+0000
const TGE_UNLOCK_PERCENT = 700 // 5%
const CLIFF_DELAY = 5259486 // 2 months
const VESTING_UNLOCK_PERCENT_PER_PERIOD = 930 // 7.91%
const VESTING_PERIOD_DURATION = 2629743 // 1 month

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner } = await getNamedAccounts()

    const { deploy } = deployments

    const vesting = await deploy(VESTING_CONTRACT_NAME, {
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

    console.log(`PrivateRoundVesting ${VESTING_CONTRACT_NAME}  deployed to:`, vesting.address);

    const addrs = addresses.map((el: any) => el.Adress)
    const amounts = addresses.map((el: any) => Number(el.Amount))

    const ves = await ethers.getContractAt(`${VESTING_CONTRACT_NAME}`, vesting.address);

    await ves.registerBeneficiaries(
        addrs,
        amounts,
        { from: owner }
    )
}

module.exports.tags = ["PrivateRoundVesting"]