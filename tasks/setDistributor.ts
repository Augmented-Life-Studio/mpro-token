import {getDeploymentAddresses} from '../utils/readStatic'
import {MPROMasterDistributor} from '../typechain-types'

module.exports = async function (args: any, hre: any) {
	const {owner} = await hre.getNamedAccounts() // Updated address
	const ownerSigner = await hre.ethers.getSigner(owner)
	const masterDistributorAddress = getDeploymentAddresses(hre.network.name)[
		'MPROMasterDistributor'
	]

	const masterDistributor = (await hre.ethers.getContractAt(
		'contracts/MPROMasterDistributor.sol:MPROMasterDistributor',
		masterDistributorAddress,
	)) as MPROMasterDistributor

	const distributorRole = await masterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE()

	const txRevoke = await masterDistributor.revokeRole(
		distributorRole,
		'0x6eE701DE9e3d118c0553Ff45f84179614eb31161',
	)

	await txRevoke.wait()

	const txGrant = await masterDistributor
		.connect(ownerSigner)
		.grantRole(distributorRole, '0xcb845d8f5bA2728C531ed04F0c8420533bc4f5db')

	await txGrant.wait()

	const mproDistributorRole = await masterDistributor.isDistributor(
		'0xcb845d8f5bA2728C531ed04F0c8420533bc4f5db',
	)

	if (mproDistributorRole) {
		console.log('Distributor role set successfully')
	}
}
