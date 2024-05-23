import {DeploymentsExtension} from 'hardhat-deploy/dist/types'
import addresses from '../vestingAddresses/airdrop2Beneficiaries.json'
import {ethers} from 'hardhat'

const VESTING_CONTRACT_NAME = 'AirdropVestingTwo'

const MPRO_ADDRESS = '0xd88611a629265c9af294ffdd2e7fa4546612273e'
const TGE_UNLOCK_TIMESTAMP = 1716472800 // Thu May 23 2024 16:00:00 GMT+0200 (Central European Summer Time)
const TGE_UNLOCK_PERCENT = 500 // 5%
const CLIFF_DELAY = 5259486 // 5259486 seconds => 2 months
const VESTING_UNLOCK_PERCENT_PER_PERIOD = 1583 // 31.67%
const VESTING_PERIOD_DURATION = 2629743 // 1 month

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
	})

	console.log(
		`MarketingVesting ${VESTING_CONTRACT_NAME} deployed to:`,
		vesting.address,
	)

	const addrs = addresses.map((el: any) => el.Address)
	const amounts = addresses.map((el: any) =>
		ethers.parseEther(String(el.Amount)),
	)
	const ves = await ethers.getContractAt(
		`${VESTING_CONTRACT_NAME}`,
		vesting.address,
	)

	//  await ves.setVestingToken(MPRO_ADDRESS, {from: deployer})

	const WALLET_CHUNK = 150

	for (let i = 1500; i < addrs.length; i += WALLET_CHUNK) {
		const chunkAddrs = addrs.slice(i, i + WALLET_CHUNK)
		const chunkAmounts = amounts.slice(i, i + WALLET_CHUNK)
		const tx = await ves.registerBeneficiaries(chunkAddrs, chunkAmounts, {
			from: deployer,
		})
		await tx.wait()
		console.log(
			`Registered ${i + chunkAddrs.length}/${
				addrs.length
			} beneficiaries in transaction ${tx.hash}`,
		)
	}

	// Calculate sum to send to Vesting
	const sum = addresses.reduce((acc, val) => acc + val.Amount, 0)
	console.log(`Total amount to send to Vesting: ${sum}`)
}

module.exports.tags = ['AirdropVestingTwo']
