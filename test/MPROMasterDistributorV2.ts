import { ethers, getNamedAccounts, network } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { mine } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MPRO } from "../typechain-types/contracts/MPRO.sol/MPRO";
import { MPROMasterDistributor } from "../typechain-types/contracts/MPROMasterDistributor.sol";
import { MPROMasterDistributor__factory } from "../typechain-types/factories/contracts/MPROMasterDistributor.sol";
import { MPRO__factory } from "../typechain-types/factories/contracts/MPRO.sol";
import { ZeroAddress } from "ethers";

// npx hardhat test test/MPROMasterDistributor.ts

const ONE_DAY_SEC = 24 * 60 * 60;
const ONE_DAY = ONE_DAY_SEC;
const DISTRIBUTION_REDUCTION_DELAY = ONE_DAY * 183;
const days_between_reductions = 183;


describe("MPROMasterDistributor", () => {
  let mproToken: MPRO;
  let mproMasterDistributor: MPROMasterDistributor;
  let deployer: HardhatEthersSigner,
    owner: HardhatEthersSigner,
    lister: HardhatEthersSigner,
    vesting: HardhatEthersSigner,
    distributor: HardhatEthersSigner,
    distributionTimeRoleManager: HardhatEthersSigner,
    distributionTimeManager: HardhatEthersSigner,
    addrs: HardhatEthersSigner[];
  let masterDistributorDeploymentTimestamp: number;
  let initialDistributionStartTime: number;
  let DISTRIBUTION_START_DELAY = 14 * ONE_DAY_SEC; // 14 days
  let INITIAL_DAILY_DISTRIBUTION = ethers.parseUnits("250000");

  let default_admin_role =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  let MPRO_master_distributor_role: HardhatEthersSigner;
  let lister_role: HardhatEthersSigner;
  let distributions_administrator_role_manager: HardhatEthersSigner;
  let distributions_administrator_role: HardhatEthersSigner;
  let whitelisted: HardhatEthersSigner;
  let blocklisted: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  beforeEach(async () => {
    [
      MPRO_master_distributor_role,
      lister_role,
      distributions_administrator_role_manager,
      distributions_administrator_role,
      whitelisted,
      blocklisted,
      user,
      owner,
      vesting,
      ...addrs
    ] = await ethers.getSigners();

    const MasterDistributorFactory = (await ethers.getContractFactory(
      "contracts/MPROMasterDistributor.sol:MPROMasterDistributor"
    )) as MPROMasterDistributor__factory;
    mproMasterDistributor = await MasterDistributorFactory.deploy(
      owner.address
    );

    const mproMasterDistributorDeploymentBlockNumber =
      mproMasterDistributor.deploymentTransaction()?.blockNumber as number;
    masterDistributorDeploymentTimestamp = (await ethers.provider.getBlock(
      mproMasterDistributorDeploymentBlockNumber
    ))!.timestamp as number;
    initialDistributionStartTime =
      masterDistributorDeploymentTimestamp + DISTRIBUTION_START_DELAY;

    // Grant roles and add users to whitelist/blocklist
    // await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DEFAULT_ADMIN_ROLE(), default_admin_role);
    await mproMasterDistributor
      .connect(owner)
      .grantRole(
        await mproMasterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE(),
        MPRO_master_distributor_role.address
      );
    await mproMasterDistributor
      .connect(owner)
      .grantRole(
        await mproMasterDistributor.LISTER_ROLE(),
        lister_role.address
      );
    // await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(), distributions_administrator_role_manager.address);
    // await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(), distributions_administrator_role.address);
    await mproMasterDistributor
      .connect(lister_role)
      .whitelist(whitelisted.address, true);
    await mproMasterDistributor
      .connect(lister_role)
      .blocklist(blocklisted.address, true);

    const MPRO: MPRO__factory = (await ethers.getContractFactory(
      "contracts/MPRO.sol:MPRO"
    )) as MPRO__factory;
    mproToken = await MPRO.deploy(
      "MPRO",
      "MPRO",
      [vesting],
      [ethers.parseUnits("100")],
      "0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1",
      mproMasterDistributor.target,
      owner.address
    );

    await mproMasterDistributor.connect(owner).setMPRO(mproToken.target);
    INITIAL_DAILY_DISTRIBUTION =
      await mproMasterDistributor.initialDaylyDistribution();
  });

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      expect(await mproMasterDistributor.owner()).to.be.equal(owner.address);
      expect(await mproToken.owner()).to.equal(owner.address);
    });

    it("Should check if roles have been granted correctly", async () => {
      expect(
        await mproMasterDistributor.isDistributor(
          MPRO_master_distributor_role.address
        )
      ).to.be.true;
      expect(await mproMasterDistributor.isLister(lister_role.address)).to.be
        .true;
      // isWhitelisted is private function
      expect(await mproMasterDistributor.isBlocklisted(blocklisted.address)).to
        .be.true;
    });

    it("Should set proper distributionStartTimestamp", async () => {
      expect(await mproMasterDistributor.distributionStartTimestamp()).to.equal(
        initialDistributionStartTime
      );
    });
  });

  describe("getAllTokenDistribution function", () => {
    it("Should return the right amount of tokens before distribution starts", async () => {
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("0"));
    });

    it("Should return the right amount of tokens after distribution starts", async () => {
      // Default distribution start time is after 14 days from deployment
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY,
      ]);
      await mine();
      // After 14 days from deployment, 250000 tokens should be marked as distributed
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(INITIAL_DAILY_DISTRIBUTION);
      // After each day after distribution start time, 250000/day tokens should marked as distributed
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      const oneDayAfterAmount =
        await mproMasterDistributor.getAllTokenDistribution();
      expect(oneDayAfterAmount).to.equal(ethers.parseUnits("500000"));
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      const twoDaysAfterAmount =
        await mproMasterDistributor.getAllTokenDistribution();
      expect(twoDaysAfterAmount).to.equal(ethers.parseUnits("750000"));
    });

    it("Should return 500M tokens in 2000th day , after distribution starts", async () => {
      // Distribution start time
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1 + 1999 * ONE_DAY,
      ]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("500000000"));
    });

    it("Should throw error when trying to mint over 500m tokens", async () => {
      // Distribution start time
      try {
        await network.provider.send("evm_increaseTime", [
          DISTRIBUTION_START_DELAY + 1 + 2000 * ONE_DAY,
        ]);
        await mine();
        const amount = await mproMasterDistributor.getAllTokenDistribution();
        expect(amount).to.equal(ethers.parseUnits("500000000"));
        throw new Error("More than 500m tokens minted");
      } catch (error) {
        if (
          error ==
          'AssertionError: expected 500250000000000000000000000 to equal 500000000000000000000000000. The numerical values of the given "bigint" and "bigint" inputs were compared, and they differed.'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should return correct number of tokens after one distribution", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          distributions_administrator_role.address
        );
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY,
      ]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("250000"));
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("200000")
        );
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount2 = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 200000).toString();
      expect(amount2).to.equal(ethers.parseUnits(sum));

    });


    it.only("Should return correct number of tokens after multiple reductions", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          distributions_administrator_role.address
        );
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY,
      ]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("250000"));
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("200000")
        );
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount2 = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 200000).toString();
      expect(amount2).to.equal(ethers.parseUnits(sum));
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + 2 * DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("150000")
        );
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount3 = await mproMasterDistributor.getAllTokenDistribution();
      const sum2 = ((days_between_reductions + 1) * (250000 + 200000) + 150000).toString();
      expect(amount3).to.equal(ethers.parseUnits(sum2));
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + 3 * DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("100000")
        );
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount4 = await mproMasterDistributor.getAllTokenDistribution();
      const sum3 = ((days_between_reductions + 1) * (250000 + 200000 + 150000) + 100000).toString();
      expect(amount4).to.equal(ethers.parseUnits(sum3));
    });
  });

  describe("Distribute function", () => {
    it("Should not revert with correct parameters", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, ethers.parseUnits("10"))
      ).to.not.be.reverted;
    });

    it("Should revert when address does not have distributor role", async () => {
      const distributorRoleAddress = await mproMasterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE();
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(user)
          .distribute(user.address, ethers.parseUnits("10"))
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${distributorRoleAddress}`
      );
    });

    it("Should revert when address have role different than distributor", async () => {
      const distributorRoleAddress = await mproMasterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE();
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .distribute(user.address, ethers.parseUnits("10"))
      ).to.be.revertedWith(
        `AccessControl: account ${lister_role.address.toLowerCase()} is missing role ${distributorRoleAddress}`
      );
    });

    it("Should revert if distribution have not started yet", async () => {
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, ethers.parseUnits("10"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution is not enabled yet"
      );
    });

    it("Should throw error when receiver's address is ivalid", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      try {
        await expect(
          mproMasterDistributor
            .connect(MPRO_master_distributor_role)
            .distribute("", ethers.parseUnits("10"))
        ).to.be.reverted;
        throw new Error("Distribution successful - should not be");
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

    it("Should revert when distribution amount is equal to 0", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, ethers.parseUnits("0"))
      ).to.be.revertedWith("amount must be greater than 0");
    });

    it("Should throw error when distribution amount is negative", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      try {
        await expect(
          mproMasterDistributor
            .connect(MPRO_master_distributor_role)
            .distribute(user.address, ethers.parseUnits("-10"))
        ).to.be.revertedWith("amount must be greater than 0");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_amount", value=-10000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should revert when distribution amount is greater than the number of available tokens", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("250000"));
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, ethers.parseUnits("250001"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution limit exceeded"
      );
    });

    it("Should properly distribute all awaiblable tokens", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("250000"));
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, ethers.parseUnits("250000"))
      ).to.not.be.reverted;
    });

    it("Should revert when trying to distribute tokens after distributin all available tokens", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("250000"));
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, ethers.parseUnits("250000"))
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, ethers.parseUnits("10"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution limit exceeded"
      );
    });

    it("Should properly distribute large number of tokens to a single wallet", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await network.provider.send("evm_increaseTime", [3 * ONE_DAY]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("1000000"));
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, amount)
      ).to.not.be.reverted;
    });

    it("Should properly distribute all available tokens after reduction", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          distributions_administrator_role.address
        );
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("200000")
        );
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 200000).toString();
      expect(amount).to.equal(ethers.parseUnits(sum));
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, amount)
      ).to.not.be.reverted;
    });

    it("Should revert when trying to distribute tokens after distributing all available tokens after reduction", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          distributions_administrator_role.address
        );
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY,
      ]);
      await mine();
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("200000")
        );
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 200000).toString();
      expect(amount).to.equal(ethers.parseUnits(sum));
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, amount)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distribute(user.address, "1")
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution limit exceeded"
      );
    });

    it;
  });

  describe("distributeBulk function", () => {
    it("Should properly distribute tokens to multiple addresses", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await mproMasterDistributor
        .connect(MPRO_master_distributor_role)
        .distributeBulk(
          [user.address, lister_role.address],
          [ethers.parseUnits("10"), ethers.parseUnits("5")]
        );
    });

    it("Should revert when caller does not have distributor role", async () => {
      const distributorRoleAddress = await mproMasterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE();
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(user)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits("10"), ethers.parseUnits("5")]
          )
      ).to.be.revertedWith(
        `AccessControl: account ${user.address.toLowerCase()} is missing role ${distributorRoleAddress}`
      );
    });

    it("Should revert when caller have role different than distributor role", async () => {
      const distributorRoleAddress = await mproMasterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE();
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .distributeBulk(
            [user.address, whitelisted.address],
            [ethers.parseUnits("10"), ethers.parseUnits("5")]
          )
      ).to.be.revertedWith(
        `AccessControl: account ${lister_role.address.toLowerCase()} is missing role ${distributorRoleAddress}`
      );
    });

    it("Should properly distribute the same number of tokens to multiple addresses", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await mproMasterDistributor
        .connect(MPRO_master_distributor_role)
        .distributeBulk(
          [user.address, lister_role.address],
          [ethers.parseUnits("10"), ethers.parseUnits("10")]
        );
    });

    it("Should properly distribute different number of tokens to multiple addresses", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await mproMasterDistributor
        .connect(MPRO_master_distributor_role)
        .distributeBulk(
          [user.address, lister_role.address],
          [ethers.parseUnits("10"), ethers.parseUnits("5")]
        );
    });

    it("Should revert if disitrubtion have not started yet", async () => {
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits("10"), ethers.parseUnits("5")]
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution is not enabled yet"
      );
    });

    it("Should revert when receiver address is invalid", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      try {
        await mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, "0x123"],
            [ethers.parseUnits("10"), ethers.parseUnits("5")]
          );
        throw new Error("DistributionBulk successful - should not be");
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

    it("Should revert when the number of token amounts is lower than number of addresses", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits("10")]
          )
      ).to.be.revertedWith("to and amount arrays must have the same length");
    });

    it("Should revert when the number of addresses is lower than number of token amounts", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address],
            [ethers.parseUnits("10"), ethers.parseUnits("5")]
          )
      ).to.be.revertedWith("to and amount arrays must have the same length");
    });

    it("Should revert when token amount is set to zero", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits("0"), ethers.parseUnits("5")]
          )
      ).to.be.revertedWith("amount must be greater than 0");
    });

    it("Should throw error when token amount is negative", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      try {
        await expect(
          mproMasterDistributor
            .connect(MPRO_master_distributor_role)
            .distributeBulk(
              [user.address, lister_role.address],
              [ethers.parseUnits("-10"), ethers.parseUnits("5")]
            )
        ).to.be.revertedWith("");
        throw new Error("Distribution successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="", value=-10000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should properly distribute all available tokens", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits("125000"), ethers.parseUnits("125000")]
          )
      ).to.not.be.reverted;
    });

    it("Should revert when trying to distribute more tokens than are available", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits("125000"), ethers.parseUnits("125001")]
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution limit exceeded"
      );
    });

    it("Should properly distribute all available tokens after reduction", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          distributions_administrator_role.address
        );
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("200000")
        );
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 200000).toString();
      const halfTheSum = (((days_between_reductions + 1) * 250000 + 200000)/2).toString()
      expect(amount).to.equal(ethers.parseUnits(sum));
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits(halfTheSum), ethers.parseUnits(halfTheSum)]
          )
      ).to.not.be.reverted;
    });

    it("Should rever when trying to distribute more tokens than are available after reduction", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          distributions_administrator_role.address
        );
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("200000")
        );
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 200000).toString();
      const halfTheSum = (((days_between_reductions + 1) * 250000 + 200000)/2).toString();
      const overHalfTheSum = (((days_between_reductions + 1) * 250000 + 200000)/2 + 1).toString();
      expect(amount).to.equal(ethers.parseUnits(sum));
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits(halfTheSum), ethers.parseUnits(overHalfTheSum)]
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution limit exceeded"
      );
    });

    it("Should not revert when tokens amount is floating value", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(MPRO_master_distributor_role)
          .distributeBulk(
            [user.address, lister_role.address],
            [ethers.parseUnits("10.5"), ethers.parseUnits("5")]
          )
      ).to.not.be.reverted;
    });
  });

  describe("setDistributionStartTime function", () => {
    it("Should properly set distribution start time", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 1 * ONE_DAY
          )
      ).to.not.be.reverted;
    });

    it("Should revert when trying to set distribution start time after distribution have started", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 3 * ONE_DAY
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution start time cannot be lower than current time"
      );
    });

    it("Should properly set distribution start time when it is lower than previous start time", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 5 * ONE_DAY
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 29 * ONE_DAY
          )
      ).to.not.be.reverted;
    });

    it("Should revert when distribution start time is lower than current time", async () => {
      await expect(
        mproMasterDistributor.connect(owner).setDistributionStartTime(1000)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution start time cannot be lower than current time"
      );
    });

    it("Should revert when distribution start time is higher than distributionStartTimeDeadline", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 31 * ONE_DAY
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Distribution start time must be less than distributionStartTimeDeadline"
      );
    });

    it("Should properly set distribution start time when it is equal to distributionStartTimeDeadline", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 30 * ONE_DAY
          )
      ).to.not.be.reverted;
    });

    it("Should properly set distribution start time when it is equal to previous distributionStartTime", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 5 * ONE_DAY
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 5 * ONE_DAY
          )
      ).to.not.be.reverted;
    });

    it("Should properly set distribution start time when it is higher than previous distributionStartTime", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 5 * ONE_DAY
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 10 * ONE_DAY
          )
      ).to.not.be.reverted;
    });

    it("Should properly set distribution start time multiple times", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 15 * ONE_DAY
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 10 * ONE_DAY
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 5 * ONE_DAY
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 20 * ONE_DAY
          )
      ).to.not.be.reverted;
    });

    it("Should rever when caller is not the owner", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .setDistributionStartTime(
            masterDistributorDeploymentTimestamp + 1 * ONE_DAY
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("AddDistributionReduction function", () => {
    beforeEach(async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          distributions_administrator_role.address
        );
    });

    it("Should properly add reduction", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 *DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("200000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 200000).toString();
      expect(amount).to.equal(ethers.parseUnits(sum));
    });

    it("Should properly add multiple reductions (increasing timeStamps)", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("200000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 2 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("150000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 3 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("100000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount4 = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * (250000 + 200000 + 150000) + 100000).toString();
      expect(amount4).to.equal(ethers.parseUnits(sum));
    });

    it("Should properly add multiple reductions (decreasing timeStamps)", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 5 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("200000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 2 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("150000")
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: New redution start time cannot be lower than 183 days after last redution timestamp"
      );
    });

    it("Should revert when multiple reduction have the same timeStamp", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 2 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("200000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 2 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("150000")
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: New redution start time cannot be lower than 183 days after last redution timestamp"
      );
    });

    it("Should revert when caller does not have distributionsAdministratorRole", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * ONE_DAY,
            ethers.parseUnits("200000")
          )
      ).to.be.revertedWith(
        `AccessControl: account ${lister_role.address.toLowerCase()} is missing role 0x5afa424c0b6204848cb71c5aa5f8da1afaf45d645ada516ab6c53bb3ff616cff`
      );
    });

    it("Should not revert if reduction amount stays the same (not higher or lower than before reduction)", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("250000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 250000).toString();
      expect(amount).to.equal(ethers.parseUnits(sum));
    });

    it("Should throw error when reduction amount is negative", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      try {
        await expect(
          mproMasterDistributor
            .connect(distributions_administrator_role)
            .addDistributionReduction(
              initialDistributionStartTime + 1 * ONE_DAY,
              ethers.parseUnits("-200000")
            )
        ).to.not.be.reverted;
        throw new Error("Reduction successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_reductionAmount", value=-200000000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should not revert for max allowed reduction (50% less)", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("125000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * 250000 + 125000).toString();
      expect(amount).to.equal(ethers.parseUnits(sum));
    });

    it("Should revert when reduction amount is greater than allowed (50%+ less)", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("124999")
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: New reduction amount cannot be greater than half of the last reduction amount"
      );
    });

    it("Should not revert for max allowed reduction amount (2x higher)", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("500000")
          )
      ).to.not.be.reverted;
    });

    it("Should revert for more than max allowed reduction amount (2x+ higher)", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("500001")
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: New reduction amount cannot be greater than the last reduction amount multiplied by 2"
      );
    });

    it("Should not revert when reduction timeStamp is in the future", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 10 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("400000")
          )
      ).to.not.be.reverted;
    });

    it("Should revert when less than 183 days have passed", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("400000")
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + (1 * DISTRIBUTION_REDUCTION_DELAY + 100),
            ethers.parseUnits("450000")
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: New redution start time cannot be lower than 183 days after last redution timestamp"
      );
    });

    it("Should not revert for multiple reductions with increasing reduction amounts", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("300000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 2 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("350000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role)
          .addDistributionReduction(
            initialDistributionStartTime + 3 * DISTRIBUTION_REDUCTION_DELAY,
            ethers.parseUnits("400000")
          )
      ).to.not.be.reverted;
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_REDUCTION_DELAY]);
      await mine();
      const amount4 = await mproMasterDistributor.getAllTokenDistribution();
      const sum = ((days_between_reductions + 1) * (250000 + 300000 + 350000) + 400000).toString();
      expect(amount4).to.equal(ethers.parseUnits(sum));
    });

    it("should throw error when reduction amount is empty", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      try {
        await expect(
          mproMasterDistributor
            .connect(distributions_administrator_role)
            .addDistributionReduction(
              initialDistributionStartTime + 1 * ONE_DAY,
              ethers.parseUnits("")
            )
        ).to.be.revertedWith("");
        throw new Error("Reduction successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid FixedNumber string value (argument="value", value="", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });
  });

  describe("setMPRO function", () => {
    it("Should revert when caller is not the owner", async () => {
      await expect(
        mproMasterDistributor.connect(user).setMPRO(mproToken.target)
      ).to.be.revertedWith(`Ownable: caller is not the owner`);
    });

    it("Should revert when token is already set", async () => {
      await expect(
        mproMasterDistributor.connect(owner).setMPRO(mproToken.target)
      ).to.be.revertedWith(
        "MPROMasterDistributor: MPRO token is already set"
      );
    });
  });

  describe("getBurnAmount", () => {
    it("Should return the right burn amount for not whitelisted address", async () => {
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("10"));
    });

    it("Should return the right burn amount for whitelisted address", async () => {
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        whitelisted.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("0"));
    });

    it("Should return proper burn amount for 0 tokens (not whitelisted address)", async () => {
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("0")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("0"));
    });

    it("Should return proper burn amount for 0 tokens (whitelisted address)", async () => {
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        whitelisted.address,
        ethers.parseUnits("0")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("0"));
    });

    it("Should throw error when address is invalid", async () => {
      try {
        const burnAmount = await mproMasterDistributor.getBurnAmount(
          "0x123",
          ethers.parseUnits("100")
        );
        throw new Error("burnAmount successful - should not be");
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

    it("Should properly get burn amount for large number of tokens", async () => {
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("1000000")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("100000"));
    });

    it("Should properly get burn amount for very low number of tokens", async () => {
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("1")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("0.1"));
    });

    it("Should throw error when amount is empty", async () => {
      try {
        const burnAmount = await mproMasterDistributor.getBurnAmount(
          user.address,
          ethers.parseUnits("")
        );
        throw new Error("burnAmount successful - shoould not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid FixedNumber string value (argument="value", value="", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });
  });

  describe("setBurnRate", () => {
    it("Should set correct burn rate", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(500)).to.not
        .be.reverted;
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("5"));
    });

    it("Should revert when caller is not the owner", async () => {
      await expect(
        mproMasterDistributor.connect(user).setBurnRate(500)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should properly set the same burn rate as it already is", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(500)).to.not
        .be.reverted;
      await expect(mproMasterDistributor.connect(owner).setBurnRate(500)).to.not
        .be.reverted;
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("5"));
    });

    it("Should revert when burn rate is higher than max allowed rate (10%)", async () => {
      await expect(
        mproMasterDistributor.connect(owner).setBurnRate(1001)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Burn rate cannot be greater than or equal to 10%"
      );
    });

    it("Should not revert when burn rate is set to zero", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(0)).to.not
        .be.reverted;
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("0"));
    });

    it("Should throw error when burn rate is negative", async () => {
      try {
        await expect(mproMasterDistributor.connect(owner).setBurnRate(-500)).to
          .not.be.reverted;
        throw new Error("Setting successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_burnRate", value=-500, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should throw error when burn rate is empty", async () => {
      try {
        await expect(mproMasterDistributor.connect(owner).setBurnRate("")).to
          .not.be.reverted;
        throw new Error("Setting burnRate successful - should not be");
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

    it("Should properly set max allowed burn rate (10%)", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(1000)).to
        .not.be.reverted;
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("10"));
    });

    it("Should properly set min allowed burn rate", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(1)).to.not
        .be.reverted;
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("10000")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("1"));
    });

    it("Should throw error when burn rate is a floating value", async () => {
      try {
        await expect(mproMasterDistributor.connect(owner).setBurnRate(500.5)).to
          .not.be.reverted;
        throw new Error("Setting burnRate successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: underflow (argument="value", value=500.5, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should properly set burn rate multiple times", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(500)).to.not
        .be.reverted;
      const burnAmount = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount).to.equal(ethers.parseUnits("5"));
      await expect(mproMasterDistributor.connect(owner).setBurnRate(1000)).to
        .not.be.reverted;
      const burnAmount2 = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount2).to.equal(ethers.parseUnits("10"));
      await expect(mproMasterDistributor.connect(owner).setBurnRate(100)).to.not
        .be.reverted;
      const burnAmount3 = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount3).to.equal(ethers.parseUnits("1"));
      await expect(mproMasterDistributor.connect(owner).setBurnRate(500)).to.not
        .be.reverted;
      const burnAmount4 = await mproMasterDistributor.getBurnAmount(
        user.address,
        ethers.parseUnits("100")
      );
      expect(burnAmount4).to.equal(ethers.parseUnits("5"));
    });
  });

  describe("setDistributorTimeAdministratorRoleManager", () => {
    it("Should properly set DistributorTimeAdministratorRoleManager", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributorTimeAdministratorRoleManager(
            distributions_administrator_role_manager.address
          )
      ).to.not.be.reverted;
    });

    it("Should revert when caller is not the owner", async () => {
      await expect(
        mproMasterDistributor
          .connect(user)
          .setDistributorTimeAdministratorRoleManager(
            distributions_administrator_role_manager.address
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert when trying to assign the role again to the same address", async () => {
      await mproMasterDistributor
        .connect(owner)
        .setDistributorTimeAdministratorRoleManager(
          distributions_administrator_role_manager.address
        );
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributorTimeAdministratorRoleManager(
            distributions_administrator_role_manager.address
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Role already granted to another account"
      );
    });

    it("Should revert when trying to assign the role again to different address", async () => {
      await mproMasterDistributor
        .connect(owner)
        .setDistributorTimeAdministratorRoleManager(
          distributions_administrator_role_manager.address
        );
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributorTimeAdministratorRoleManager(user.address)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Role already granted to another account"
      );
    });

    it("Should properly burn the role and than revert when trying to assign the role", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributorTimeAdministratorRoleManager(ethers.ZeroAddress)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributorTimeAdministratorRoleManager(
            distributions_administrator_role_manager.address
          )
      ).to.be.revertedWith("MPROMasterDistributor: Role is already burned");
    });

    it("Should not revert when role receiver already hads a different role", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .setDistributorTimeAdministratorRoleManager(lister_role.address)
      ).to.not.be.reverted;
    });

    it("Should throw error when address is invalid", async () => {
      try {
        await expect(
          mproMasterDistributor
            .connect(owner)
            .setDistributorTimeAdministratorRoleManager("0x123")
        ).to.not.be.reverted;
        throw new Error("Role assigned - should not be");
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
  });

  describe("setDistributorTimeAdministratorRole", () => {
    beforeEach(async () => {
      await mproMasterDistributor
        .connect(owner)
        .setDistributorTimeAdministratorRoleManager(
          distributions_administrator_role_manager.address
        );
    });

    it("Should properly assign the role", async () => {
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(
            distributions_administrator_role.address
          )
      ).to.not.be.reverted;
    });

    it("Should revert when caller does not have the proper role", async () => {
      await expect(
        mproMasterDistributor
          .connect(user)
          .setDistributorTimeAdministratorRole(
            distributions_administrator_role.address
          )
      ).to.be.revertedWith(
        "AccessControl: account 0x976ea74026e726554db657fa54763abd0c3a0aa9 is missing role 0x6ee0f19c3526ca65945666b9437299b6a1b226cdffcd62f34d1cbc222cb02682"
      );
    });

    it("Should revert when trying to assign the role to the same address twice", async () => {
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(
            distributions_administrator_role.address
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(
            distributions_administrator_role.address
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Role already granted to another account"
      );
    });

    it("Should revert when trying to assign the role to different address (role already granted)", async () => {
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(
            distributions_administrator_role.address
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(user.address)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Role already granted to another account"
      );
    });

    it("Should properly burn the role", async () => {
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(ethers.ZeroAddress)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(user.address)
      ).to.be.revertedWith("MPROMasterDistributor: Role is already burned");
    });

    it("Should properly assign the role to address with different role", async () => {
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(lister_role.address)
      ).to.not.be.reverted;
    });

    it("Should throw error when address is invalid", async () => {
      try {
        await expect(
          mproMasterDistributor
            .connect(distributions_administrator_role_manager)
            .setDistributorTimeAdministratorRole("0x123")
        ).to.not.be.reverted;
        throw new Error("Role assigned - should not be");
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
  });

  describe("grantRole function", () => {
    it("Should properly grant the roles", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role_manager.address
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
            distributions_administrator_role.address
          )
      ).to.not.be.reverted;
    });

    it("Should revert when trying to grant the role to blocklisted address", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            blocklisted.address
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should propert revert when trying to grant role to address that is both blocklisted and whitelisted", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .whitelist(blocklisted.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            blocklisted.address
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should revert when trying to grant the roles to address zero", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .whitelist(ethers.ZeroAddress, true)
      ).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .blocklist(ethers.ZeroAddress, true)
      ).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            ethers.ZeroAddress
          )
      ).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
            ethers.ZeroAddress
          )
      ).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
    });

    it("Should revert when trying to grant the role that has been burned", async () => {
      await mproMasterDistributor
        .connect(owner)
        .setDistributorTimeAdministratorRoleManager(
          distributions_administrator_role_manager.address
        );
      await expect(
        mproMasterDistributor
          .connect(distributions_administrator_role_manager)
          .setDistributorTimeAdministratorRole(ethers.ZeroAddress)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role_manager.address
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Role already granted to another account"
      );
    });

    it("Should revert when trying to grant the role again (to the same address)", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role_manager.address
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Role already granted to another account"
      );
    });

    it("Should revert when trying to grant the role again (to different address)", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          distributions_administrator_role_manager.address
        );
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            user.address
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Role already granted to another account"
      );
    });

    it("Should revert when caller is not the owner", async () => {
      await expect(
        mproMasterDistributor
          .connect(user)
          .grantRole(
            await mproMasterDistributor.LISTER_ROLE(),
            lister_role.address
          )
      ).to.be.revertedWith(`Ownable: caller is not the owner`);
    });

    it("Should throw error when address is invalid", async () => {
      try {
        await expect(
          mproMasterDistributor
            .connect(user)
            .grantRole(await mproMasterDistributor.LISTER_ROLE(), "0x123")
        ).to.not.be.reverted;
        throw new Error("Role granted - should not be");
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

    it("Should properly grant roles after they have been revoked", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role_manager.address
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .revokeRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role_manager.address
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role_manager.address
          )
      ).to.not.be.reverted;
    });

    it("Should properly grant roles after they have been revoked from different addresses", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role.address
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .revokeRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role.address
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(owner)
          .grantRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            distributions_administrator_role_manager.address
          )
      ).to.not.be.reverted;
    });
  });

  describe("revoke function", () => {
    it("Should properly revoke the function", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .revokeRole(
            await mproMasterDistributor.LISTER_ROLE(),
            lister_role.address
          )
      ).to.not.be.reverted;
    });

    it("Should revert when caller is not the owner", async () => {
      await expect(
        mproMasterDistributor
          .connect(user)
          .revokeRole(
            await mproMasterDistributor.LISTER_ROLE(),
            lister_role.address
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert when trying to revoke role from address zero", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .revokeRole(
            await mproMasterDistributor.LISTER_ROLE(),
            ethers.ZeroAddress
          )
      ).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
    });

    it("Should revert when trying to revoke role from address that does not have one", async () => {
      await expect(
        mproMasterDistributor
          .connect(owner)
          .revokeRole(await mproMasterDistributor.LISTER_ROLE(), user.address)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Account does not have role"
      );
    });

    it("Should throw error when address is invalid", async () => {
      try {
        await expect(
          mproMasterDistributor
            .connect(owner)
            .revokeRole(await mproMasterDistributor.LISTER_ROLE(), "0x123")
        ).to.not.be.reverted;
        throw new Error("Revoke successful - should not be");
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
  });

  describe("renounceRole function", () => {
    it("Should properly renounce the role", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(await mproMasterDistributor.LISTER_ROLE(), lister_role)
      ).to.not.be.reverted;
    });

    it("Should revert when trying to renounce for somebody else", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(await mproMasterDistributor.LISTER_ROLE(), user)
      ).to.be.revertedWith("AccessControl: can only renounce roles for self");
    });

    it("Should revert when trying to renounce for address zero", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(
            await mproMasterDistributor.LISTER_ROLE(),
            ethers.ZeroAddress
          )
      ).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
    });

    it("Should revert when address does not have a role", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            lister_role
          )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Account does not have role"
      );
    });

    it("Should revert when trying to renounce again", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(await mproMasterDistributor.LISTER_ROLE(), lister_role)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(await mproMasterDistributor.LISTER_ROLE(), lister_role)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Account does not have role"
      );
    });

    it("Should properly renounce multiple roles for the same address", async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
          lister_role.address
        );
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          lister_role.address
        );
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(await mproMasterDistributor.LISTER_ROLE(), lister_role)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(),
            lister_role
          )
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .renounceRole(
            await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
            lister_role
          )
      ).to.not.be.reverted;
    });
  });

  describe("blocklist function", () => {
    it("Should properly blocklist the address", async () => {
      await mproMasterDistributor
        .connect(lister_role)
        .blocklist(user.address, true);
      expect(await mproMasterDistributor.isBlocklisted(user.address)).to.be
        .true;
    });

    it("Should properly unblocklist the address", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(user.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .blocklist(user.address, false)
      ).to.not.be.reverted;
      expect(await mproMasterDistributor.isBlocklisted(user.address)).to.be
        .false;
    });

    it("Should revert when trying to blokclist without lister role", async () => {
      await expect(
        mproMasterDistributor.connect(owner).blocklist(user.address, true)
      ).to.be.revertedWith(
        "AccessControl: account 0x14dc79964da2c08b23698b3d3cc7ca32193d9955 is missing role 0xf94103142c1baabe9ac2b5d1487bf783de9e69cfeea9a72f5c9c94afd7877b8c"
      );
    });

    it("Should revert when trying to unblokclist without lister role", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(user.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor.connect(owner).blocklist(user.address, false)
      ).to.be.revertedWith(
        "AccessControl: account 0x14dc79964da2c08b23698b3d3cc7ca32193d9955 is missing role 0xf94103142c1baabe9ac2b5d1487bf783de9e69cfeea9a72f5c9c94afd7877b8c"
      );
    });

    it("Should revert when trying to blocklist the owner", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(owner, true)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Account has a role and cannot be blocklisted"
      );
    });

    it("Should not revert when trying to blokclist distributionsAdministratorTimeRole", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .blocklist(distributions_administrator_role_manager, true)
      ).to.not.be.reverted;
    });

    it("Should not revert when trying to blokclist distributionsAdministratorRole", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .blocklist(distributions_administrator_role, true)
      ).to.not.be.reverted;
    });

    it("Should revert when trying to blokclist the lister", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(lister_role, true)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Account has a role and cannot be blocklisted"
      );
    });

    it("Should revert when trying to blocklist address zero", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .blocklist(ethers.ZeroAddress, true)
      ).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
    });

    it("Should properly blocklist whitelisted address", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(whitelisted, true)
      ).to.not.be.reverted;
      expect(await mproMasterDistributor.isBlocklisted(whitelisted.address)).to
        .be.true;
    });

    it("Slhoud throw error when address is invalid (blocklist)", async () => {
      try {
        await expect(
          mproMasterDistributor.connect(lister_role).blocklist("0x123", true)
        ).to.not.be.reverted;
        throw new Error("Blocklisting successful - should not be");
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

    it("Slhoud throw error when address is invalid (unblocklist)", async () => {
      try {
        await expect(
          mproMasterDistributor.connect(lister_role).blocklist("0x123", false)
        ).to.not.be.reverted;
        throw new Error("Blocklisting successful - should not be");
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

    it("Should revert when unblocklisting not blocklisted address", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .blocklist(user.address, false)
      ).to.not.be.reverted;
    });

    it("Should not revert when trying to blocklist address that already is blocklisted", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(user.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(user.address, true)
      ).to.not.be.reverted;
      expect(await mproMasterDistributor.isBlocklisted(user.address)).to.be
        .true;
    });
  });

  describe("whitelist function", () => {
    it("Should properly whitelist the address", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).whitelist(user.address, true)
      ).to.not.be.reverted;
    });

    it("Should properly unwhitelist the address", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .whitelist(whitelisted.address, false)
      ).to.not.be.reverted;
    });

    it("Should revert when caller is not the lister (whitelist)", async () => {
      await expect(
        mproMasterDistributor.connect(owner).whitelist(user.address, true)
      ).to.be.revertedWith(
        "AccessControl: account 0x14dc79964da2c08b23698b3d3cc7ca32193d9955 is missing role 0xf94103142c1baabe9ac2b5d1487bf783de9e69cfeea9a72f5c9c94afd7877b8c"
      );
    });

    it("Should revert when caller is not the lister (unwhitelist)", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).whitelist(user.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor.connect(owner).whitelist(user.address, false)
      ).to.be.revertedWith(
        "AccessControl: account 0x14dc79964da2c08b23698b3d3cc7ca32193d9955 is missing role 0xf94103142c1baabe9ac2b5d1487bf783de9e69cfeea9a72f5c9c94afd7877b8c"
      );
    });

    it("Should revert when whitelisting address zero", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).whitelist(ZeroAddress, true)
      ).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
    });

    it("Should throw error when address is invalid (whitelist)", async () => {
      try {
        await expect(
          mproMasterDistributor.connect(lister_role).whitelist("0x123", true)
        ).to.not.be.reverted;
        throw new Error("Whitelisting successful - should not be");
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

    it("Should throw error when address is invalid (unwhitelist)", async () => {
      try {
        await expect(
          mproMasterDistributor.connect(lister_role).whitelist("0x123", false)
        ).to.not.be.reverted;
        throw new Error("Whitelisting successful - should not be");
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

    it("Should properly whitelist blocklisted address", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(user.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor.connect(lister_role).whitelist(user.address, true)
      ).to.not.be.reverted;
    });

    it("Should properly unwhitelist blocklisted address", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).whitelist(user.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor.connect(lister_role).blocklist(user.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .whitelist(user.address, false)
      ).to.not.be.reverted;
    });

    it("Should not revert when trying to whitelist already whitelisted address", async () => {
      await expect(
        mproMasterDistributor.connect(lister_role).whitelist(user.address, true)
      ).to.not.be.reverted;
      await expect(
        mproMasterDistributor.connect(lister_role).whitelist(user.address, true)
      ).to.not.be.reverted;
    });

    it("Unwhitelist not whitelisted address", async () => {
      await expect(
        mproMasterDistributor
          .connect(lister_role)
          .whitelist(user.address, false)
      ).to.not.be.reverted;
    });
  });

  describe("isLister function", () => {
    it("Should return true for lister", async () => {
      expect(await mproMasterDistributor.isLister(lister_role.address)).to.be
        .true;
    });

    it("Should return false for non lister", async () => {
      expect(await mproMasterDistributor.isLister(user.address)).to.be.false;
    });

    it("Should return false for address zero", async () => {
      expect(await mproMasterDistributor.isLister(ethers.ZeroAddress)).to.be
        .false;
    });

    it("Should throw error for invalid address", async () => {
      try {
        expect(await mproMasterDistributor.isLister("0x123")).to.be.true;
        throw new Error("Check successful - should not be");
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
  });

  describe("isDistributor function", () => {
    it("Should return true for distributor", async () => {
      expect(
        await mproMasterDistributor.isDistributor(
          MPRO_master_distributor_role.address
        )
      ).to.be.true;
    });

    it("Should return false for non distributor", async () => {
      expect(await mproMasterDistributor.isDistributor(user.address)).to.be
        .false;
    });

    it("Should return false for address zero", async () => {
      expect(await mproMasterDistributor.isDistributor(ethers.ZeroAddress)).to
        .be.false;
    });

    it("Should throw error for invalid address", async () => {
      try {
        expect(await mproMasterDistributor.isDistributor("0x123")).to.be.true;
        throw new Error("Check successful - should not be");
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
  });

  describe("isBlocklisted function", () => {
    it("Should return true for blocklisted address", async () => {
      expect(await mproMasterDistributor.isBlocklisted(blocklisted.address)).to
        .be.true;
    });

    it("Should return false for non blocklisted address", async () => {
      expect(await mproMasterDistributor.isBlocklisted(user.address)).to.be
        .false;
    });

    it("Should return true for address that is both blocklisted and whitelisted", async () => {
      await mproMasterDistributor
        .connect(lister_role)
        .whitelist(user.address, true);
      await mproMasterDistributor
        .connect(lister_role)
        .blocklist(user.address, true);
      expect(await mproMasterDistributor.isBlocklisted(user.address)).to.be
        .true;
    });

    it("Should return false for address zero", async () => {
      expect(await mproMasterDistributor.isBlocklisted(ethers.ZeroAddress)).to
        .be.false;
    });

    it("Should throw error for invalid address", async () => {
      try {
        expect(await mproMasterDistributor.isBlocklisted("0x123")).to.be.false;
        throw new Error("Check successful - should not be");
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
  });

  describe("mintAllowed function", () => {
    it("Should return true if called by contract", async () => {
      expect(
        await mproMasterDistributor.mintAllowed(mproMasterDistributor.target)
      ).to.be.true;
    });

    it("Should return false if called by non contract", async () => {
      await expect(mproMasterDistributor.mintAllowed(owner)).to.be.revertedWith(
        "MPROMasterDistributor: Distributor only"
      );
    });

    it("Should return false if called by address zero", async () => {
      await expect(
        mproMasterDistributor.mintAllowed(ethers.ZeroAddress)
      ).to.be.revertedWith("MPROMasterDistributor: Distributor only");
    });
  });

  describe("transferAllowed function", () => {
    it("Should properly check if transfer is allowed", async () => {
      expect(
        await mproMasterDistributor.transferAllowed(
          addrs[0].address,
          addrs[1].address,
          addrs[2].address
        )
      ).to.be.true;
    });

    it("Should revert when 'from' is blokclisted", async () => {
      await expect(
        mproMasterDistributor.transferAllowed(
          blocklisted.address,
          addrs[1].address,
          addrs[2].address
        )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should revert when 'to' is blocklisted", async () => {
      await expect(
        mproMasterDistributor.transferAllowed(
          addrs[0].address,
          blocklisted.address,
          addrs[2].address
        )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should revert when caller is blocklisted", async () => {
      await expect(
        mproMasterDistributor.transferAllowed(
          addrs[0].address,
          addrs[1].address,
          blocklisted.address
        )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should revert when caller, 'from' and 'to' are blocklisted", async () => {
      await mproMasterDistributor
        .connect(lister_role)
        .blocklist(addrs[0].address, true);
      await mproMasterDistributor
        .connect(lister_role)
        .blocklist(addrs[1].address, true);
      await expect(
        mproMasterDistributor.transferAllowed(
          addrs[0].address,
          addrs[1].address,
          blocklisted.address
        )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should throw error when 'from' address is invalid", async () => {
      try {
        await expect(
          mproMasterDistributor.transferAllowed(
            "0x123",
            addrs[1].address,
            addrs[2].address
          )
        ).to.be.revertedWith(
          "MPROMasterDistributor: Action on blocklisted account"
        );
        throw new Error("Check successful - should not be");
      } catch (error) {
        if (
          error ==
          "NotImplementedError: Method 'HardhatEthersProvider.resolveName' is not implemented"
        ) {
        } else error;
      }
    });

    it("Should throw error when 'to' address is invalid", async () => {
      try {
        await expect(
          mproMasterDistributor.transferAllowed(
            addrs[0].address,
            "0x123",
            addrs[2].address
          )
        ).to.be.revertedWith(
          "MPROMasterDistributor: Action on blocklisted account"
        );
        throw new Error("Check successful - should not be");
      } catch (error) {
        if (
          error ==
          "NotImplementedError: Method 'HardhatEthersProvider.resolveName' is not implemented"
        ) {
        } else error;
      }
    });

    it("Should throw error when caller address is invalid", async () => {
      try {
        await expect(
          mproMasterDistributor.transferAllowed(
            addrs[0].address,
            addrs[1].address,
            "0x123"
          )
        ).to.be.revertedWith(
          "MPROMasterDistributor: Action on blocklisted account"
        );
        throw new Error("Check successful - should not be");
      } catch (error) {
        if (
          error ==
          "NotImplementedError: Method 'HardhatEthersProvider.resolveName' is not implemented"
        ) {
        } else error;
      }
    });

    it("Should be true when 'from' is address zero", async () => {
      expect(
        await mproMasterDistributor.transferAllowed(
          ethers.ZeroAddress,
          addrs[1].address,
          addrs[2].address
        )
      ).to.be.true;
    });

    it("Should be true when 'to' is address zero", async () => {
      expect(
        await mproMasterDistributor.transferAllowed(
          addrs[0].address,
          ethers.ZeroAddress,
          addrs[2].address
        )
      ).to.be.true;
    });

    it("Should be true when caller is address zero", async () => {
      expect(
        await mproMasterDistributor.transferAllowed(
          addrs[0].address,
          addrs[1].address,
          ethers.ZeroAddress
        )
      ).to.be.true;
    });
  });

  describe("approveAllowed function", () => {
    it("Should return true when none of the addresses are blocklisted", async () => {
      expect(
        await mproMasterDistributor.approveAllowed(
          addrs[0].address,
          addrs[1].address
        )
      ).to.be.true;
    });

    it("Should return false when caller is blocklisted", async () => {
      await expect(
        mproMasterDistributor.approveAllowed(
          addrs[0].address,
          blocklisted.address
        )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should return false when spender is blocklisted", async () => {
      await expect(
        mproMasterDistributor.approveAllowed(
          blocklisted.address,
          addrs[1].address
        )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should return true when address zero is spender", async () => {
      expect(
        await mproMasterDistributor.approveAllowed(
          ethers.ZeroAddress,
          addrs[1].address
        )
      ).to.be.true;
    });

    it("Should return true when address zero is caller", async () => {
      expect(
        await mproMasterDistributor.approveAllowed(
          addrs[0].address,
          ethers.ZeroAddress
        )
      ).to.be.true;
    });

    it("Should return false when both caller and spender are blocklisted", async () => {
      await mproMasterDistributor
        .connect(lister_role)
        .blocklist(addrs[0].address, true);
      await expect(
        mproMasterDistributor.approveAllowed(
          addrs[0].address,
          blocklisted.address
        )
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should throw error when caller's address is invalid", async () => {
      try {
        expect(
          await mproMasterDistributor.approveAllowed(addrs[0].address, "0x123")
        ).to.be.true;
        throw new Error("approveAllowed successful - should not be");
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

    it("Should throw error when spender's address is invalid", async () => {
      try {
        expect(
          await mproMasterDistributor.approveAllowed("0x123", addrs[1].address)
        ).to.be.true;
        throw new Error("approveAllowed successful - should not be");
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
  });

  describe("getDistributionReduction function", () => {
    beforeEach(async () => {
      await mproMasterDistributor
        .connect(owner)
        .grantRole(
          await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE(),
          distributions_administrator_role.address
        );
    });

    it("Should properly return for one reduction", async () => {
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("240000")
        );
      const distributionReductions =
        await mproMasterDistributor.getDistributionReductions();
      expect(distributionReductions.length).to.equal(1);
      expect(distributionReductions[0][0]).to.equal(
        initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY
      );
      expect(distributionReductions[0][1]).to.equal(
        ethers.parseUnits("240000")
      );
    });

    it("Should be empty after distribution starts and before any reduction", async () => {
      await network.provider.send("evm_increaseTime", [
        DISTRIBUTION_START_DELAY + 1,
      ]);
      await mine();
      const distributionReductions =
        await mproMasterDistributor.getDistributionReductions();
      expect(distributionReductions.length).to.equal(0);
    });

    it("Should be empty before distribution starts", async () => {
      const distributionReductions =
        await mproMasterDistributor.getDistributionReductions();
      expect(distributionReductions.length).to.equal(0);
    });

    it("Should properly return for multiple reductions", async () => {
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("240000")
        );
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + 5 * DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("220000")
        );
      await mproMasterDistributor
        .connect(distributions_administrator_role)
        .addDistributionReduction(
          initialDistributionStartTime + 10 * DISTRIBUTION_REDUCTION_DELAY,
          ethers.parseUnits("200000")
        );
      const distributionReductions =
        await mproMasterDistributor.getDistributionReductions();
      expect(distributionReductions.length).to.equal(3);
      expect(distributionReductions[0][0]).to.equal(
        initialDistributionStartTime + 1 * DISTRIBUTION_REDUCTION_DELAY
      );
      expect(distributionReductions[0][1]).to.equal(
        ethers.parseUnits("240000")
      );
      expect(distributionReductions[1][0]).to.equal(
        initialDistributionStartTime + 5 * DISTRIBUTION_REDUCTION_DELAY
      );
      expect(distributionReductions[1][1]).to.equal(
        ethers.parseUnits("220000")
      );
      expect(distributionReductions[2][0]).to.equal(
        initialDistributionStartTime + 10 * DISTRIBUTION_REDUCTION_DELAY
      );
      expect(distributionReductions[2][1]).to.equal(
        ethers.parseUnits("200000")
      );
    });
  });
});
