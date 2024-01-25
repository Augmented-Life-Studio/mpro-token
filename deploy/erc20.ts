
import { ethers } from "hardhat";
import { DeploymentsExtension } from "hardhat-deploy/dist/types";
import { verifyContractWithRetry } from "../utils/verifyContract";

// npx hardhat deploy --tags ERC20 --network bsc-testnet

module.exports = async function ({ deployments, getNamedAccounts }: {
    deployments: DeploymentsExtension, getNamedAccounts: any
}) {
    const { deployer, owner } = await getNamedAccounts()

    const TOKEN_NAME = "WhoaToken";
    const TOKEN_SYMBOL = "WHOA";

    const { deploy } = deployments

    const erc20 = await deploy("WhoaToken", {
        from: deployer,
        args: [
            TOKEN_NAME,
            TOKEN_SYMBOL,
            ethers.parseUnits("99999999999999"),
            owner
        ],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true
    })

    console.log("WhoaToken deployed to:", erc20.address);

    await verifyContractWithRetry("contracts/mocks/ERC20.sol:WhoaToken", erc20.address, erc20.args);
}

module.exports.tags = ["ERC20"]