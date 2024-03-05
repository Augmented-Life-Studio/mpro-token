import { expect } from "chai";
import { ethers, network } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MPROVesting,
  ERC20,
  MPROVesting__factory,
  WhoaToken__factory,
} from "../typechain-types";

// npx hardhat test test/MPROVesting.ts

const ONE_DAY = 60 * 60 * 24;

describe("MPROVesting", function () {
  let erc20: ERC20;
  let mproVesting: MPROVesting;
  let deployer: HardhatEthersSigner,
    owner: HardhatEthersSigner,
    ben1: HardhatEthersSigner,
    ben2: HardhatEthersSigner,
    ben3: HardhatEthersSigner,
    ben4: HardhatEthersSigner;
  let TGE_UNLOCK_DELAY: number;
  let TGE_UNLOCK_TIMESTAMP: number;
  let CLIFF_DELAY: number;
  let VESTING_PERIOD_DURATION: number;
  const TGE_UNLOCK_PERCENT: number = 1000;
  const VESTING_UNLOCK_PERCENT = 1000;
  const UNLOCK_PERCENT_DIVIDER = 10000;

  const getTgeUnlockAmount = (amount: number) =>
    (amount * TGE_UNLOCK_PERCENT) / UNLOCK_PERCENT_DIVIDER;
  const getVestingUnlockAmount = (amount: number, vestingPeriod: number) =>
    ((amount * VESTING_UNLOCK_PERCENT) / UNLOCK_PERCENT_DIVIDER) *
    vestingPeriod;

  beforeEach(async function () {
    [deployer, owner, ben1, ben2, ben3, ben4] = await ethers.getSigners();

    const ERC20Factory: WhoaToken__factory = await ethers.getContractFactory(
      "WhoaToken"
    );
    erc20 = await ERC20Factory.deploy(
      "ERC20",
      "ERC20",
      ethers.parseUnits("100000"),
      deployer.address
    );

    expect(await erc20.balanceOf(deployer.address)).to.equal(
      ethers.parseUnits("100000")
    );

    const erc20DeploymentTimestamp = erc20.deploymentTransaction()
      ?.blockNumber as number;

    const currentTimestamp = (await ethers.provider.getBlock(
      erc20DeploymentTimestamp
    ))!.timestamp as number;

    TGE_UNLOCK_DELAY = ONE_DAY;
    TGE_UNLOCK_TIMESTAMP = currentTimestamp + ONE_DAY;
    CLIFF_DELAY = ONE_DAY * 30;
    VESTING_PERIOD_DURATION = ONE_DAY;

    const MPROVestingFactory: MPROVesting__factory =
      await ethers.getContractFactory("MPROVesting");
    mproVesting = await MPROVestingFactory.deploy(
      TGE_UNLOCK_TIMESTAMP,
      TGE_UNLOCK_PERCENT,
      CLIFF_DELAY,
      VESTING_UNLOCK_PERCENT,
      VESTING_PERIOD_DURATION,
      deployer.address
    );

    await mproVesting.connect(deployer).setVestingToken(erc20.target);

    await erc20
      .connect(deployer)
      .transfer(mproVesting.target, ethers.parseUnits("100000"));
    expect(await erc20.balanceOf(mproVesting.target)).to.equal(
      ethers.parseUnits("100000")
    );
  });

  describe("Deployment", function () {
    it("Should properly deploy and set initial values", async function () {
      expect(await mproVesting.tgeUnlockTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP
      );
      expect(await mproVesting.tgeUnlockPercent()).to.equal(1000);
      expect(await mproVesting.cliffTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY
      );
      expect(await mproVesting.vestingUnlockPercentPerPeriod()).to.equal(1000);
      expect(await mproVesting.vestingPeriodDuration()).to.equal(ONE_DAY);
    });
  });

  describe("setTgeUnlockTimestamp function", function () {
    it("Should properly setTgeUnlockTimestamp", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
    });

    it("Should emit SetTgeUnlockTimestamp event", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + 100)
      )
        .to.emit(mproVesting, "SetTgeUnlockTimestamp")
        .withArgs(TGE_UNLOCK_TIMESTAMP + 100);
    });

    it("Should revert when caller is not the owner", async function () {
      await expect(
        mproVesting.connect(ben1).setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert when timestamp is in the past", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP - ONE_DAY * 2)
      ).to.be.revertedWith(
        "Vesting: TGE unlock time cannot be lower than current time"
      );
    });

    it("Should revert when timestamp is set to current time", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP - ONE_DAY)
      ).to.be.revertedWith(
        "Vesting: TGE unlock time cannot be lower than current time"
      );
    });

    it("Should not revert when setting TgeUnlockTimestsamp again (higher timestamp)", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY)
      ).to.not.be.reverted;
    });

    it("Should not revert when setting TgeUnlockTimestsamp again (lower timestamp)", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY * 5)
      ).to.not.be.reverted;
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY)
      ).to.not.be.reverted;
    });

    it("Should not revert when setting TgeUnlockTimestsamp again (the same timestamps)", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY)
      ).to.not.be.reverted;
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY)
      ).to.not.be.reverted;
    });

    it("Should revert when timestamp is higher than predefined deadline", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY)
      ).to.be.revertedWith(
        "Vesting: TGE unlock time must be less than tgeUnlockTimestampDeadline"
      );
    });

    it("Should not revert when timestamp is equal to predefined deadline", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY - ONE_DAY)
      ).to.not.be.reverted;
    });

    it("Should revert when trying to set new tgeUnlockTimestamp after deadline (first timestamp already passed)", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY,
      ]);
      await mine();

      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(
            TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY + ONE_DAY * 1
          )
      ).to.be.revertedWith(
        "Vesting: TGE unlock time must be less than tgeUnlockTimestampDeadline"
      );
    });
  });

  describe("setVestingToken function", function () {
    let vestingContract: MPROVesting;
    beforeEach(async function () {
      const MPROVestingFactory: MPROVesting__factory =
        await ethers.getContractFactory("MPROVesting");
      vestingContract = await MPROVestingFactory.deploy(
        TGE_UNLOCK_TIMESTAMP,
        TGE_UNLOCK_PERCENT,
        CLIFF_DELAY,
        VESTING_UNLOCK_PERCENT,
        VESTING_PERIOD_DURATION,
        deployer.address
      );
    })
    it("Should properly setVestingToken only by owner", async function () {
      await expect(
        vestingContract.connect(deployer).setVestingToken(erc20.target)
      ).to.not.be.reverted;
    });
    it("Should revert when caller is owner and vesting token is zero address", async function () {
      await expect(
        vestingContract.connect(deployer).setVestingToken(ethers.ZeroAddress)
      ).to.be.revertedWith("Vesting: Invalid vesting token");
    })
    it("Should revert when caller is not owner", async function () {
      await expect(
        vestingContract.connect(ben1).setVestingToken(erc20.target)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    })
    it("Should revert when caller is owner and vesting token is already set", async function () {
      await expect(
        vestingContract.connect(deployer).setVestingToken(erc20.target)
      ).to.not.be.reverted;
      await expect(
        vestingContract.connect(deployer).setVestingToken(erc20.target)
      ).to.be.revertedWith("Vesting: Token already set");
    })
  });

  describe("registerBeneficiaries function", function () {
    it("Should properly register beneficiaries", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries(
          [ben1.address, ben2.address, ben3.address, ben4.address],
          [1000, 2000, 3000, 4000]
        );
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      expect(await mproVesting.connect(ben2).claimBalance()).to.equal(2000);
      expect(await mproVesting.connect(ben3).claimBalance()).to.equal(3000);
      expect(await mproVesting.connect(ben4).claimBalance()).to.equal(4000);
    });

    it("Should update beneficiaries when called again (more tokens)", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
    });

    it("Should return error in register beneficiaries when called by non-owner", async function () {
      await expect(
        mproVesting.connect(ben1).registerBeneficiaries([ben1.address], [1000])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should return error when register beneficiaries length is not equal (less amounts)", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .registerBeneficiaries([ben1.address, ben2.address], [1000])
      ).to.be.revertedWith("Vesting: Invalid input lengths");
    });

    it("Should return error when one of beneficiaries is zero address", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .registerBeneficiaries(
            [ben1.address, ethers.ZeroAddress],
            [1000, 1000]
          )
      ).to.be.revertedWith("Vesting: Invalid beneficiary");
    });
    it("Should return error when register beneficiaries length is not equal (less addresses)", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .registerBeneficiaries([ben1.address], [1000, 2000])
      ).to.be.revertedWith("Vesting: Invalid input lengths");
    });

    it("Should throw error when beneficiary's address is invalid", async function () {
      try {
        await expect(
          mproVesting
            .connect(deployer)
            .registerBeneficiaries(["0x123", ben2.address], [1000, 2000])
        ).to.not.be.reverted;
        throw new Error("Register successful - should not be");
      } catch (error) {
        if (
          error ==
          "NotImplementedError: Method 'HardhatEthersProvider.resolveName' is not implemented"
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should not revert when amount is equal to zero", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .registerBeneficiaries([ben1.address, ben2.address], [1000, 0])
      ).to.not.be.reverted;
    });

    it("Should throw error when amount is invalid", async function () {
      try {
        await expect(
          mproVesting
            .connect(deployer)
            .registerBeneficiaries([ben1.address, ben2.address], [1000, -200])
        ).to.not.be.reverted;
        throw new Error("Register successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="", value=-200, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should throw error when amount is empty", async function () {
      try {
        await expect(
          mproVesting
            .connect(deployer)
            .registerBeneficiaries([ben1.address, ben2.address], [1000, ""])
        ).to.not.be.reverted;
        throw new Error("Register successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid BigNumberish string: empty string (argument="value", value="", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should update beneficiaries when called again (less tokens)", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
    });

    it("Should update beneficiaries when called again (the same number of tokens)", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
    });

    it("Should properly register and update beneficiaries after predefined deadline", async function () {
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY,
      ]);
      await mine();
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
    });

    it("Should properly update beneficiary's amount to zero tokens", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [0]);
      await expect(mproVesting.connect(ben1).claimBalance()).to.be.revertedWith(
        "MPROVesting: Account is not a beneficiary"
      );
    });

    it("Should not delete previous beneficiaries when called again", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries(
          [ben1.address, ben2.address, ben3.address, ben4.address],
          [1000, 2000, 3000, 4000]
        );
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      expect(await mproVesting.connect(ben2).claimBalance()).to.equal(2000);
      expect(await mproVesting.connect(ben3).claimBalance()).to.equal(3000);
      expect(await mproVesting.connect(ben4).claimBalance()).to.equal(4000);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries(
          [ben1.address, ben2.address, ben3.address, owner.address],
          [1000, 2000, 3000, 500]
        );
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      expect(await mproVesting.connect(ben2).claimBalance()).to.equal(2000);
      expect(await mproVesting.connect(ben3).claimBalance()).to.equal(3000);
      expect(await mproVesting.connect(ben4).claimBalance()).to.equal(4000);
      expect(await mproVesting.connect(owner).claimBalance()).to.equal(500);
    });

    it("Should not revert when called with empty args", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries(
          [ben1.address, ben2.address, ben3.address, ben4.address],
          [1000, 2000, 3000, 4000]
        );
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      expect(await mproVesting.connect(ben2).claimBalance()).to.equal(2000);
      expect(await mproVesting.connect(ben3).claimBalance()).to.equal(3000);
      expect(await mproVesting.connect(ben4).claimBalance()).to.equal(4000);
      await mproVesting.connect(deployer).registerBeneficiaries([], []);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      expect(await mproVesting.connect(ben2).claimBalance()).to.equal(2000);
      expect(await mproVesting.connect(ben3).claimBalance()).to.equal(3000);
      expect(await mproVesting.connect(ben4).claimBalance()).to.equal(4000);
    });

    it("Should not revert when called with very high amount", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address, ben2.address], [1000, 500000000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      expect(await mproVesting.connect(ben2).claimBalance()).to.equal(
        500000000
      );
    });

    it("Should set to claimed balance when beneficiary is updated to lower than claimed balance", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      await mproVesting.connect(ben1).claim();
      const claimed = await mproVesting.connect(ben1).claimedAllocation();
      const amountToUpdate = 50;
      expect(claimed).to.be.greaterThan(amountToUpdate);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [amountToUpdate]);
      expect(await mproVesting.connect(ben1).claimedAllocation()).to.equal(
        claimed
      );
    });
  });

  describe("claimBalance function", function () {
    it("Should properly claimBalance", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
    });

    it("Should revert when called by non-owner", async function () {
      await expect(mproVesting.connect(ben1).claimBalance()).to.be.revertedWith(
        "MPROVesting: Account is not a beneficiary"
      );
    });

    it("Should return the right number of tokens before TGE_UNLOCK_TIMESTAMP", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
    });

    it("Should return the right number of tokens after TGE_UNLOCK_TIMESTAMP", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
    });

    it("Should return the right number of tokens again after increasing registerBeneficiaries amount before TGE_UNLOCK_TIMESTAMP", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [6000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(6000);
    });

    it("Should return the right number of tokens again after decresing registerBeneficiaries amount after TGE_UNLOCK_TIMESTAMP", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
    });

    it("Should return right number of tokens after predefined deadline", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [5000]);
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY,
      ]);
      await mine();
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(5000);
    });
  });

  describe("claimedAllocation function", function () {
    it("Should properly return claimed tokens", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      await mproVesting.connect(ben1).claim();
      expect(await mproVesting.connect(ben1).claimedAllocation()).to.equal(100);
    });

    it("Should revert when caller is not beneficiary", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      await mproVesting.connect(ben1).claim();
      await expect(
        mproVesting.connect(owner).claimedAllocation()
      ).to.be.revertedWith("MPROVesting: Account is not a beneficiary");
    });

    it("Should revert when vesting is not yet unlocked", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      await expect(mproVesting.connect(ben1).claim()).to.be.revertedWith(
        "Vesting: Not yet unlocked"
      );
      await expect(
        await mproVesting.connect(ben1).claimedAllocation()
      ).to.equal(0);
    });

    it("Should return correct number of claimed tokens after claiming (after a few days)", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY + ONE_DAY * 3,
      ]);
      await mine();
      await expect(mproVesting.connect(ben1).claim()).to.not.be.reverted;
      await expect(
        await mproVesting.connect(ben1).claimedAllocation()
      ).to.equal(500);
    });

    it("Should return correct number of claimed tokens after claiming (all tokens)", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY + ONE_DAY * 8,
      ]);
      await mine();
      await expect(mproVesting.connect(ben1).claim()).to.not.be.reverted;
      await expect(
        await mproVesting.connect(ben1).claimedAllocation()
      ).to.equal(1000);
    });

    it("Should return correct number of claimed tokens after claiming twice", async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [1000]);
      expect(await mproVesting.connect(ben1).claimBalance()).to.equal(1000);
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY,
      ]);
      await mine();
      await expect(mproVesting.connect(ben1).claim()).to.not.be.reverted;
      await expect(
        await mproVesting.connect(ben1).claimedAllocation()
      ).to.equal(200);
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      await expect(mproVesting.connect(ben1).claim()).to.not.be.reverted;
      await expect(
        await mproVesting.connect(ben1).claimedAllocation()
      ).to.equal(300);
    });
  });

  describe("enableForRelease", function () {
    const userAmount = 1000;

    beforeEach(async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [userAmount]);
    });

    it("Should return proper amount when TGE_UNLOCK_TIMESTAMP is not reached", async function () {
      expect(await mproVesting.connect(ben1).enableForRelease()).to.equal(0);
    });

    it("Should return proper amount when TGE_UNLOCK_TIMESTAMP is reached", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      expect(
        Number((await mproVesting.connect(ben1).enableForRelease()).toString())
      ).to.equal((userAmount * TGE_UNLOCK_PERCENT) / UNLOCK_PERCENT_DIVIDER);
    });

    it("Should return proper amount when CLIFF_TIMESTAMP is reached", async function () {
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY,
      ]);
      await mine();
      expect(
        Number((await mproVesting.connect(ben1).enableForRelease()).toString())
      ).to.equal(
        getTgeUnlockAmount(userAmount) + getVestingUnlockAmount(userAmount, 1)
      );
    });

    it("Should return proper amounts on every vesting period", async function () {
      const periodsArray = new Array(20).fill(0).map((_, i) => i + 1);
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY,
      ]);
      await mine();
      for (const period of periodsArray) {
        let expectedAmount =
          getTgeUnlockAmount(userAmount) +
          getVestingUnlockAmount(userAmount, period);
        if (expectedAmount > userAmount) {
          expectedAmount = userAmount;
        }
        expect(
          Number(
            (await mproVesting.connect(ben1).enableForRelease()).toString()
          )
        ).to.equal(expectedAmount);
        await network.provider.send("evm_increaseTime", [ONE_DAY]);
        await mine();
      }
    });

    it("Should revert when caller is not beneficiary (TGE_UNLOCK_TIMESTAMP is not reached)", async function () {
      await mine();
      await expect(
        mproVesting.connect(owner).enableForRelease()
      ).to.be.revertedWith("MPROVesting: Account is not a beneficiary");
    });

    it("Should revert when caller is not beneficiary (TGE_UNLOCK_TIMESTAMP is reached)", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      await expect(
        mproVesting.connect(owner).enableForRelease()
      ).to.be.revertedWith("MPROVesting: Account is not a beneficiary");
    });

    it("Should revert when caller is not beneficiary (CLIFF_TIMESTAMP is reached)", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY + CLIFF_DELAY]);
      await mine();
      await expect(
        mproVesting.connect(owner).enableForRelease()
      ).to.be.revertedWith("MPROVesting: Account is not a beneficiary");
    });
  });

  describe("claim function", function () {
    const userAmount = 1000;
    beforeEach(async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [userAmount]);
    });

    it("Should revert when called before TGE_UNLOCK_TIMESTAMP", async function () {
      await expect(mproVesting.connect(ben1).claim()).to.be.revertedWith(
        "Vesting: Not yet unlocked"
      );
    });

    it("Should claim proper amount when called after TGE_UNLOCK_TIMESTAMP", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      await mproVesting.connect(ben1).claim();
      expect(await erc20.balanceOf(ben1.address)).to.equal(
        getTgeUnlockAmount(userAmount)
      );
    });

    it("Should return error when called twice after TGE_UNLOCK_TIMESTAMP", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      await mproVesting.connect(ben1).claim();
      await expect(mproVesting.connect(ben1).claim()).to.be.revertedWith(
        "Vesting: No tokens to release"
      );
    });

    it("Should claim proper amount when called after CLIFF_TIMESTAMP", async function () {
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY,
      ]);
      await mine();
      await mproVesting.connect(ben1).claim();
      expect(await erc20.balanceOf(ben1.address)).to.equal(
        getTgeUnlockAmount(userAmount) + getVestingUnlockAmount(userAmount, 1)
      );
    });

    it("Should claim proper amounts on every vesting period", async function () {
      const periodsArray = new Array(20).fill(0).map((_, i) => i + 1);
      await network.provider.send("evm_increaseTime", [
        TGE_UNLOCK_DELAY + CLIFF_DELAY,
      ]);
      await mine();
      for (const period of periodsArray) {
        let expectedAmount =
          getTgeUnlockAmount(userAmount) +
          getVestingUnlockAmount(userAmount, period);
        if (expectedAmount > userAmount) {
          await expect(mproVesting.connect(ben1).claim()).to.be.revertedWith(
            "Vesting: No tokens to release"
          );
        } else {
          await mproVesting.connect(ben1).claim();
          expect(await erc20.balanceOf(ben1.address)).to.equal(expectedAmount);
        }
        await network.provider.send("evm_increaseTime", [ONE_DAY]);
        await mine();
      }
    });

    it("Should revert when called before TGE_UNLOCK_TIMESTAMP by non-beneficiary", async function () {
      await expect(mproVesting.connect(owner).claim()).to.be.revertedWith(
        "MPROVesting: Account is not a beneficiary"
      );
    });

    it("Should revert when called after TGE_UNLOCK_TIMESTAMP by non-beneficiary", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      await expect(mproVesting.connect(owner).claim()).to.be.revertedWith(
        "MPROVesting: Account is not a beneficiary"
      );
    });
  });

  describe("nextReleaseTimestamp", function () {
    const userAmount = 1000;
    beforeEach(async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [userAmount]);
    });
    it("Should return proper value when called by beneficiary", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY
      );
      await network.provider.send("evm_increaseTime", [CLIFF_DELAY]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY + VESTING_PERIOD_DURATION
      );
      await network.provider.send("evm_increaseTime", [
        VESTING_PERIOD_DURATION,
      ]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY + VESTING_PERIOD_DURATION * 2
      );
    });

    it("Should return proper value when called by non-beneficiary", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      expect(await mproVesting.connect(owner).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY
      );
      await network.provider.send("evm_increaseTime", [CLIFF_DELAY]);
      await mine();
      expect(await mproVesting.connect(owner).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY + VESTING_PERIOD_DURATION
      );
      await network.provider.send("evm_increaseTime", [
        VESTING_PERIOD_DURATION,
      ]);
      await mine();
      expect(await mproVesting.connect(owner).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY + VESTING_PERIOD_DURATION * 2
      );
    });

    it("Should properly return new higher timestamp", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      const timestamp = await mproVesting.connect(ben1).nextReleaseTimestamp();
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY * 2)
      ).to.not.be.reverted;
      expect(
        await mproVesting.connect(ben1).nextReleaseTimestamp()
      ).greaterThan(timestamp);
    });

    it("Should properly return new lower timestamp", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY * 2)
      ).to.not.be.reverted;
      const timestamp = await mproVesting.connect(ben1).nextReleaseTimestamp();
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).lessThan(
        timestamp
      );
    });

    it("Should properly return new the same timestamp", async function () {
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      const timestamp = await mproVesting.connect(ben1).nextReleaseTimestamp();
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        timestamp
      );
    });

    it("Should return proper value for high number of vesting periods", async function () {
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY
      );
      await network.provider.send("evm_increaseTime", [CLIFF_DELAY]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY + VESTING_PERIOD_DURATION
      );
      await network.provider.send("evm_increaseTime", [
        VESTING_PERIOD_DURATION,
      ]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY + VESTING_PERIOD_DURATION * 2
      );
      await network.provider.send("evm_increaseTime", [
        VESTING_PERIOD_DURATION * 898,
      ]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        TGE_UNLOCK_TIMESTAMP + CLIFF_DELAY + VESTING_PERIOD_DURATION * 900
      );
    });
  });

  describe("nextReleaseAllocation function", function () {
    const userAmount = 1000;
    beforeEach(async function () {
      await mproVesting
        .connect(deployer)
        .registerBeneficiaries([ben1.address], [userAmount]);
    });
    it("Should return proper value when called by beneficiary", async function () {
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getTgeUnlockAmount(userAmount)
      );
      await network.provider.send("evm_increaseTime", [TGE_UNLOCK_DELAY]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getVestingUnlockAmount(userAmount, 1)
      );
      await network.provider.send("evm_increaseTime", [CLIFF_DELAY]);
      await mine();
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getVestingUnlockAmount(userAmount, 1)
      );
      const periodsArray = new Array(12).fill(0).map((_, i) => i + 1);
      for (const period of periodsArray) {
        let expectedAmount =
          getTgeUnlockAmount(userAmount) +
          getVestingUnlockAmount(userAmount, period + 1);
        if (expectedAmount > userAmount) {
          expect(
            await mproVesting.connect(ben1).nextReleaseAllocation()
          ).to.equal(0);
        } else {
          expect(
            await mproVesting.connect(ben1).nextReleaseAllocation()
          ).to.equal(getVestingUnlockAmount(userAmount, 1));
        }
        await network.provider.send("evm_increaseTime", [
          VESTING_PERIOD_DURATION,
        ]);
        await mine();
      }
    });

    it("Should revert when called by non-beneficiary", async function () {
      await expect(
        mproVesting.connect(owner).nextReleaseAllocation()
      ).to.be.revertedWith("MPROVesting: Account is not a beneficiary");
    });

    it("Should properly return for new higher timestamp", async function () {
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getTgeUnlockAmount(userAmount)
      );
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getVestingUnlockAmount(userAmount, 1)
      );
      const timestamp = await mproVesting.connect(ben1).nextReleaseTimestamp();
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY * 2)
      ).to.not.be.reverted;
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getVestingUnlockAmount(userAmount, 1)
      );
      expect(
        await mproVesting.connect(ben1).nextReleaseTimestamp()
      ).greaterThan(timestamp);
    });

    it("Should properly return for new lower timestamp", async function () {
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getTgeUnlockAmount(userAmount)
      );
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP + ONE_DAY * 2)
      ).to.not.be.reverted;
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getVestingUnlockAmount(userAmount, 1)
      );
      const timestamp = await mproVesting.connect(ben1).nextReleaseTimestamp();
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).lessThan(
        timestamp
      );
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getVestingUnlockAmount(userAmount, 1)
      );
    });

    it("Should properly return for new the same timestamp", async function () {
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getTgeUnlockAmount(userAmount)
      );
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getVestingUnlockAmount(userAmount, 1)
      );
      const timestamp = await mproVesting.connect(ben1).nextReleaseTimestamp();
      await expect(
        mproVesting
          .connect(deployer)
          .setTgeUnlockTimestamp(TGE_UNLOCK_TIMESTAMP)
      ).to.not.be.reverted;
      expect(await mproVesting.connect(ben1).nextReleaseAllocation()).to.equal(
        getVestingUnlockAmount(userAmount, 1)
      );
      expect(await mproVesting.connect(ben1).nextReleaseTimestamp()).to.equal(
        timestamp
      );
    });
  });
});
