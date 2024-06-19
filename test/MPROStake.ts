import {expect} from 'chai'
import {ethers, network} from 'hardhat'
import {HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers'
import {mine} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {BigNumber} from '@ethersproject/bignumber'
import {
	MPROStake,
	MPROTest,
	MPROTest__factory,
	MockedMPROStake__factory,
	MPROStake__factory,
} from '../typechain-types'

// npx hardhat test test/MPROStake.ts

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

describe('MPRORewardStake', function () {
	let mproToken: MPROTest
	let mproRewardStake: MPROStake
	let deployer: HardhatEthersSigner,
		owner: HardhatEthersSigner,
		stakers: HardhatEthersSigner[]
	let tx: any

	let stakeStartTimestamp = 0
	let stakeEndTimestamp = 0

	let stakeDuration = 1000

	beforeEach(async function () {
		;[deployer, owner, ...stakers] = await ethers.getSigners()

		const MPROTestFactory = (await ethers.getContractFactory(
			'contracts/mocks/MPROTest.sol:MPROTest',
		)) as MPROTest__factory
		mproToken = await MPROTestFactory.deploy()

		const MPRORewardStakeFactory = (await ethers.getContractFactory(
			'contracts/MPROStake.sol:MPROStake',
		)) as MPROStake__factory

		mproRewardStake = await MPRORewardStakeFactory.connect(deployer).deploy(
			mproToken.target, // MPRO token address
			owner.address, // New contract owner
		)
		stakeStartTimestamp =
			((await ethers.provider.getBlock('latest'))!.timestamp as number) + 2 // To make sure that the value is in the future
		stakeEndTimestamp = stakeStartTimestamp + stakeDuration
		await mproRewardStake.connect(owner).setStakeConfig(
			stakeStartTimestamp, // Stake start timestamp
			stakeEndTimestamp, // Stake end timestamp,
		)

		await mproToken
			.connect(owner)
			.increaseAllowance(mproRewardStake.target, ethers.MaxInt256)

		await mproToken
			.connect(owner)
			.distibute(
				owner.address,
				BigInt(stakers.length) * ethers.parseEther('1000'),
			)

		await Promise.all(
			stakers.map(async s => {
				await mproToken
					.connect(owner)
					.transfer(s.address, ethers.parseEther('1000'))
			}),
		)

		await Promise.all(
			stakers.map(async s => {
				await mproToken
					.connect(s)
					.increaseAllowance(mproRewardStake.target, ethers.MaxInt256)
			}),
		)
	})

	describe('Deployment', function () {
		it('Should properly deploy and set initial values', async function () {
			expect(await mproRewardStake.owner()).to.equal(owner.address)
			expect(await mproRewardStake.rewardToken()).to.equal(mproToken)
			expect(await mproRewardStake.stakeDuration()).to.equal(stakeDuration)
			expect(await mproRewardStake.stakeStartTimestamp()).to.equal(
				stakeStartTimestamp,
			)
			expect(await mproRewardStake.stakeEndTimestamp()).to.equal(
				stakeEndTimestamp,
			)
		})
	})

	describe('updateReward() function', function () {
		it('Should update reward correctly', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1000)
			await mproRewardStake.connect(owner).updateReward(1000)
			expect(await mproToken.balanceOf(mproRewardStake.target)).to.equal(1000)
			expect(await mproRewardStake.rewardTokenQuantity()).to.equal(1000)
			// MPRO tokens reward per second
			expect(await mproRewardStake.rewardPerSecond()).to.equal(
				1000 / stakeDuration,
			)
		})
		it('Should fail when owner does not have enough MPRO tokens to update reward', async function () {
			await expect(
				mproRewardStake.connect(owner).stake(1000),
			).to.be.revertedWith('ERC20: transfer amount exceeds balance')
		})
	})

	describe('pendingReward() function', function () {
		it("Should return 0 when staker didn't stake", async function () {
			const pending = await mproRewardStake.pendingReward(stakers[0].address)
			expect(pending).to.be.equal(0)
		})
		it('Should return correct pending reward', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake.connect(stakers[0]).stake(100)
			await network.provider.send('evm_increaseTime', [1000])
			await mine()
			const pending = await mproRewardStake.pendingReward(stakers[0].address)
			console.log('====================================')
			console.log(pending)
			console.log('====================================')
			expect(pending).to.be.gt(0)
		})
	})

	describe('setClaimRewardConfig() function', () => {
		it('Should set claim reward config properly', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(currentTimestamp, ONE_DAY, 2000)
			expect(await mproRewardStake.claimRewardStartTimestamp()).to.equal(
				currentTimestamp,
			)
			expect(await mproRewardStake.claimPeriodDuration()).to.equal(ONE_DAY)
			expect(await mproRewardStake.rewardUnlockPercentPerPeriod()).to.equal(
				2000,
			)
		})
		it('Should return error when trying to set claim reward config by not owner', async () => {
			await expect(
				mproRewardStake
					.connect(stakers[0])
					.setClaimRewardConfig(100, ONE_DAY, 2000),
			).to.be.revertedWith('Ownable: caller is not the owner')
		})
		it('Should return error when claim period duration is lower than 1', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await expect(
				mproRewardStake
					.connect(owner)
					.setClaimRewardConfig(currentTimestamp, 0, 2000),
			).to.be.revertedWith(
				'MPRORewardStake: Invalid claim reward configuration',
			)
		})
		it('Should return error when reward unlock percent per period is lower than 1', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await expect(
				mproRewardStake
					.connect(owner)
					.setClaimRewardConfig(currentTimestamp, ONE_DAY, 0),
			).to.be.revertedWith(
				'MPRORewardStake: Invalid claim reward configuration',
			)
		})
		it('Should return error when _rewardUnlockPercentPerPeriod is higher than 10000', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await expect(
				mproRewardStake
					.connect(owner)
					.setClaimRewardConfig(currentTimestamp, ONE_DAY, 10001),
			).to.be.revertedWith(
				'MPRORewardStake: Invalid claim reward configuration',
			)
		})
		it('Should return error when _rewardUnlockPercentPerPeriod is lower than 1', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await expect(
				mproRewardStake
					.connect(owner)
					.setClaimRewardConfig(currentTimestamp, ONE_DAY, 0),
			).to.be.revertedWith(
				'MPRORewardStake: Invalid claim reward configuration',
			)
		})
	})

	describe('pause() function', () => {
		it('Should pause contract', async () => {
			await mproRewardStake.connect(owner).pause()
			expect(await mproRewardStake.paused()).to.be.true
		})
		it('Should return error when trying to pause contract by not owner', async () => {
			await expect(
				mproRewardStake.connect(stakers[0]).pause(),
			).to.be.revertedWith(
				'MPRORewardStake: Address is not whitelisted updater',
			)
		})
	})

	describe('unpause() function', () => {
		it('Should unpause contract', async () => {
			await mproRewardStake.connect(owner).pause()
			await mproRewardStake.connect(owner).unpause()
			expect(await mproRewardStake.paused()).to.be.false
		})
		it('Should return error when trying to unpause contract by not owner', async () => {
			await mproRewardStake.connect(owner).pause()
			await expect(
				mproRewardStake.connect(stakers[0]).unpause(),
			).to.be.revertedWith(
				'MPRORewardStake: Address is not whitelisted updater',
			)
		})
	})

	describe.only('stake() function', function () {
		it('Production flow 1', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			await mproRewardStake.connect(stakers[0]).stake(ethers.parseEther('100'))
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeStartTimestamp, ONE_DAY, 10000)
			await network.provider.send('evm_increaseTime', [100])
			await mine()

			await mproRewardStake.connect(stakers[0]).claimReward()
			await mproRewardStake.connect(stakers[0]).unstake()
			const totalStaked = await mproRewardStake.totalStakedSupply()
			expect(totalStaked).to.equal(0)

			const staker = await mproRewardStake.staker(stakers[0].address)
			console.log(staker)
		})

		it('Production flow 2', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			await mproRewardStake.connect(stakers[0]).stake(ethers.parseEther('100'))
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeStartTimestamp, ONE_DAY, 10000)
			await network.provider.send('evm_increaseTime', [100])
			await mine()

			await mproRewardStake.connect(stakers[0]).stake(ethers.parseEther('100'))
			await network.provider.send('evm_increaseTime', [100])
			await mine()

			await mproRewardStake.connect(stakers[0]).stake(ethers.parseEther('100'))
			await network.provider.send('evm_increaseTime', [100])
			await mine()

			await mproRewardStake.connect(stakers[0]).stake(ethers.parseEther('100'))
			await network.provider.send('evm_increaseTime', [100])
			await mine()

			await mproRewardStake.connect(stakers[0]).claimReward()
			const pending = await mproRewardStake.pendingReward(stakers[0].address)
			expect(pending).to.be.equal(0)

			await mproRewardStake.connect(stakers[0]).unstake()

			const totalStaked = await mproRewardStake.totalStakedSupply()
			expect(totalStaked).to.equal(0)

			const staker = await mproRewardStake.staker(stakers[0].address)
			console.log(staker)
		})
	})
})
