import {expect} from 'chai'
import {ethers, network} from 'hardhat'
import {HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers'
import {mine} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {BigNumber} from '@ethersproject/bignumber'
import {
	MPROAutoStake,
	MPROAutoStake__factory,
	MPROTest,
	MPROTest__factory,
	MockedMPROStake__factory,
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
	let mproRewardStake: MPROAutoStake
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
			'contracts/MPROStake.sol:MPROAutoStake',
		)) as MPROAutoStake__factory

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
			stakeStartTimestamp, // Update stakers start timestamp
			stakeEndTimestamp, // Update stakers end timestamp,
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
			expect(await mproRewardStake.rewardToken()).to.equal(mproToken)
			expect(await mproRewardStake.stakeDuration()).to.equal(stakeDuration)
			expect(await mproRewardStake.stakeStartTimestamp()).to.equal(
				stakeStartTimestamp,
			)
			expect(await mproRewardStake.stakeEndTimestamp()).to.equal(
				stakeEndTimestamp,
			)
			expect(await mproRewardStake.updateStakersStartTimestamp()).to.equal(
				stakeStartTimestamp,
			)
			expect(await mproRewardStake.updateStakersEndTimestamp()).to.equal(
				stakeEndTimestamp,
			)
			expect(await mproRewardStake.declarationStartTimestamp()).to.equal(
				stakeStartTimestamp,
			)
			expect(await mproRewardStake.declarationEndTimestamp()).to.equal(
				stakeStartTimestamp + declarationDuration,
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

	describe('pendingReward() function', function () {
		it("Should return 0 when staker didn't stake", async function () {
			const pending = await mproRewardStake.pendingReward(stakers[0].address)
			expect(pending).to.be.equal(0)
		})
		it('Should return correct pending reward', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			await network.provider.send('evm_increaseTime', [1000])
			await mine()
			const pending = await mproRewardStake.pendingReward(stakers[0].address)
			expect(pending).to.be.gt(0)
		})
	})

	describe('stakeDuration() function', function () {
		it('Should return stake duration properly', async function () {
			expect(await mproRewardStake.stakeDuration()).to.equal(stakeDuration)
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

			const lastTimeUpdated = await mproRewardStake.lastRewardTimestamp()
			const tx2Timestamp = await getTxTimestamp(tx2)
			expect(Number(lastTimeUpdated)).to.be.equal(tx2Timestamp)
		})
	})

	describe('getStakedAmount() function', function () {
		it('Should return staked amount correctly', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			const stakedAmount = await mproRewardStake.getStakedAmount(
				stakers[0].address,
			)
			expect(stakedAmount).to.be.equal(100)
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

			// If during 1 second 1 MPRO is given for reward, reward should be - stakingPeriod * rewardPerSecond
			const startStakingTimestamp = await getTxTimestamp(startStakingTx)
			const stakingDuration = stakeEndTimestamp - startStakingTimestamp
			const rewardPerSecond = await mproRewardStake.rewardPerSecond()
			const expectedReward = stakingDuration * Number(rewardPerSecond)
			const stakerData = await mproRewardStake.staker(localStaker.address)
			// Check if staker reward is equal to expected reward
			expect(
				BigNumber.from(stakerData[1]).sub(
					BigNumber.from(expectedReward.toString()),
				),
			).to.be.approximately(
				ethers.parseEther('1'),
				ethers.parseEther('0.000000001'),
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
			const stakeDuration = stakeEndTimestamp - updateTimestamp

			const rewardPerSecond = await mproRewardStake.rewardPerSecond()
			const expectedReward = stakeDuration * Number(rewardPerSecond)
			expect(
				await mproRewardStake.pendingReward(stakers[0].address),
			).to.be.approximately(
				BigNumber.from(expectedReward.toString()),
				ethers.parseEther('0.0000000001'),
			)
		})
		it('updateStakers with declaration period', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('10000'))
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			const MPRORewardStakeFactory = (await ethers.getContractFactory(
				'contracts/MPROStake.sol:MPROAutoStake',
			)) as MPROAutoStake__factory
			const newMproRewardStake = await MPRORewardStakeFactory.connect(
				deployer,
			).deploy(
				mproToken.target, // MPRO token address

				owner.address, // New contract owner
			)
			await newMproRewardStake
				.connect(owner)
				.setStakeConfig(
					currentTimestamp + ONE_DAY,
					currentTimestamp + 2 * ONE_DAY,
					currentTimestamp + ONE_DAY,
					currentTimestamp + 2 * ONE_DAY,
					currentTimestamp + ONE_DAY,
					currentTimestamp + ONE_DAY + ONE_DAY / 2,
				)
			await mproToken
				.connect(owner)
				.increaseAllowance(newMproRewardStake.target, ethers.MaxInt256)
			tx = await newMproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			// Wait for stake start and declaration start
			await network.provider.send('evm_increaseTime', [ONE_DAY])
			await mine()
			// update one wallet
			await newMproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			// Wait for declaration end
			await network.provider.send('evm_increaseTime', [ONE_DAY / 2 + 10])
			await mine()
			// update all wallets
			await newMproRewardStake.connect(owner).updateStakers(
				stakers.map(s => s.address),
				stakers.map(() => ethers.parseEther('100')),
			)
			// Check if only one staker is participating
			const stakerData = await newMproRewardStake.staker(stakers[0].address)
			expect(stakerData[0]).to.be.equal(ethers.parseEther('200'))
			const outStakerData = await newMproRewardStake.staker(stakers[1].address)
			expect(outStakerData[0]).to.be.equal(0)
		})
	})

	describe('claim function', function () {
		it('Should claim reward correctly', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('10000'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			tx = await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			const updates = await mproRewardStake.getWalletStakeUpdates(
				stakers[0].address,
			)
			const updateTimestamp = await getTxTimestamp(tx)
			await network.provider.send('evm_increaseTime', [1000])
			await mine()

			const stakerData = await mproRewardStake.staker(stakers[0].address)

			const stakingDuration = stakeEndTimestamp - Number(updateTimestamp)
			const rewardPerSecond = await mproRewardStake.rewardPerSecond()
			const expectedReward = stakingDuration * Number(rewardPerSecond)
			expect(
				BigNumber.from(stakerData[1]).sub(BigNumber.from(stakerData[0])),
			).to.be.lt(BigNumber.from(expectedReward.toString()))

			// Set claiming config by owner
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp + ONE_DAY, ONE_DAY, 2000)

			expect(await mproRewardStake.claimRewardStartTimestamp()).to.equal(
				stakeEndTimestamp + ONE_DAY,
			)
			expect(await mproRewardStake.claimPeriodDuration()).to.equal(ONE_DAY)
			expect(await mproRewardStake.rewardUnlockPercentPerPeriod()).to.equal(
				2000,
			)
			await network.provider.send('evm_increaseTime', [ONE_DAY])

			await mine()

			await mproRewardStake.connect(stakers[0]).claim()

			const stakerDataBeforeClaim = await mproRewardStake.staker(
				stakers[0].address,
			)

			const lastTimeRewardUpdated = await mproRewardStake.lastRewardTimestamp()
			const balanceToClaim = BigNumber.from(stakingDuration)
				.mul(rewardPerSecond)
				.add(ethers.parseEther('100'))

			const balanceAfterClaim = await mproToken.balanceOf(stakers[0].address)

			expect(balanceAfterClaim).to.be.approximately(
				BigNumber.from(balanceToClaim).mul(2000).div(10000),
				ethers.parseEther('0.000000001'),
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
			expect(balanceAfterClaim2).to.be.approximately(
				BigNumber.from(balanceToClaim).mul(8000).div(10000),
				ethers.parseEther('0.000000001'),
			)

			// Should return error when trying to claim again

			await network.provider.send('evm_increaseTime', [3 * ONE_DAY])
			await mine()

			// Claim again
			await mproRewardStake.connect(stakers[0]).claim()
			const balanceAfterClaim3 = await mproToken.balanceOf(stakers[0].address)
			expect(balanceAfterClaim3).to.be.approximately(
				balanceToClaim,
				ethers.parseEther('0.000000001'),
			)

			const dustBeforeStaking = await mproToken.balanceOf(
				mproRewardStake.target,
			)

			const rewardAmount = await mproRewardStake.rewardTokenQuantity()
			expect(rewardAmount).to.be.equal(dustBeforeStaking)
		})
		it("Should return error when claiming period hasn't started", async function () {
			await expect(
				mproRewardStake.connect(stakers[0]).claim(),
			).to.be.revertedWith('MPRORewardStake: Claim period has not started')
		})
		it('Should return error when are no tokens to claim', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await network.provider.send('evm_increaseTime', [1000])
			await mine()
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(100, ONE_DAY, 2000)
			await network.provider.send('evm_increaseTime', [ONE_DAY])
			await mine()
			await expect(
				mproRewardStake.connect(stakers[0]).claim(),
			).to.be.revertedWith('MPRORewardStake: No tokens to claim')
		})
		it("Should return error when contract is paused and we're trying to claim", async function () {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(100, ONE_DAY, 2000)
			await network.provider.send('evm_increaseTime', [ONE_DAY])
			await mine()
			await mproRewardStake.connect(owner).pause()
			await expect(
				mproRewardStake.connect(stakers[0]).claim(),
			).to.be.revertedWith('Pausable: paused')
		})
	})

	describe('enableForRelease() function', function () {
		it('Should return proper amount on every claim cycle', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1100'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp + 100, ONE_DAY, 2000)
			await network.provider.send('evm_increaseTime', [stakeDuration + 100])
			await mine()
			await mproRewardStake.connect(stakers[0]).claim()
			const stakerData = await mproRewardStake.staker(stakers[0].address)
			const balanceToClaim = stakerData[1]
			const balanceAfterClaim = await mproToken.balanceOf(stakers[0].address)
			expect(balanceAfterClaim).to.be.equal(
				BigNumber.from(balanceToClaim).mul(2000).div(10000),
			)
			await network.provider.send('evm_increaseTime', [3 * ONE_DAY])
			await mine()
			await mproRewardStake.connect(stakers[0]).claim()
			const balanceAfterClaim2 = await mproToken.balanceOf(stakers[0].address)
			expect(balanceAfterClaim2).to.be.equal(
				BigNumber.from(balanceToClaim).mul(8000).div(10000),
			)
			await network.provider.send('evm_increaseTime', [3 * ONE_DAY])
			await mine()
			await mproRewardStake.connect(stakers[0]).claim()
			const balanceAfterClaim3 = await mproToken.balanceOf(stakers[0].address)
			expect(balanceAfterClaim3).to.be.equal(balanceToClaim)
		})
		it('Should return 0  before claiming period', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp + 100, ONE_DAY, 2000)
			expect(
				await mproRewardStake.connect(stakers[0]).enableForRelease(),
			).to.equal(0)
		})
		it('Should return all staked amount when rewardUnlockPercentPerPeriod is 100%', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp + 100, ONE_DAY, 10000)
			await network.provider.send('evm_increaseTime', [stakeDuration + 100])
			await mine()
			expect(
				await mproRewardStake.connect(stakers[0]).enableForRelease(),
			).to.equal(100)
		})
	})

	describe('moveToStake() function', function () {
		it('Should move tokens to stake contract', async function () {
			const newStakeFactory = (await ethers.getContractFactory(
				'contracts/mocks/MockedMPROStake.sol:MockedMPROStake',
			)) as MockedMPROStake__factory
			const mproStake = await newStakeFactory.connect(deployer).deploy()
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('9999999999999'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.setStakeWhitelisted(mproStake.target, true)
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp + 100, ONE_DAY, 2000)
			tx = await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('99999')])
			// await mproRewardStake.connect(owner).updatePool()
			const updateTimestamp = await getTxTimestamp(tx)
			// Wait until stake period
			await network.provider.send('evm_increaseTime', [ONE_DAY * 90])
			await mine()

			const stakingPeriod = stakeEndTimestamp - updateTimestamp
			const rewardPerSecond = await mproRewardStake.rewardPerSecond()
			const stakeAmount = await mproRewardStake.getStakedAmount(
				stakers[0].address,
			)
			const expectedReward = BigNumber.from(rewardPerSecond)
				.mul(BigNumber.from(stakingPeriod))
				.add(stakeAmount)

			await mproStake.connect(stakers[0]).transferStake(mproRewardStake.target)
			const newStakeMproBalance = await mproToken.balanceOf(mproStake.target)
			expect(newStakeMproBalance).to.be.approximately(
				expectedReward,
				ethers.parseEther('0.0000000001'),
			)
		})
		it('Should fail when stake contract is not whitelisted', async function () {
			const newStakeFactory = (await ethers.getContractFactory(
				'contracts/mocks/MockedMPROStake.sol:MockedMPROStake',
			)) as MockedMPROStake__factory
			const mproStake = await newStakeFactory.connect(deployer).deploy()
			await mproRewardStake
				.connect(owner)
				.setStakeWhitelisted(mproStake.target, false)
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await expect(
				mproRewardStake.connect(stakers[0]).moveToStake(mproStake.target),
			).to.be.revertedWith('MPRORewardStake: Stake contract is not whitelisted')
		})
		it('Should return error when fire before claiming period', async function () {
			const newStakeFactory = (await ethers.getContractFactory(
				'contracts/mocks/MockedMPROStake.sol:MockedMPROStake',
			)) as MockedMPROStake__factory
			const mproStake = await newStakeFactory.connect(deployer).deploy()
			await mproRewardStake
				.connect(owner)
				.setStakeWhitelisted(mproStake.target, true)
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			tx = await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			await expect(
				mproStake.connect(stakers[0]).transferStake(mproRewardStake.target),
			).to.be.revertedWith('Claim period has not started')
		})
		it('Should return error when contract is poused', async function () {
			const newStakeFactory = (await ethers.getContractFactory(
				'contracts/mocks/MockedMPROStake.sol:MockedMPROStake',
			)) as MockedMPROStake__factory
			const mproStake = await newStakeFactory.connect(deployer).deploy()
			await mproRewardStake
				.connect(owner)
				.setStakeWhitelisted(mproStake.target, true)
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			tx = await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			await network.provider.send('evm_increaseTime', [1000])
			await mine()
			await mproRewardStake.connect(owner).pause()
			await expect(
				mproStake.connect(stakers[0]).transferStake(mproRewardStake.target),
			).to.be.revertedWith('Pausable: paused')
		})
		it("Should return error when staker doesn't have enough tokens", async function () {
			const newStakeFactory = (await ethers.getContractFactory(
				'contracts/mocks/MockedMPROStake.sol:MockedMPROStake',
			)) as MockedMPROStake__factory
			const mproStake = await newStakeFactory.connect(deployer).deploy()
			await mproRewardStake
				.connect(owner)
				.setStakeWhitelisted(mproStake.target, true)
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(100, ONE_DAY, 2000)
			await network.provider.send('evm_increaseTime', [ONE_DAY])
			await mine()
			await expect(
				mproStake.connect(stakers[0]).transferStake(mproRewardStake.target),
			).to.be.revertedWith('No tokens to release')
		})
		it('Should return error on transferStake when we provide wrong stake contract address', async function () {
			const newStakeFactory = (await ethers.getContractFactory(
				'contracts/mocks/MockedMPROStake.sol:MockedMPROStake',
			)) as MockedMPROStake__factory
			const mproStake = await newStakeFactory.connect(deployer).deploy()
			await mproRewardStake
				.connect(owner)
				.setStakeWhitelisted(mproStake.target, true)
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			tx = await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			await network.provider.send('evm_increaseTime', [1000])
			await mine()
			await expect(
				mproStake.connect(stakers[0]).transferStake(ethers.ZeroAddress),
			).to.be.reverted
		})
	})

	describe('removeDust() function', () => {
		it('Should remove dust from contract', async () => {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			expect(await mproToken.balanceOf(mproRewardStake.target)).to.be.equal(
				1100,
			)
			await mproRewardStake
				.connect(owner)
				.removeDust(await mproToken.balanceOf(mproRewardStake.target))
			const balance = await mproToken.balanceOf(mproRewardStake.target)
			expect(balance).to.be.equal(0)
		})
		it('Should return error when trying to remove dust by not owner', async () => {
			await expect(
				mproRewardStake.connect(stakers[0]).removeDust(1000),
			).to.be.revertedWith('Ownable: caller is not the owner')
		})
	})

	describe('setStakeConfig() function', () => {
		it('Should set stake config properly', async () => {
			const MPRORewardStakeFactory = (await ethers.getContractFactory(
				'contracts/MPROStake.sol:MPROAutoStake',
			)) as MPROAutoStake__factory
			const newMproRewardStake = await MPRORewardStakeFactory.connect(
				deployer,
			).deploy(
				mproToken.target, // MPRO token address

				owner.address, // New contract owner
			)
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await newMproRewardStake
				.connect(owner)
				.setStakeConfig(
					currentTimestamp + ONE_DAY,
					currentTimestamp + 2 * ONE_DAY,
					currentTimestamp + ONE_DAY,
					currentTimestamp + 2 * ONE_DAY,
					currentTimestamp + ONE_DAY,
					currentTimestamp + ONE_DAY + ONE_DAY / 2,
				)

			expect(await newMproRewardStake.stakeStartTimestamp()).to.equal(
				currentTimestamp + ONE_DAY,
			)
			expect(await newMproRewardStake.stakeEndTimestamp()).to.equal(
				currentTimestamp + 2 * ONE_DAY,
			)
			expect(await newMproRewardStake.updateStakersStartTimestamp()).to.equal(
				currentTimestamp + ONE_DAY,
			)
			expect(await newMproRewardStake.updateStakersEndTimestamp()).to.equal(
				currentTimestamp + 2 * ONE_DAY,
			)
			expect(await newMproRewardStake.declarationStartTimestamp()).to.equal(
				currentTimestamp + ONE_DAY,
			)
			expect(await newMproRewardStake.declarationEndTimestamp()).to.equal(
				currentTimestamp + ONE_DAY + ONE_DAY / 2,
			)
		})
		it('Should return error when trying to set stake config by not owner', async () => {
			await expect(
				mproRewardStake
					.connect(stakers[0])
					.setStakeConfig(100, 200, 300, 400, 500, 600),
			).to.be.revertedWith('Ownable: caller is not the owner')
		})
		it('Should return error when stake end timestamp is lower than stake start timestamp', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await expect(
				mproRewardStake
					.connect(owner)
					.setStakeConfig(
						currentTimestamp + ONE_DAY,
						currentTimestamp - 1,
						currentTimestamp + ONE_DAY,
						currentTimestamp + 2 * ONE_DAY,
						currentTimestamp + ONE_DAY,
						currentTimestamp + ONE_DAY + ONE_DAY / 2,
					),
			).to.be.revertedWith('MPRORewardStake: Invalid stake configuration')
		})
		it('Should return error when update stakers end timestamp is lower than update stakers start timestamp', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await expect(
				mproRewardStake
					.connect(owner)
					.setStakeConfig(
						currentTimestamp + ONE_DAY,
						currentTimestamp + 2 * ONE_DAY,
						currentTimestamp + ONE_DAY,
						currentTimestamp - 1,
						currentTimestamp + ONE_DAY,
						currentTimestamp + ONE_DAY + ONE_DAY / 2,
					),
			).to.be.revertedWith('MPRORewardStake: Invalid stake configuration')
		})
		it('Should return error when declaration end timestamp is lower than declaration start timestamp', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			await expect(
				mproRewardStake
					.connect(owner)
					.setStakeConfig(
						currentTimestamp + ONE_DAY,
						currentTimestamp + 2 * ONE_DAY,
						currentTimestamp + ONE_DAY,
						currentTimestamp + 2 * ONE_DAY,
						currentTimestamp + ONE_DAY,
						currentTimestamp + ONE_DAY - 1,
					),
			).to.be.revertedWith('MPRORewardStake: Invalid stake configuration')
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

	describe('updateStakers() function', () => {
		it('Should revert when called by non-owner or non-whitelisted address', async () => {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await expect(
				mproRewardStake
					.connect(stakers[0])
					.updateStakers([stakers[0].address], [100]),
			).to.be.revertedWith(
				'MPRORewardStake: Address is not whitelisted updater',
			)
		})

		it('Should revert when stakers and amounts lengths are not the same', async () => {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			await expect(
				mproRewardStake
					.connect(owner)
					.updateStakers([stakers[0].address], [100, 100]),
			).to.be.revertedWith('Invalid input - length mismatch')
		})

		it('Should properly add new staker', async () => {
			await mproToken.connect(owner).distibute(owner.address, 1500)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
		})

		it('Should revert when trying to add staker before autostake starts', async () => {
			const currentBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = currentBlock?.timestamp || 0
			const MPRORewardStakeFactory = (await ethers.getContractFactory(
				'contracts/MPROStake.sol:MPROAutoStake',
			)) as MPROAutoStake__factory

			const newMproRewardStake = await MPRORewardStakeFactory.connect(
				deployer,
			).deploy(
				mproToken.target, // MPRO token address
				owner.address, // New contract owner
			)
			stakeStartTimestamp =
				((await ethers.provider.getBlock('latest'))!.timestamp as number) + 100 // To make sure that the value is in the future
			stakeEndTimestamp = stakeStartTimestamp + stakeDuration
			await newMproRewardStake
				.connect(owner)
				.setStakeConfig(
					currentTimestamp + ONE_DAY,
					currentTimestamp + 2 * ONE_DAY,
					currentTimestamp + ONE_DAY,
					currentTimestamp + 2 * ONE_DAY,
					currentTimestamp + ONE_DAY,
					currentTimestamp + ONE_DAY + ONE_DAY / 2,
				)
			await mproToken.connect(owner).distibute(owner.address, 1500)
			await mproToken
				.connect(owner)
				.increaseAllowance(newMproRewardStake.target, ethers.MaxUint256)
			await newMproRewardStake.connect(owner).updateReward(1000)
			await expect(
				newMproRewardStake
					.connect(owner)
					.updateStakers([stakers[0].address], [100]),
			).to.be.revertedWith('Can not update out of the updating period')
		})

		it('Should throw error when amount is negative', async () => {
			try {
				await mproToken.connect(owner).distibute(owner.address, 1100)
				await mproRewardStake.connect(owner).updateReward(1000)
				await expect(
					mproRewardStake
						.connect(owner)
						.updateStakers([stakers[0].address], [-10]),
				).to.be.revertedWith('Can not update out of the updating period')
				expect.fail('Expected error not thrown')
			} catch (error: any) {
				expect(error.message).to.be.equal(
					`value out-of-bounds (argument="", value=-10, code=INVALID_ARGUMENT, version=6.12.0)`,
				)
			}
		})

		it('Should allow updateStakers with amount set to zero', async () => {
			await mproToken.connect(owner).distibute(owner.address, 1500)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [0])
		})
	})

	describe('getStakedAmount() function', () => {
		it('Should return proper stakedAmount', async () => {
			await mproToken.connect(owner).distibute(owner.address, 1200)
			await mproRewardStake.connect(owner).updateReward(1000)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [100])
			let stakedAmount = await mproRewardStake
				.connect(owner)
				.getStakedAmount(stakers[0])
			expect(stakedAmount).to.equal(200)
		})

		it('Should return zero for non-staker', async () => {
			await mproToken.connect(owner).distibute(owner.address, 1100)
			await mproRewardStake.connect(owner).updateReward(1000)
			let stakedAmount = await mproRewardStake
				.connect(owner)
				.getStakedAmount(stakers[0])
			expect(stakedAmount).to.equal(0)
		})
	})

	describe('getEarnedAmount() function', () => {
		it('Should return proper stakedAmount', async () => {
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp, ONE_DAY, 1000)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1200'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])

			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])

			const stakerData = await mproRewardStake.staker(stakers[0].address)
			expect(stakerData[0]).to.equal(ethers.parseEther('200'))
		})

		it('Should return proper stakedAmount for non-staker', async () => {
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp, ONE_DAY, 1000)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1200'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))

			const stakerData = await mproRewardStake.staker(stakers[0].address)
			expect(stakerData.reward).to.equal(ethers.parseEther('0'))
		})

		it('Should grant bigger reward to staker with more staked tokens (proportionally)', async () => {
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp, ONE_DAY, 1000)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1400'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.updateStakers(
					[stakers[0].address, stakers[1].address],
					[ethers.parseEther('100'), ethers.parseEther('100')],
				)

			let dataStaker_0 = await mproRewardStake.staker(stakers[0].address)
			let dataStaker_1 = await mproRewardStake.staker(stakers[1].address)
			expect(dataStaker_0.reward).to.equal(ethers.parseEther('0'))
			expect(dataStaker_1.reward).to.equal(ethers.parseEther('0'))

			await mproRewardStake
				.connect(owner)
				.updateStakers(
					[stakers[0].address, stakers[1].address],
					[ethers.parseEther('200'), ethers.parseEther('0')],
				)

			dataStaker_0 = await mproRewardStake.staker(stakers[0].address)
			dataStaker_1 = await mproRewardStake.staker(stakers[1].address)
			expect(dataStaker_0.reward).to.equal(dataStaker_1.reward)

			await mproRewardStake
				.connect(owner)
				.updateStakers(
					[stakers[0].address, stakers[1].address],
					[ethers.parseEther('0'), ethers.parseEther('0')],
				)

			dataStaker_0 = await mproRewardStake.staker(stakers[0].address)
			dataStaker_1 = await mproRewardStake.staker(stakers[1].address)
			expect(dataStaker_0.reward).to.be.greaterThan(dataStaker_1.reward)
		})
	})

	describe('Additional checks', () => {
		it('Should allow user to claim properly (claim 60%)', async () => {
			// Set claim with claim percent over 50%
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp, 500, 6000)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1300'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			// updateStaker with 100 tokens
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			// Skip some blocks and updateStakers again with 100 tokens
			await network.provider.send('evm_increaseTime', [100])
			await mine()
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			// Skip to claiming period
			await network.provider.send('evm_increaseTime', [900])
			await mine()

			await mproRewardStake.connect(stakers[0]).claim()
			// Second claim should be reverted because it is not next claim period yet
			await expect(mproRewardStake.connect(stakers[0]).claim()).to.be.reverted

			// Then enable to release another 60% of reward
			await network.provider.send('evm_increaseTime', [900])
			await mine()

			await mproRewardStake.connect(stakers[0]).claim()
		})

		it('Should allow user to claim properly (claim 40%)', async () => {
			// Set claim with claim percent equal to 40%
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp, 500, 4000)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1300'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			// updateStaker with 100 tokens
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			// Skip some blocks and updateStakers again with 100 tokens
			await network.provider.send('evm_increaseTime', [100])
			await mine()
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			// Skip to claiming period
			await network.provider.send('evm_increaseTime', [900])
			await mine()
			// First claim - 40%
			await mproRewardStake.connect(stakers[0]).claim()
			let balanceClaim = await mproToken.balanceOf(stakers[0].address)
			await expect(balanceClaim).to.be.approximately(
				ethers.parseEther('480'),
				ethers.parseEther('5'),
			)
			// Skip to next claiming period
			await network.provider.send('evm_increaseTime', [500])
			await mine()
			// Should claim another 40%
			await mproRewardStake.connect(stakers[0]).claim()
			balanceClaim = await mproToken.balanceOf(stakers[0].address)
			await expect(balanceClaim).to.be.approximately(
				ethers.parseEther('960'),
				ethers.parseEther('10'),
			)
			// Skip to next claiming period
			await network.provider.send('evm_increaseTime', [500])
			await mine()
			// Should claim remaining 20%
			await mproRewardStake.connect(stakers[0]).claim()
			balanceClaim = await mproToken.balanceOf(stakers[0].address)
			await expect(balanceClaim).to.be.approximately(
				ethers.parseEther('1200'),
				ethers.parseEther('20'),
			)
		})

		it('Should calculate rewardPerSecond properly', async () => {
			// Before updateReward the rewardPerSecond should be equal to 0
			let rewardPerSecond = await mproRewardStake.rewardPerSecond()
			await expect(rewardPerSecond).to.equal(ethers.parseEther('0'))

			// Set claim config
			await mproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp, 100, 10000)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('2200'))
			// Check if rewardPerSecond is calculated properly after first updateReward
			const tx = await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			rewardPerSecond = await mproRewardStake.rewardPerSecond()
			const updateTimestamp = await getTxTimestamp(tx)
			// updateStakers with 100 tokens
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			// Skip some blocks and updateStakers again
			await network.provider.send('evm_increaseTime', [100])
			await mine()
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('100')])
			// Skip remaining declaration and updateStakers period
			await network.provider.send('evm_increaseTime', [400])
			await mine()
			// updateReward again (tokens from users that do not participate in stake)
			await mproRewardStake
				.connect(owner)
				.updateStakers([stakers[0].address], [ethers.parseEther('0')])
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			await mproRewardStake.connect(stakers[0]).claim()

			// User should get all his stakedTokens (200) + rewardCounting (1000 + 1000) - rewardCounting before he joined Autostake
			const balanceClaim = await mproToken.balanceOf(stakers[0].address)
			await expect(balanceClaim).to.be.approximately(
				ethers.parseEther('2200'),
				ethers.parseEther('20'),
			)
		})
	})

	describe('Testing full scenario on multiple stakers', () => {
		it('Should pass the full flow correctly on multiple stakers', async () => {
			const MPRORewardStakeFactory = (await ethers.getContractFactory(
				'contracts/MPROStake.sol:MPROAutoStake',
			)) as MPROAutoStake__factory

			const newMproRewardStake = await MPRORewardStakeFactory.connect(
				deployer,
			).deploy(
				mproToken.target, // MPRO token address

				owner.address, // New contract owner
			)
			stakeStartTimestamp =
				((await ethers.provider.getBlock('latest'))!.timestamp as number) + 100 // To make sure that the value is in the future
			stakeEndTimestamp = stakeStartTimestamp + stakeDuration
			await newMproRewardStake.connect(owner).setStakeConfig(
				stakeStartTimestamp, // Stake start timestamp
				stakeEndTimestamp, // Stake end timestamp,
				stakeStartTimestamp, // Update stakers start timestamp
				stakeEndTimestamp, // Update stakers end timestamp,
				stakeStartTimestamp, // Declaration start timestamp,
				stakeStartTimestamp + declarationDuration, // Declaration end timestamp,
			)
			mproToken
				.connect(owner)
				.increaseAllowance(newMproRewardStake.target, ethers.MaxUint256)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('99999999'))

			await newMproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			const localStakers = getDefinedStakersAmount(stakers, 10)

			const currentBlockTimestamp = (await (await ethers.provider.getBlock(
				'latest',
			))!.timestamp) as number
			const diffToStakeStart = stakeStartTimestamp - currentBlockTimestamp - 1
			await network.provider.send('evm_increaseTime', [diffToStakeStart])
			await mine()

			await newMproRewardStake.connect(owner).updateStakers(
				localStakers.map(el => el.address),
				localStakers.map(() => ethers.parseEther('1')),
			)
			const rewardPerTimeUnit = await newMproRewardStake.rewardPerSecond()
			expect(rewardPerTimeUnit).to.be.equal(
				BigNumber.from(ethers.parseEther('1000')).div(1000),
			)

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			const pendingRewards = await Promise.all(
				localStakers.map(async staker => {
					const reward = await newMproRewardStake.pendingReward(staker.address)
					return reward
				}),
			)

			expect(pendingRewards).to.be.deep.equal(
				localStakers.map(() =>
					BigNumber.from(rewardPerTimeUnit).mul(500).div(10).toBigInt(),
				),
			)

			await newMproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))

			await network.provider.send('evm_increaseTime', [600])
			await mine()

			await newMproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp, ONE_DAY, 10000)

			await Promise.all(
				localStakers.map(async staker => {
					await newMproRewardStake.connect(staker).claim()
				}),
			)

			const stakerBalances = await Promise.all(
				localStakers.map(async staker => {
					return await mproToken.balanceOf(staker.address)
				}),
			)
			const pendingRewards2 = await Promise.all(
				localStakers.map(async staker => {
					const reward = await newMproRewardStake.pendingReward(staker.address)
					return reward
				}),
			)

			const dust = await mproToken.balanceOf(newMproRewardStake.target)

			expect(dust).to.be.approximately(
				ethers.parseEther('0'),
				ethers.parseEther('0.00000000000001'),
			)
		})
	})

	describe('Failing tests from QA', () => {
		it('Should pass the full flow correctly on multiple stakers', async () => {
			const MPRORewardStakeFactory = (await ethers.getContractFactory(
				'contracts/MPROStake.sol:MPROAutoStake',
			)) as MPROAutoStake__factory

			const newMproRewardStake = await MPRORewardStakeFactory.connect(
				deployer,
			).deploy(
				mproToken.target, // MPRO token address
				owner.address, // New contract owner
			)
			stakeStartTimestamp =
				((await ethers.provider.getBlock('latest'))!.timestamp as number) + 100 // To make sure that the value is in the future
			stakeEndTimestamp = stakeStartTimestamp + stakeDuration
			await newMproRewardStake.connect(owner).setStakeConfig(
				stakeStartTimestamp, // Stake start timestamp
				stakeEndTimestamp, // Stake end timestamp,
				stakeStartTimestamp, // Update stakers start timestamp
				stakeEndTimestamp, // Update stakers end timestamp,
				stakeStartTimestamp, // Declaration start timestamp,
				stakeStartTimestamp + declarationDuration, // Declaration end timestamp,
			)
			mproToken
				.connect(owner)
				.increaseAllowance(newMproRewardStake.target, ethers.MaxUint256)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('99999999'))

			await newMproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('50'))
			const localStakers = getDefinedStakersAmount(stakers, 1)

			const currentBlockTimestamp = (await (await ethers.provider.getBlock(
				'latest',
			))!.timestamp) as number
			const diffToStakeStart = stakeStartTimestamp - currentBlockTimestamp - 1
			await network.provider.send('evm_increaseTime', [diffToStakeStart])
			await mine()

			await newMproRewardStake.connect(owner).updateStakers(
				localStakers.map(el => el.address),
				localStakers.map(() => ethers.parseEther('20')),
			)

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			await newMproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('75'))

			await network.provider.send('evm_increaseTime', [250])
			await mine()

			await newMproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('100'))

			await network.provider.send('evm_increaseTime', [600])
			await mine()

			await newMproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp, ONE_DAY, 10000)

			await newMproRewardStake.connect(localStakers[0]).claim()

			const stakerBalance = await mproToken.balanceOf(localStakers[0].address)
			const stakerData = await newMproRewardStake.staker(
				localStakers[0].address,
			)
		})
	})

	describe('Testing claiming before stake ends', () => {
		it('Allow to claim reward before stake ends', async function () {
			const MPRORewardStakeFactory = (await ethers.getContractFactory(
				'contracts/MPROStake.sol:MPROAutoStake',
			)) as MPROAutoStake__factory

			const newMproRewardStake = await MPRORewardStakeFactory.connect(
				deployer,
			).deploy(
				mproToken.target, // MPRO token address
				owner.address, // New contract owner
			)
			stakeStartTimestamp =
				((await ethers.provider.getBlock('latest'))!.timestamp as number) + 100 // To make sure that the value is in the future
			stakeEndTimestamp = stakeStartTimestamp + stakeDuration
			await newMproRewardStake.connect(owner).setStakeConfig(
				stakeStartTimestamp, // Stake start timestamp
				stakeEndTimestamp, // Stake end timestamp,
				stakeStartTimestamp, // Update stakers start timestamp
				stakeEndTimestamp, // Update stakers end timestamp,
				stakeStartTimestamp, // Declaration start timestamp,
				stakeStartTimestamp + declarationDuration, // Declaration end timestamp,
			)

			await newMproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp - 500, 100, 2000)
			mproToken
				.connect(owner)
				.increaseAllowance(newMproRewardStake.target, ethers.MaxUint256)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('99999999'))

			await newMproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))

			const localStakers = getDefinedStakersAmount(stakers, 1)

			const currentBlockTimestamp = (await (await ethers.provider.getBlock(
				'latest',
			))!.timestamp) as number
			const diffToStakeStart = stakeStartTimestamp - currentBlockTimestamp - 1
			await network.provider.send('evm_increaseTime', [diffToStakeStart])
			await mine()

			await newMproRewardStake.connect(owner).updateStakers(
				localStakers.map(el => el.address),
				localStakers.map(() => ethers.parseEther('1')),
			)

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			await newMproRewardStake.connect(localStakers[0]).claim()

			const stakerData = await newMproRewardStake.staker(
				localStakers[0].address,
			)

			console.log('====================================')
			console.log('pending', stakerData)
			console.log('====================================')

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			await newMproRewardStake.connect(localStakers[0]).claim()

			const stakerBalance = await mproToken.balanceOf(localStakers[0].address)
			const stakerData2 = await newMproRewardStake.staker(
				localStakers[0].address,
			)
			console.log('====================================')
			console.log('stakerBalance', stakerBalance.toString(), stakerData2)
			console.log('====================================')
		})
	})

	describe.only('Prod flow', () => {
		it('Allow to claim reward before stake ends', async function () {
			const MPRORewardStakeFactory = (await ethers.getContractFactory(
				'contracts/MPROStake.sol:MPROAutoStake',
			)) as MPROAutoStake__factory

			const newMproRewardStake = await MPRORewardStakeFactory.connect(
				deployer,
			).deploy(
				mproToken.target, // MPRO token address
				owner.address, // New contract owner
			)
			stakeStartTimestamp =
				((await ethers.provider.getBlock('latest'))!.timestamp as number) + 100 // To make sure that the value is in the future
			stakeEndTimestamp = stakeStartTimestamp + stakeDuration
			await newMproRewardStake.connect(owner).setStakeConfig(
				stakeStartTimestamp, // Stake start timestamp
				stakeEndTimestamp, // Stake end timestamp,
				stakeStartTimestamp, // Update stakers start timestamp
				stakeEndTimestamp, // Update stakers end timestamp,
				stakeStartTimestamp, // Declaration start timestamp,
				stakeStartTimestamp + declarationDuration, // Declaration end timestamp,
			)

			await newMproRewardStake
				.connect(owner)
				.setClaimRewardConfig(stakeEndTimestamp - 500, 100, 2000)
			mproToken
				.connect(owner)
				.increaseAllowance(newMproRewardStake.target, ethers.MaxUint256)
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('99999999'))

			const currentBlockTimestamp = (await (await ethers.provider.getBlock(
				'latest',
			))!.timestamp) as number
			const diffToStakeStart = stakeStartTimestamp - currentBlockTimestamp - 1
			console.log('====================================')
			console.log(diffToStakeStart)
			console.log('====================================')
			await network.provider.send('evm_increaseTime', [diffToStakeStart])
			await mine()

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			await newMproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))

			const localStakers = getDefinedStakersAmount(stakers, 1)

			await newMproRewardStake.connect(owner).updateStakers(
				localStakers.map(el => el.address),
				localStakers.map(() => ethers.parseEther('1')),
			)

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			const stakerData = await newMproRewardStake.staker(
				localStakers[0].address,
			)

			const pendingReward = await newMproRewardStake.pendingReward(
				localStakers[0].address,
			)

			console.log('====================================')
			console.log(stakerData, pendingReward)
			console.log('====================================')
		})
	})
})
