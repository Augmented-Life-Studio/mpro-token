import {getDeploymentAddresses} from '../utils/readStatic'
import {MPROAutoStake, MPROMasterDistributor} from '../typechain-types'

module.exports = async function (args: any, hre: any) {
	const {owner} = await hre.getNamedAccounts() // Updated address
	const ownerSigner = await hre.ethers.getSigner(owner)
	const stakeAddress = getDeploymentAddresses(hre.network.name)['MPROAutoStake']

	const stakeContarct = (await hre.ethers.getContractAt(
		'contracts/MPROStake.sol:MPROAutoStake',
		stakeAddress,
	)) as MPROAutoStake

	const tx = await stakeContarct
		.connect(ownerSigner)
		.setUpdaterWhitelisted('0xcb845d8f5ba2728c531ed04f0c8420533bc4f5db', true)

	await tx.wait()
}
