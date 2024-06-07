import CHAIN_ID from '../constants/chainIds.json'
import {getDeploymentAddresses} from '../utils/readStatic'
import {MPRO, MPROMasterDistributor} from '../typechain-types'
import {ethers} from 'ethers'

const zeroPad = (data: string, length: number): Uint8Array => {
	return ethers.getBytes(ethers.zeroPadValue(data, length), 'hex')
}

module.exports = async function (taskArgs: any, hre: any) {
	const {owner} = await hre.getNamedAccounts()

	const helperSigner = await hre.ethers.getSigner(owner)

	const masterDistributor = await hre.ethers.getContractAt(
		'contracts/MPROMasterDistributor.sol:MPROMasterDistributor',
		'0xaa497b94fdf865c8c7bb9e548bf90d15b78b005f',
	)

	const lister = await masterDistributor.owner()

	// await masterDistributor.grantRole(lister, owner)

	console.log('====================================')
	console.log(lister)
	console.log('====================================')
}
