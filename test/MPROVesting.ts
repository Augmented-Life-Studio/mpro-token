import { expect } from "chai";
import { ethers, network } from "hardhat";
import { mine } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { MPROVesting, ERC20, MPROVesting__factory, WhoaToken__factory } from "../typechain-types";

// npx hardhat test test/MPROVesting.ts

const ONE_DAY = 60 * 60 * 24;

describe("MPROVesting", function () {
    let erc20: ERC20;
    let mproVesting: MPROVesting;
    let deployer: HardhatEthersSigner, owner: HardhatEthersSigner, ben1: HardhatEthersSigner, ben2: HardhatEthersSigner, ben3: HardhatEthersSigner, ben4: HardhatEthersSigner;
    let TGE_UNLOCK_DELAY: number
    let TGE_UNLOCK_TIMESTAMP: number
    let CLIFF_DELAY: number
    const TGE_UNLOCK_PERCENT: number = 1000
    const VESTING_UNLOCK_PERCENT = 1000
    const UNLOCK_PERCENT_DIVIDER = 10000

    const getTgeUnlockAmount = (amount: number) => amount * TGE_UNLOCK_PERCENT / UNLOCK_PERCENT_DIVIDER;
    const getVestingUnlockAmount = (amount: number, vestingPeriod: number) => (amount * VESTING_UNLOCK_PERCENT / UNLOCK_PERCENT_DIVIDER) * vestingPeriod;

    beforeEach(async function () {
        [deployer, owner
            , ben1, ben2, ben3, ben4] = await ethers.getSigners();

        const ERC20Factory: WhoaToken__factory = await ethers.getContractFactory("WhoaToken");
        erc20 = await ERC20Factory.deploy("ERC20", "ERC20", ethers.parseUnits("100000"), deployer.address);

        expect(await erc20.balanceOf(deployer.address)).to.equal(ethers.parseUnits("100000"));

        const erc20DeploymentTimestamp = erc20.deploymentTransaction()?.blockNumber as number;

        const currentTimestamp = (await ethers.provider.getBlock(erc20DeploymentTimestamp))!.timestamp as number;

        TGE_UNLOCK_DELAY = ONE_DAY
        TGE_UNLOCK_TIMESTAMP = currentTimestamp + ONE_DAY;
        CLIFF_DELAY = ONE_DAY * 30;

        const MPROVestingFactory: MPROVesting__factory = await ethers.getContractFactory("MPROVesting");
        mproVesting = await MPROVestingFactory.deploy(
            erc20.target,
            TGE_UNLOCK_TIMESTAMP,
            TGE_UNLOCK_PERCENT,
            CLIFF_DELAY,
            VESTING_UNLOCK_PERCENT,
            ONE_DAY,
            deployer.address
        );

        await erc20.connect(deployer).transfer(mproVesting.target, ethers.parseUnits("100000"));
        expect(await erc20.balanceOf(mproVesting.target)).to.equal(ethers.parseUnits("100000"));
    });

    describe("constructor()", function () {
        it("Should properly deploy and set initial values", async function () {
            expect(await mproVesting.token()).to.equal(erc20.target);
            expect(await mproVesting.tgeUnlockTimestamp()).to.equal(TGE_UNLOCK_TIMESTAMP);
            expect(await mproVesting.tgeUnlockPercent()).to.equal(1000);
            expect(await mproVesting.cliffTimestamp()).to.equal(TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY);
            expect(await mproVesting.vestingUnlockPercentPerPeriod()).to.equal(1000);
            expect(await mproVesting.vestingPeriodDuration()).to.equal(ONE_DAY);
        });
    });

    describe("setTgeUnlockTimestamp() function", function () {
        it("Should properly set TGE unlock timestamp", async function () {
            await mproVesting.connect(deployer).setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + 100);
            expect(await mproVesting.tgeUnlockTimestamp()).to.equal(TGE_UNLOCK_TIMESTAMP + 100);
        })
        it("Should return error when called by non-owner", async function () {
            await expect(mproVesting.connect(ben1).setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + 100)).to.be.revertedWith("Ownable: caller is not the owner");
        })
        it("Should emit SetTgeUnlockTimestamp event", async function () {
            await expect(mproVesting.connect(deployer).setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + 100)).to.emit(mproVesting, "SetTgeUnlockTimestamp").withArgs(TGE_UNLOCK_TIMESTAMP + 100);
        })
    })

    describe("registerBeneficiaries() function", function () {
        it("Should properly register beneficiaries", async function () {
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address, ben2.address, ben3.address, ben4.address], [1000, 2000, 3000, 4000]);
            expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
            expect(await mproVesting.connect(ben2).claimBalance()).to.equal(2000);
            expect(await mproVesting.connect(ben3).claimBalance()).to.equal(3000);
            expect(await mproVesting.connect(ben4).claimBalance()).to.equal(4000);
        })
        it("Should update beneficiaries when called again", async function () {
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [1000]);
            expect(await mproVesting.connect(
                ben1
            ).claimBalance()).to.equal(1000);
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [5000]);
            expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
        })
        it("Should return error in register beneficiaries when called by non-owner", async function () {
            await expect(mproVesting.connect(ben1).registerBeneficiaries([ben1.address], [1000])).to.be.revertedWith("Ownable: caller is not the owner");
        })
        it("Should return error when register beneficiaries length is not equal", async function () {
            await expect(mproVesting.connect(deployer).registerBeneficiaries([ben1.address, ben2.address], [1000])).to.be.revertedWith("Vesting: Invalid input lengths");
        })
        it("Should return error when one of beneficiaries is zero address", async function () {
            await expect(mproVesting.connect(deployer).registerBeneficiaries([ben1.address, ethers.ZeroAddress], [1000, 1000])).to.be.revertedWith("Vesting: Invalid beneficiary");
        })
        it("Should set to claimed balance when beneficiary is updated to lower than claimed balance", async function () {
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [1000]);
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
            await mine();
            await mproVesting.connect(ben1).claim();
            const claimed = await mproVesting.connect(ben1).claimed();
            const amountToUpdate = 50;
            expect(claimed).to.be.greaterThan(amountToUpdate);
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [amountToUpdate]);
            expect(await mproVesting.connect(ben1).claimed()).to.equal(claimed);
        })
    })
    describe("claimBalance() function", function () {
        it("Should return proper value when called by beneficiary", async function () {
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [1000]);
            expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
        })
    })
    describe("claimed() function", function () {
        it("Should return proper value when called by beneficiary", async function () {
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [1000]);
            expect(await mproVesting.connect(ben1).claimed()).to.equal(0);
        })
        it("Should return proper value when called by beneficiary after claim", async function () {
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [1000]);
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
            await mine();
            await mproVesting.connect(ben1).claim();
            expect(await mproVesting.connect(ben1).claimed()).to.equal(getTgeUnlockAmount(1000));
        })
    })
    describe("enableForRelease() function", function () {
        const userAmount = 1000;

        beforeEach(async function () {
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [userAmount]);
        })
        it(`Should return proper amount when TGE_UNLOCK_TIMESTAMP is not reached`, async function () {
            expect(await mproVesting.enableForRelease(ben1.address)).to.equal(0);
        })
        it(`Should return proper amount when TGE_UNLOCK_TIMESTAMP is reached`, async function () {
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
            await mine();
            expect(Number((await mproVesting.enableForRelease(ben1.address)).toString())).to.equal(userAmount * TGE_UNLOCK_PERCENT / UNLOCK_PERCENT_DIVIDER);
        })
        it("Should return 0 when caller is not register and TGE_UNLOCK_TIMESTAMP is reached", async function () {
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
            await mine();
            expect(Number((await mproVesting.enableForRelease(ben2.address)).toString())).to.equal(0);
        })
        it(`Should return proper amount when CLIFF_TIMESTAMP is reached`, async function () {
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY + CLIFF_DELAY]);
            await mine();
            expect(Number((await mproVesting.enableForRelease(ben1.address)).toString())).to.equal(getTgeUnlockAmount(userAmount) + getVestingUnlockAmount(userAmount, 1));
        })
        it("Should return proper amounts on every vesting period", async function () {
            const periodsArray = new Array(20).fill(0).map((_, i) => i + 1);
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY + CLIFF_DELAY]);
            await mine();
            for (const period of periodsArray) {
                let expectedAmount = getTgeUnlockAmount(userAmount) + getVestingUnlockAmount(userAmount, (period));
                if (expectedAmount > userAmount) {
                    expectedAmount = userAmount;
                }
                expect(Number((await mproVesting.enableForRelease(ben1.address)).toString())).to.equal(expectedAmount);
                await network.provider.send("evm_increaseTime", [ONE_DAY]);
                await mine();
            }
        })
    })
    describe("claim() function", function () {
        const userAmount = 1000;
        beforeEach(async function () {
            await mproVesting.connect(deployer).registerBeneficiaries([ben1.address], [userAmount]);
        })
        it("Should block claim when called before TGE_UNLOCK_TIMESTAMP", async function () {
            await expect(mproVesting.connect(ben1).claim()).to.be.revertedWith("Vesting: Not yet unlocked");
        })
        it("Should claim proper amount when called after TGE_UNLOCK_TIMESTAMP", async function () {
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
            await mine();
            await mproVesting.connect(ben1).claim();
            expect(await erc20.balanceOf(ben1.address)).to.equal(getTgeUnlockAmount(userAmount));
        })
        it("Should return error when called twice bofore TGE_UNLOCK_TIMESTAMP", async function () {
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
            await mine();
            await mproVesting.connect(ben1).claim();
            await expect(mproVesting.connect(ben1).claim()).to.be.revertedWith("Vesting: No tokens to release");
        })
        it("Should claim proper amount when called after CLIFF_TIMESTAMP", async function () {
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY + CLIFF_DELAY]);
            await mine();
            await mproVesting.connect(ben1).claim();
            expect(await erc20.balanceOf(ben1.address)).to.equal(getTgeUnlockAmount(userAmount) + getVestingUnlockAmount(userAmount, 1));
        })
        it("Should claim proper amounts on every vesting period", async function () {
            const periodsArray = new Array(20).fill(0).map((_, i) => i + 1);
            await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY + CLIFF_DELAY]);
            await mine();
            for (const period of periodsArray) {
                let expectedAmount = getTgeUnlockAmount(userAmount) + getVestingUnlockAmount(userAmount, (period));
                if (expectedAmount > userAmount) {
                    await expect(mproVesting.connect(ben1).claim()).to.be.revertedWith("Vesting: No tokens to release");
                } else {
                    await mproVesting.connect(ben1).claim();
                    expect(await erc20.balanceOf(ben1.address)).to.equal(expectedAmount);

                }
                await network.provider.send("evm_increaseTime", [ONE_DAY]);
                await mine();
            }
        })
    })

});