
import { ethers } from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";
import { JAKPUMPKIN } from "../typechain-types";

// npx hardhat deploy --tags JAKPUMPKIN --network bsc-testnet

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner } = await getNamedAccounts()

    const { deploy } = deployments

    const erc20 = await deploy("JAKPUMPKIN", {
        from: deployer,
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true
    })


    await verifyContractWithRetry("contracts/mocks/JAKPUMPKIN.sol:JAKPUMPKIN", erc20.address, erc20.args);

    const JAKPUMPKINFactory = await ethers.getContractFactory("JAKPUMPKIN")
    const JAKPUMPKIN = await JAKPUMPKINFactory.attach(erc20.address) as JAKPUMPKIN;

    // await JAKPUMPKIN.increaseAllowance(deployer, ethers.parseEther("100"))

    // await JAKPUMPKIN.transferFrom(deployer, deployer, 1)

}

module.exports.tags = ["JAKPUMPKIN"]