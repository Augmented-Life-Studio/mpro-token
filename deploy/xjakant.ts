
import { ethers } from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";

// npx hardhat deploy --tags XJAKANT --network bsc-testnet

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner } = await getNamedAccounts()

    const { deploy } = deployments

    const erc20 = await deploy("XJAKANT", {
        from: deployer,
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true
    })

    console.log("XJAKANT deployed to:", erc20.address);

    await verifyContractWithRetry("contracts/mocks/XJAKANT.sol:XJAKANT", erc20.address, erc20.args);
}

module.exports.tags = ["XJAKANT"]