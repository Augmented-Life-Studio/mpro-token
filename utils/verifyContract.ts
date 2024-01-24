import hre from "hardhat";

export async function verifyContractWithRetry(contract: string, contractAddress: string, constructorArguments: any, retries = 3, delay = 5000) {
    console.log("Verifying contract", contractAddress, contract)
    let attempt = 1, success = false
    do {
        try {
            const response = await hre!.run("verify:verify", {
                address: contractAddress,
                constructorArguments: constructorArguments,
            })
            console.log("Verification successful", response)
            success = true
            return response
        } catch (error: any) {
            console.error(`Verification failed on attempt ${attempt}:`, error?.message)
            console.log(`Retrying after ${delay}ms...`)
            attempt++
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    } while (attempt <= retries && !success);
    console.log("Verification failed after all attempts")
}