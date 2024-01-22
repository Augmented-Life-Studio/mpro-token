const path = require("path")
const fs = require("fs")

export function getDeploymentAddresses(networkName: string) {
    const PROJECT_ROOT = path.resolve(__dirname, "..")
    const DEPLOYMENT_PATH = path.resolve(PROJECT_ROOT, "deployments")

    let folderName = networkName
    if (networkName === "hardhat") {
        folderName = "localhost"
    }

    let rtnAddresses: { [key: string]: string } = {}
    const networkFolderPath = path.resolve(DEPLOYMENT_PATH, folderName)
    const files = fs.readdirSync(networkFolderPath).filter((f: string) => f.includes(".json"))
    files.forEach((file: string) => {
        const filepath = path.resolve(networkFolderPath, file)
        const data = JSON.parse(fs.readFileSync(filepath))
        const contractName = file.split(".")[0]
        rtnAddresses[contractName] = data.address
    })

    return rtnAddresses
}