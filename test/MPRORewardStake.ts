import {expect} from 'chai'
import {ethers, network} from 'hardhat'
import {HardhatEthersSigner} from '@nomicfoundation/hardhat-ethers/signers'
import {mine} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import {
	MPRORewardStake,
	MPRORewardStake__factory,
	MPROTest,
	MPROTest__factory,
} from '../typechain-types'

// npx hardhat test test/MPRORewardStake.ts

const stakeDuration = 1000
const declarationDuration = 500

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

	beforeEach(async function () {
		;[deployer, owner, ...stakers] = await ethers.getSigners()

		const MPROTestFactory = (await ethers.getContractFactory(
			'contracts/mocks/MPROTest.sol:MPROTest',
		)) as MPROTest__factory
		mproToken = await MPROTestFactory.deploy()

		const MPRORewardStakeFactory = (await ethers.getContractFactory(
			'contracts/MPRORewardStake.sol:MPRORewardStake',
		)) as MPRORewardStake__factory
		const currentBlockTimestamp = (await ethers.provider.getBlock('latest'))!
			.timestamp as number
		mproRewardStake = await MPRORewardStakeFactory.connect(deployer).deploy(
			mproToken.target, // MPRO token address
			currentBlockTimestamp, // Stake start timestamp
			currentBlockTimestamp + stakeDuration, // Stake end timestamp,
			currentBlockTimestamp + declarationDuration, // Declaration end timestamp,
			owner.address, // New contract owner
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
		it('Should update reward', async function () {
			await mproToken.connect(owner).distibute(owner.address, 1000)
			await mproRewardStake.connect(owner).updateReward(1000)
			expect(await mproToken.balanceOf(mproRewardStake.target)).to.equal(1000)
			expect(await mproRewardStake.rewardTokenQuantity()).to.equal(1000)
			// MPRO tokens reward per second
			expect(await mproRewardStake.rewardRate()).to.equal(1)
		})
	})

	describe('updateStakersWithCompound() function', function () {
		it('Should update stakers with compound', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			const localStakers = getDefinedStakersAmount(stakers, 5)

			await mproRewardStake.connect(owner).updateStakers(
				localStakers.map(s => s.address),
				localStakers.map(() => ethers.parseEther('1')),
			)
			await mproToken
				.connect(owner)
				.distibute(mproRewardStake.target, ethers.parseEther('5'))

			await network.provider.send('evm_increaseTime', [600])
			await mine()

			await mproRewardStake.connect(owner).updateStakers(
				localStakers.map(s => s.address),
				localStakers.map(() => ethers.parseEther('1')),
			)
			await mproToken
				.connect(owner)
				.distibute(mproRewardStake.target, ethers.parseEther('5'))

			await network.provider.send('evm_increaseTime', [2000])
			await mine()

			// await mproRewardStake
			// 	.connect(owner)
			// 	.compoundStakers(localStakers.map(s => s.address))
			for (let i = 0; i < localStakers.length; i++) {
				await mproRewardStake
					.connect(localStakers[i])
					.updateWalletReward(localStakers[i].address)
				console.log(
					await mproRewardStake.balanceToClaim(localStakers[i].address),
					'balanceToClaim',
				)
			}

			console.log(
				await mproRewardStake.rewardTokenQuantity(),
				'rewardTokenQuantity',
			)

			console.log(
				await mproToken.balanceOf(mproRewardStake.target),
				'mproRewardStake balanceOf mproToken',
			)
		})
	})

	describe('updateStakerWithCompound() function', function () {
		it('Should update stakers with compound', async function () {
			await mproToken
				.connect(owner)
				.distibute(owner.address, ethers.parseEther('1000'))
			await mproRewardStake
				.connect(owner)
				.updateReward(ethers.parseEther('1000'))
			const localStaker = getDefinedStakersAmount(stakers, 1)

			await mproRewardStake.connect(owner).updateStakers(
				localStaker.map(s => s.address),
				localStaker.map(() => ethers.parseEther('10')),
			)
			await mproToken
				.connect(owner)
				.distibute(mproRewardStake.target, ethers.parseEther('10'))

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			await mproRewardStake.connect(owner).updateStakers(
				localStaker.map(s => s.address),
				localStaker.map(() => ethers.parseEther('10')),
			)
			await mproToken
				.connect(owner)
				.distibute(mproRewardStake.target, ethers.parseEther('10'))

			await network.provider.send('evm_increaseTime', [500])
			await mine()

			await mproRewardStake
				.connect(localStaker[0])
				.updateWalletReward(localStaker[0].address)

			console.log(
				await mproRewardStake.connect(owner).staked(localStaker[0].address),
				'staked',
			)
			console.log(
				await mproRewardStake
					.connect(owner)
					.balanceToClaim(localStaker[0].address),
				'balanceToClaim',
			)
			console.log(
				await mproRewardStake.rewardTokenQuantity(),
				'rewardTokenQuantity',
			)

			console.log(
				await mproToken.balanceOf(mproRewardStake.target),
				'mproRewardStake balanceOf mproToken',
			)
		})
	})
})
