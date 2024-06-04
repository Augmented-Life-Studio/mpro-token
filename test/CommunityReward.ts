import {expect} from 'chai'
import {ethers, network} from 'hardhat'
import {HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers'
import {mine} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {BigNumber} from '@ethersproject/bignumber'
import {
	CommunityReward,
	CommunityReward__factory,
	ERC20,
	MPRORewardStake,
	MPRORewardStake__factory,
	MPROStake__factory,
	MPROTest,
	MPROTest__factory,
	WhoaToken,
	WhoaToken__factory,
} from '../typechain-types'

// npx hardhat test test/CommunityReward.ts

async function mineBlocks(n: number) {
	for (let i = 0; i < n; i++) {
		await network.provider.send('evm_mine')
	}
}

const ONE_DAY = 86400

const getTxTimestamp = async (tx: any): Promise<number> => {
	return (await ethers.provider.getBlock(tx.blockNumber))!.timestamp
}

const getTimestampDifference = async (
	timestamp: number,
	tx: any,
): Promise<number> => {
	return (await ethers.provider.getBlock(tx.blockNumber))!.timestamp - timestamp
}

const getDefinedStakersAmount = (
	_stakers: HardhatEthersSigner[],
	amount: number,
) => {
	return _stakers.slice(0, amount)
}

describe('CommunityReward', function () {
	let stakeToken: WhoaToken
	let rewardToken: WhoaToken
	let stake: CommunityReward
	let deployer: HardhatEthersSigner,
		owner: HardhatEthersSigner,
		stakers: HardhatEthersSigner[]
	let tx: any

	let stakeDuration = 1000
	let declarationDuration = 1000

	beforeEach(async function () {
		;[deployer, owner, ...stakers] = await ethers.getSigners()

		const ERC20Factory = (await ethers.getContractFactory(
			'contracts/mocks/ERC20.sol:WhoaToken',
		)) as WhoaToken__factory

		stakeToken = await ERC20Factory.connect(deployer).deploy(
			'Stake Token',
			'STK',
			ethers.parseEther(
				'999999999999999999999999999999999999999999999999999999',
			),
			deployer.address,
		)

		rewardToken = await ERC20Factory.connect(deployer).deploy(
			'Stake Token',
			'STK',
			ethers.parseEther(
				'999999999999999999999999999999999999999999999999999999',
			),
			deployer.address,
		)

		await stakeToken
			.connect(deployer)
			.transfer(stakers[0].address, ethers.parseEther('99999999999'))
		await stakeToken
			.connect(deployer)
			.transfer(stakers[1].address, ethers.parseEther('99999999999'))

		const CommunityRewardFactory = (await ethers.getContractFactory(
			'contracts/CommunityReward.sol:CommunityReward',
		)) as CommunityReward__factory

		const stakeStartBlock =
			((await ethers.provider.getBlock('latest'))?.number || 0) + 4
		const stakeEndBlock = stakeStartBlock + stakeDuration
		stake = await CommunityRewardFactory.connect(deployer).deploy(
			stakeToken.target,
			rewardToken.target,
			owner.address,
			owner.address,
			ethers.parseEther('100'),
			stakeStartBlock,
			stakeEndBlock,
			0,
			0,
		)

		stakeToken.connect(stakers[0]).approve(stake.target, ethers.MaxUint256)
		stakeToken.connect(stakers[1]).approve(stake.target, ethers.MaxUint256)
		rewardToken
			.connect(deployer)
			.transfer(stake.target, ethers.parseEther('100000'))
	})

	describe('Deployment', function () {
		it('Should properly distribute stake reward', async function () {
			await stake
				.connect(stakers[0])
				.deposit(ethers.parseEther('1'), ethers.ZeroAddress)
			await mineBlocks(900)
			const alonePanding = await stake.pendingReward(stakers[0].address)
			// console.log(await stake.pendingReward(stakers[0].address), 'staker 0')
			// await stake.updatePool()
			await stake
				.connect(stakers[1])
				.deposit(ethers.parseEther('1000000000'), ethers.ZeroAddress)
			await stake
				.connect(stakers[1])
				.deposit(ethers.parseEther('1'), ethers.ZeroAddress)
			// await stake
			// 	.connect(stakers[0])
			// 	.deposit(ethers.parseEther('1'), ethers.ZeroAddress)
			// await stake.updatePool()

			await mineBlocks(100)
			// await stake.updatePool()
			console.log(await stake.pendingReward(stakers[0].address), 'staker 0')
			console.log(await stake.pendingReward(stakers[1].address), 'staker 1')
			expect(await stake.pendingReward(stakers[0].address)).to.be.gt(
				alonePanding,
			)
		})
	})
})
