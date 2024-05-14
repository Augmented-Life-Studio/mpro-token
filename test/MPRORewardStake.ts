import {expect} from 'chai'
import {ethers, network} from 'hardhat'
import {HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers'
import {mine} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {BigNumber} from '@ethersproject/bignumber'
import {
	MPRORewardStake,
	MPRORewardStake__factory,
	MPROTest,
	MPROTest__factory,
} from '../typechain-types'

// npx hardhat test test/MPRORewardStake.ts

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
	let mproRewardStake: MPRORewardStake
	let deployer: HardhatEthersSigner,
		owner: HardhatEthersSigner,
		stakers: HardhatEthersSigner[]
	let tx: any

	let stakeStartTimestamp = 0
	let stakeEndTimestamp = 0

	let stakeDuration = 1000
	let declarationDuration = 1000

	beforeEach(async function () {
		;[deployer, owner, ...stakers] = await ethers.getSigners()

		const MPROTestFactory = (await ethers.getContractFactory(
			'contracts/mocks/MPROTest.sol:MPROTest',
		)) as MPROTest__factory
		mproToken = await MPROTestFactory.deploy()

		const MPRORewardStakeFactory = (await ethers.getContractFactory(
			'contracts/MPRORewardStake.sol:MPRORewardStake',
		)) as MPRORewardStake__factory
		stakeStartTimestamp = (await ethers.provider.getBlock('latest'))!
			.timestamp as number
		stakeEndTimestamp = stakeStartTimestamp + stakeDuration

		mproRewardStake = await MPRORewardStakeFactory.connect(deployer).deploy(
			mproToken.target, // MPRO token address

			owner.address, // New contract owner
		)

		await mproRewardStake.connect(owner).setStakeConfig(
			stakeStartTimestamp, // Stake start timestamp
			stakeEndTimestamp, // Stake end timestamp,
			stakeStartTimestamp, // Declaration start timestamp,
			stakeStartTimestamp + declarationDuration, // Declaration end timestamp,
		)

		await mproToken
			.connect(owner)
			.increaseAllowance(mproRewardStake.target, ethers.MaxInt256)
	})

	describe('Deployment', function () {
		it('Should properly deploy and set initial values', async function () {
			expect(await mproRewardStake.owner()).to.equal(owner.address)
			expect(await mproRewardStake.mproToken()).to.equal(mproToken)
			expect(await mproRewardStake.stakeDuration()).to.equal(stakeDuration)
		})
	})

	describe('updateReward() function', function () {
		it('Should update reward correctly', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1000)
			await mproRewardStake.connect(owner).updateReward(1000)
			expect(await mproToken.balanceOf(mproRewardStake.target)).to.equal(1000)
			expect(await mproRewardStake.rewardTokenQuantity()).to.equal(1000)
			// MPRO tokens reward per second
			expect(await mproRewardStake.rewardRate()).to.equal(1000 / stakeDuration)
		})
		it('Should fail when owner does not have enough MPRO tokens to update reward', async function () {
			await expect(
				mproRewardStake.connect(owner).updateReward(1000),
			).to.be.revertedWith('ERC20: transfer amount exceeds balance')
		})
		it("Should fail when owner doesn't have enough allowance to update reward", async function () {
			await mproToken
				.connect(owner)
				.decreaseAllowance(mproRewardStake.target, ethers.MaxInt256)
			await mproToken.connect(owner).distibute(owner.address, 1000)
			await expect(
				mproRewardStake.connect(owner).updateReward(1000),
			).to.be.revertedWith('ERC20: insufficient allowance')
		})
		it('Should calculate pending rewards correctly', async function () {
			await mproToken.connect(owner).distibute(owner.address, 50000)
			await mproRewardStake.connect(owner).updateReward(1000)
			// Update stakers
			await mproRewardStake.connect(owner).updateStakers(
				stakers.map(s => s.address),
				Array(stakers.length).fill(100),
			)

			// Advance time
			await ethers.provider.send('evm_increaseTime', [1000])
			await mine()

			// Calculate pending rewards
			for (let i = 0; i < stakers.length; i++) {
				const pending = await mproRewardStake.pendingReward(stakers[i].address)
				expect(pending).to.be.gt(0)
			}
		})
	})

	describe('updateStakers() with multiple wallet function', function () {
		it('Should update stakers with compound', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1000'))

			const localStakers = getDefinedStakersAmount(stakers, 5)

			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('5'))

			await mproRewardStake.connect(owner).updateStakers(
				localStakers.map(s => s.address),
				localStakers.map(() => ethers.parseEther('1')),
			)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('5'))

			await network.provider.send('evm_increaseTime', [600])
			await mine()

			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('5'))

			const tx2 = await mproRewardStake.connect(owner).updateStakers(
				localStakers.map(s => s.address),
				localStakers.map(() => ethers.parseEther('1')),
			)

			await network.provider.send('evm_increaseTime', [2000])
			await mine()

			const lastTimeUpdated = await mproRewardStake.staker(
				localStakers[0].address,
			)
			const tx2Timestamp = await getTxTimestamp(tx2)
			expect(Number(lastTimeUpdated[1])).to.be.equal(tx2Timestamp)
		})
	})

	describe('updateStakers() with single wallet function', function () {
		it('Should update stakers with compound', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))

			const localStaker = getDefinedStakersAmount(stakers, 1)[0]

			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1'))

			const startStakingTx = await mproRewardStake
				.connect(owner)
				.updateStakers([localStaker.address], [ethers.parseEther('1')])

			await network.provider.send('evm_increaseTime', [2000])
			await mine()

			await mproRewardStake
				.connect(owner)
				.updateStakers([localStaker.address], ['0'])

			// If during 1 second 1 MPRO is given for reward, reward should be - stakingPeriod * rewardRate
			const startStakingTimestamp = await getTxTimestamp(startStakingTx)
			const stakingDuration = stakeEndTimestamp - startStakingTimestamp
			const rewardRate = await mproRewardStake.rewardRate()
			const expectedReward = stakingDuration * Number(rewardRate)
			const stakerData = await mproRewardStake.staker(localStaker.address)
			// Check if staker reward is equal to expected reward
			expect(
				BigNumber.from(stakerData[2]).sub(
					BigNumber.from(expectedReward.toString()),
				),
			).to.be.equal(ethers.parseEther('1'))
		})
	})

	describe('lastTimeRewardApplicable function', function () {
		//  The function should return the last time reward applicable
		//  - last timestamp when the reward was updated
		//  - current timestamp when timestamp is lower than stakeEndTimestamp
		it('Should return the last time reward applicable', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1000)
			tx = await mproRewardStake.connect(owner).updateReward(1000)
			const timestamp = await getTxTimestamp(tx)
			expect(await mproRewardStake.lastTimeRewardApplicable()).to.be.equal(
				timestamp,
			)
			// Increase time by stake duration
			await network.provider.send('evm_increaseTime', [stakeDuration])
			await mine()
			expect(await mproRewardStake.lastTimeRewardApplicable()).to.be.equal(
				stakeEndTimestamp,
			)
		})
	})

	describe('updateWalletReward function', function () {
		// The function is created to allow users to update their rewards manually
		// We do updates on reward on the service but pending reward sould be udpated after staking period
		it('Should update wallet reward correctly', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('10000'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			tx = await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			const updateTimestamp = await getTxTimestamp(tx)
			await network.provider.send('evm_increaseTime', [1000])
			await mine()
			const stakerData = await mproRewardStake.staker(stakers[0].address)
			const stakeDuration = stakeEndTimestamp - updateTimestamp
			expect(stakerData[1]).to.be.equal(stakeEndTimestamp)

			const rewardRate = await mproRewardStake.rewardRate()
			const expectedReward = stakeDuration * Number(rewardRate)
			expect(
				BigNumber.from(stakerData[2].toString()).sub(ethers.parseEther('100')),
			).to.be.equal(BigNumber.from(expectedReward.toString()))
		})
	})

	describe('claim function', function () {
		it.only('Should claim reward correctly', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('10000'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			tx = await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			const updateTimestamp = await getTxTimestamp(tx)
			await network.provider.send('evm_increaseTime', [1000])
			await mine()

			const stakerData = await mproRewardStake.staker(stakers[0].address)

			const stakingDuration = stakeEndTimestamp - Number(updateTimestamp)
			const rewardRate = await mproRewardStake.rewardRate()
			const expectedReward = stakingDuration * Number(rewardRate)
			expect(
				BigNumber.from(stakerData[2]).sub(BigNumber.from(stakerData[0])),
			).to.be.lt(BigNumber.from(expectedReward.toString()))
			const currentBlockTimestamp = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlockTimestamp?.timestamp || 0

			// Set claiming config by owner
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
			await network.provider.send('evm_increaseTime', [ONE_DAY])

			await mine()

			await mproRewardStake.connect(stakers[0]).claim()
			const stakerDataAfterClaim = await mproRewardStake.staker(
				stakers[0].address,
			)
			const balanceToClaim = stakerDataAfterClaim[2]
			const balanceAfterClaim = await mproToken.balanceOf(stakers[0].address)

			expect(balanceAfterClaim).to.be.equal(
				BigNumber.from(balanceToClaim).mul(2000).div(10000),
			)
			// Should return error when trying to claim again
			await expect(
				mproRewardStake.connect(stakers[0]).claim(),
			).to.be.revertedWith('MPRORewardStake: No tokens to claim')

			await network.provider.send('evm_increaseTime', [3 * ONE_DAY])
			await mine()

			// Claim again
			await mproRewardStake.connect(stakers[0]).claim()
			const balanceAfterClaim2 = await mproToken.balanceOf(stakers[0].address)
			expect(balanceAfterClaim2).to.be.equal(
				BigNumber.from(balanceToClaim).mul(8000).div(10000),
			)

			// Should return error when trying to claim again

			await network.provider.send('evm_increaseTime', [3 * ONE_DAY])
			await mine()

			// Claim again
			await mproRewardStake.connect(stakers[0]).claim()
			const balanceAfterClaim3 = await mproToken.balanceOf(stakers[0].address)
			expect(balanceAfterClaim3).to.be.equal(balanceToClaim)

			const dustBeforeStaking = await mproToken.balanceOf(
				mproRewardStake.target,
			)

			const rewardAmount = await mproRewardStake.rewardTokenQuantity()
			expect(rewardAmount).to.be.equal(dustBeforeStaking)
		})
	})
})
