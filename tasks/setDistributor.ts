import {getDeploymentAddresses} from '../utils/readStatic'
import {MPROMasterDistributor} from '../typechain-types'

module.exports = async function (args: any, hre: any) {
	const {mproDistributor} = await hre.getNamedAccounts() // Updated address
	const ownerSigner = await hre.ethers.getSigner(mproDistributor)
	const masterDistributorAddress = getDeploymentAddresses(hre.network.name)[
		'MPROMasterDistributor'
	]

	const masterDistributor = (await hre.ethers.getContractAt(
		'contracts/MPROMasterDistributor.sol:MPROMasterDistributor',
		masterDistributorAddress,
	)) as MPROMasterDistributor

	const distributorRole = await masterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE()

	const tx = await masterDistributor
		.connect(ownerSigner)
		.grantRole(distributorRole, '0xcb845d8f5bA2728C531ed04F0c8420533bc4f5db')

	await tx.wait()

	const mproDistributorRole = await masterDistributor.isDistributor(
		'0xcb845d8f5bA2728C531ed04F0c8420533bc4f5db',
	)

	if (mproDistributorRole) {
		console.log('Distributor role set successfully')
	}
}
