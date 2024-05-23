import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import addresses from '../vestingAddresses/testBeneficiaries.json'
import {ethers} from 'hardhat'
import {verifyContractWithRetry} from '../utils/verifyContract'

const VESTING_CONTRACT_NAME = 'TestVesting'

// MPRO Base-sepolia 0xbf31DE649bA7AC79e92FEe4171B16c84B7c352A0
// MPRO Ethereum-sepolia 0xeEB8395dAb6456C2272B0A7f6A7D32EC988A122C

const MPRO_ADDRESS = '0xeEB8395dAb6456C2272B0A7f6A7D32EC988A122C'
const TGE_UNLOCK_TIMESTAMP = 1716455089 // Thu May 23 2024 16:00:00 GMT+0200 (Central European Summer Time)
const TGE_UNLOCK_PERCENT = 4000 // 5%
const CLIFF_DELAY = 3600 // 2629743 seconds => 1 month
const VESTING_UNLOCK_PERCENT_PER_PERIOD = 1000 // 31.67%
const VESTING_PERIOD_DURATION = 3600 // 1 month

module.exports = async function ({
	deployments,
	getNamedAccounts,
}: {
	deployments: DeploymentsExtension
	getNamedAccounts: any
}) {
	const {deployer} = await getNamedAccounts()

	const {deploy} = deployments

	const vesting = await deploy(VESTING_CONTRACT_NAME, {
		from: deployer,
		args: [
			TGE_UNLOCK_TIMESTAMP,
			TGE_UNLOCK_PERCENT,
			CLIFF_DELAY,
			VESTING_UNLOCK_PERCENT_PER_PERIOD,
			VESTING_PERIOD_DURATION,
			deployer,
		],
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true,
		contract: `contracts/tests/MPROVesting.sol:${VESTING_CONTRACT_NAME}`,
	})

	console.log(`${VESTING_CONTRACT_NAME} deployed to:`, vesting.address)

	// await verifyContractWithRetry(
	// 	'contracts/tests/MPROVesting.sol:TestVesting',
	// 	vesting.address,
	// 	vesting.args,
	// )

	const addrs = addresses.map((el: any) => el.Address)
	const amounts = addresses.map((el: any) =>
		ethers.parseEther(String(el.Amount)),
	)
	const ves = await ethers.getContractAt(
		`${VESTING_CONTRACT_NAME}`,
		vesting.address,
	)

	// await ves.setVestingToken(MPRO_ADDRESS, {from: deployer})

	const tx = await ves.registerBeneficiaries(addrs, amounts, {from: deployer})
	console.log(tx)
}

module.exports.tags = ['TestVesting']
