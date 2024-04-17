import { MPROVesting } from '../typechain-types';

module.exports = async function (taskArgs: any, hre: any) {
    const { owner } = await hre.getNamedAccounts()

    const ownerSigner = await hre.ethers.getSigner(owner)

    let localContract

    if (taskArgs.contract) {
        localContract = taskArgs.contract
    }

    if (!localContract) {
        console.log("Must pass in contract name OR pass in both localContract name and remoteContract name")
        return
    }

    // get local contract
    const localContractInstance = await hre.ethers.getContract(localContract) as MPROVesting
    // const remoteContractInstance = await hre.ethers.getContract(remoteContract) as MPRO

    try {
        const beneficiaries = await (
            await localContractInstance.connect(ownerSigner).getBeneficiaries()
        )
        console.log('====================================');
        console.log(beneficiaries);
        console.log('====================================');
    } catch (error) {
        console.log('====================================');
        console.log(error);
        console.log('====================================');
    }
}
