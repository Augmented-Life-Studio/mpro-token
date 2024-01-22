import hre from "hardhat";

export async function verifyContractWithRetry(contract: string, contractAddress: string, constructorArguments: any, retries = 3, delay = 5000) {
    console.log("Verifying contract", contractAddress, contract)
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await hre!.run("verify:verify", {
                // contract: contract,
                address: contractAddress,
                constructorArguments: constructorArguments,
            })
            console.log("Verification successful", response)
            return response
        } catch (error: any) {
            console.error(`Verification failed on attempt ${attempt}:`, error?.message)
            if (attempt < retries) {
                console.log(`Retrying after ${delay}ms...`)
                await new Promise((resolve) => setTimeout(resolve, delay))
            }
            return error
        }
    }
    console.log("Verification failed after all attempts")
}