import { ethers, getNamedAccounts, network } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { mine } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { JAKANTToken } from '../typechain-types/contracts/MPRO.sol/JAKANTToken';
import { JAKANTMasterDistributor } from '../typechain-types/contracts/MPROMasterDistributor.sol';
import { JAKANTMasterDistributor__factory } from '../typechain-types/factories/contracts/MPROMasterDistributor.sol';
import { JAKANTToken__factory } from '../typechain-types/factories/contracts/MPRO.sol';

// npx hardhat test test/JAKANTMasterDistributor.ts

const ONE_DAY = 24 * 60 * 60;

describe('JAKANTMasterDistributor', () => {
  let mproToken: JAKANTToken;
  let mproMasterDistributor: JAKANTMasterDistributor;
  let deployer: HardhatEthersSigner, owner: HardhatEthersSigner, lister: HardhatEthersSigner, vesting: HardhatEthersSigner, distributor: HardhatEthersSigner, distributionTimeRoleManager: HardhatEthersSigner, distributionTimeManager: HardhatEthersSigner, addrs: HardhatEthersSigner[];
  let masterDistributorDeploymentTimestamp: number;
  let initialDistributionStartTime: number;
  let DISTRIBUTION_START_DELAY = 14 * ONE_DAY; // 14 days
  let INITIAL_DAILY_DISTRIBUTION = ethers.parseUnits("250000");
  beforeEach(async () => {
    [
      deployer,
      owner,
      lister,
      vesting,
      distributor,
      distributionTimeRoleManager,
      distributionTimeManager,
      ...addrs
    ] = await ethers.getSigners()


    const MasterDistributorFactory = await ethers.getContractFactory("contracts/JAKANTMasterDistributor.sol:JAKANTMasterDistributor") as JAKANTMasterDistributor__factory;
    mproMasterDistributor = await MasterDistributorFactory.deploy(owner.address);

    const mproMasterDistributorDeploymentBlockNumber = mproMasterDistributor.deploymentTransaction()?.blockNumber as number;
    masterDistributorDeploymentTimestamp = (await ethers.provider.getBlock(mproMasterDistributorDeploymentBlockNumber))!.timestamp as number;
    initialDistributionStartTime = masterDistributorDeploymentTimestamp + DISTRIBUTION_START_DELAY;


    await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.JAKANT_MASTER_DISTRIBUTOR_ROLE(), distributor.address);
    await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.LISTER_ROLE(), lister.address);

    const JAKANTToken: JAKANTToken__factory = await ethers.getContractFactory('contracts/MPRO.sol:JAKANTToken') as JAKANTToken__factory;
    mproToken = await JAKANTToken.deploy(
      'MPRO', 'MPRO', [vesting], [ethers.parseUnits("100")], '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1', mproMasterDistributor.target, owner.address
    );

    await mproMasterDistributor.connect(owner).setJAKANTToken(mproToken.target);
    INITIAL_DAILY_DISTRIBUTION = await mproMasterDistributor.initialDaylyDistribution();
  });

  describe('Deployment', () => {
    it('Should set the right owner', async () => {
      expect(await mproMasterDistributor.owner()).to.be.equal(owner.address);
      expect(await mproToken.owner()).to.equal(owner.address);
    });
    it('Should set the right distributor', async () => {
      expect(await mproMasterDistributor.hasRole(await mproMasterDistributor.JAKANT_MASTER_DISTRIBUTOR_ROLE(), distributor.address)).to.be.true;
    });
    it("Should set proper distributionStartTimestamp", async () => {
      expect(await mproMasterDistributor.distributionStartTimestamp()).to.equal(initialDistributionStartTime);
    })
  })
  describe("getAllTokenDistribution function", () => {
    it("Should return the right amount of tokens before distribution starts", async () => {
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("0"));
    });
    it("Should return the right amount of tokens after distribution starts", async () => {
      // Default distribution start time is after 14 days from deployment
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1]);
      await mine();
      // After 14 days from deployment, 250000 tokens should be marked as distributed
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(INITIAL_DAILY_DISTRIBUTION);
      // After each day after distribution start time, 250000/day tokens should marked as distributed
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      const oneDayAfterAmount = await mproMasterDistributor.getAllTokenDistribution();
      expect(oneDayAfterAmount).to.equal(ethers.parseUnits("500000"));
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      const twoDaysAfterAmount = await mproMasterDistributor.getAllTokenDistribution();
      expect(twoDaysAfterAmount).to.equal(ethers.parseUnits("750000"));
    });
  })
  describe("Distribute function", () => {
    it("Should return error before distribution starts", async () => {
      await expect(mproMasterDistributor.connect(distributor).distribute(deployer.address, ethers.parseUnits("10"))).to.be.revertedWith("JAKANTMasterDistributor: Distribution is not enabled yet");
    });
    it("Should enable distribution after distribution start time", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1]);
      await mine();
      await mproMasterDistributor.connect(distributor).distribute(deployer.address, ethers.parseUnits("10"));
    })
    it("Master distributor should be able to mint only 250000 in day when distribution starts", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1]);
      await mine();
      await mproMasterDistributor.connect(distributor).distribute(deployer.address, INITIAL_DAILY_DISTRIBUTION);
      await expect(mproMasterDistributor.connect(distributor).distribute(deployer.address, ethers.parseUnits("1"))).to.be.revertedWith("JAKANTMasterDistributor: Distribution limit exceeded");
    })
    it("Should be able to mint 250000 dayly for 4 days", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 100]);
      await mine();
      await mproMasterDistributor.connect(distributor).distribute(deployer.address, INITIAL_DAILY_DISTRIBUTION);
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      await mproMasterDistributor.connect(distributor).distribute(deployer.address, INITIAL_DAILY_DISTRIBUTION);
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      await mproMasterDistributor.connect(distributor).distribute(deployer.address, INITIAL_DAILY_DISTRIBUTION);
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      await mproMasterDistributor.connect(distributor).distribute(deployer.address, INITIAL_DAILY_DISTRIBUTION);
    })
    it("Should be able to mint up to maxCap after long period of time", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1999 * ONE_DAY]);
      await mine();
      await mproMasterDistributor.connect(distributor).distribute(deployer.address, ethers.parseUnits("499999900"));
    })
    it("Should return error when trying to mint more than maxCap", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1999 * ONE_DAY]);
      await mine();
      await expect(mproMasterDistributor.connect(distributor).distribute(deployer.address, ethers.parseUnits("500000000"))).to.be.revertedWith("ERC20Capped: cap exceeded");
    })
  })
  describe("DistributeBulk function", () => {
    it("Should return error before distribution starts", async () => {
      await expect(mproMasterDistributor.connect(distributor).distributeBulk([deployer.address], [ethers.parseUnits("10")])).to.be.revertedWith("JAKANTMasterDistributor: Distribution is not enabled yet");
    })
    it("Should enable distribution after distribution start time", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1]);
      await mine();
      await mproMasterDistributor.connect(distributor).distributeBulk([deployer.address], [ethers.parseUnits("10")]);
    })
    it("Master distributor should be able to mint only 250000 in day when distribution starts", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1]);
      await mine();
      await mproMasterDistributor.connect(distributor).distributeBulk([deployer.address], [ethers.parseUnits("250000")]);
      await expect(mproMasterDistributor.connect(distributor).distributeBulk([deployer.address], [ethers.parseUnits("1")])).to.be.revertedWith("JAKANTMasterDistributor: Distribution limit exceeded");
    })
    it("Should be able to mint 250000 dayly for 4 days", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 100]);
      await mine();
      await mproMasterDistributor.connect(distributor).distributeBulk([deployer.address], [ethers.parseUnits("250000")]);
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      await mproMasterDistributor.connect(distributor).distributeBulk([deployer.address], [ethers.parseUnits("250000")]);
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      await mproMasterDistributor.connect(distributor).distributeBulk([deployer.address], [ethers.parseUnits("250000")]);
      await network.provider.send("evm_increaseTime", [ONE_DAY]);
      await mine();
      await mproMasterDistributor.connect(distributor).distributeBulk([deployer.address], [ethers.parseUnits("250000")]);
    })
  })
  describe("setDistributionStartTime function", () => {
    it("Should return error if called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).setDistributionStartTime(100)).to.be.revertedWith(`Ownable: caller is not the owner`);
    })
    it("Should return error when distribution start time is lower that current time", async () => {
      await expect(mproMasterDistributor.connect(owner).setDistributionStartTime(1000)).to.be.revertedWith("JAKANTMasterDistributor: Distribution start time cannot be lower than current time");
    })
    it("Should return error when function is called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).setDistributionStartTime(100)).to.be.revertedWith(`Ownable: caller is not the owner`);
    })
    it("Should return error when distribution start time is higher than distributionStartTimeDeadline", async () => {
      await expect(mproMasterDistributor.connect(owner).setDistributionStartTime(masterDistributorDeploymentTimestamp + (31 * ONE_DAY))).to.be.revertedWith("JAKANTMasterDistributor: Distribution start time must be less than distributionStartTimeDeadline");
    })
    it("Should set distribution start time", async () => {
      await expect(mproMasterDistributor.connect(owner).setDistributionStartTime(masterDistributorDeploymentTimestamp + (1 * ONE_DAY))).to.not.be.reverted;
    })
  })
  // npx hardhat test test/JAKANTMasterDistributor.ts --grep "addDistributionReduction function"
  describe("addDistributionReduction function", () => {
    beforeEach(async () => {
      await mproMasterDistributor.connect(owner).setDistributorTimeAdministratorRoleManager(distributionTimeRoleManager.address);
      await mproMasterDistributor.connect(distributionTimeRoleManager).setDistributorTimeAdministratorRole(distributionTimeManager.address);
    })
    it("Should return error if called by non distributions time administrator role", async () => {
      await expect(mproMasterDistributor.connect(deployer).addDistributionReduction(100, 100)).to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE()}`);
    })
    it("Should return error when distribution start time is lower that current time", async () => {
      await expect(mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime, 1000)).to.be.revertedWith("JAKANTMasterDistributor: New redution start time cannot be lower than 183 days after last redution timestamp");
    })
    it("Should return error when reduction is set to lower than 183 days after last reduction", async () => {
      await expect(mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime + (182 * ONE_DAY), 1000000)).to.be.revertedWith("JAKANTMasterDistributor: New redution start time cannot be lower than 183 days after last redution timestamp");
    })
    it("Should return error when _reductionAmount is greater thn half of the last reduction amount", async () => {
      await expect(mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime + (183 * ONE_DAY), 500000)).to.be.revertedWith("JAKANTMasterDistributor: New reduction amount cannot be greater than half of the last reduction amount");
    })
    it("Should return error when _reductionAmount is greater than last reduction amount multiplied by 2", async () => {
      await expect(mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime + (183 * ONE_DAY), ethers.parseUnits("600000"))).to.be.revertedWith("JAKANTMasterDistributor: New reduction amount cannot be greater than the last reduction amount multiplied by 2");
    })
    it("Should add distribution reduction called by distributions time administator", async () => {
      await expect(mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime + (183 * ONE_DAY), ethers.parseUnits("240000"))).to.not.be.reverted;
    })
    it("Should return distribution reductions", async () => {
      await mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime + (183 * ONE_DAY), ethers.parseUnits("240000"));
      const distributionReductions = await mproMasterDistributor.getDistributionReductions();
      expect(distributionReductions.length).to.equal(1);
      expect(distributionReductions[0][0]).to.equal(initialDistributionStartTime + (183 * ONE_DAY));
      expect(distributionReductions[0][1]).to.equal(ethers.parseUnits("240000"));
    })
    it("Should allow to increase distribution reduction", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1]);
      await mine();
      // After 14 days from deployment, 250000 tokens should be marked as distributed
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("250000"));
      // + 14 DAYS with seconds dust
      await network.provider.send("evm_increaseTime", [14 * ONE_DAY]);
      await mine();
      const amountAfter14Days = await mproMasterDistributor.getAllTokenDistribution();
      expect(amountAfter14Days).to.equal(ethers.parseUnits((250000 * 14).toString()) + INITIAL_DAILY_DISTRIBUTION);
      await mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime + (183 * ONE_DAY), ethers.parseUnits("300000"));
      // + 183 DAYS with seconds dust
      await network.provider.send("evm_increaseTime", [183 * ONE_DAY]);
      await mine();
      const amountAfterReduction = await mproMasterDistributor.getAllTokenDistribution();
      expect(amountAfterReduction).to.equal(ethers.parseUnits((250000 * 183 + 14 * 300000).toString()) + INITIAL_DAILY_DISTRIBUTION + ethers.parseUnits("300000"));
    })
    it("Should properly count allTokenDistribution when multiple reductions are added", async () => {
      await network.provider.send("evm_increaseTime", [DISTRIBUTION_START_DELAY + 1]);
      await mine();
      // After 14 days from deployment, 250000 tokens should be marked as distributed
      const amount = await mproMasterDistributor.getAllTokenDistribution();
      expect(amount).to.equal(ethers.parseUnits("250000"));
      // + 14 DAYS with seconds dust
      await network.provider.send("evm_increaseTime", [14 * ONE_DAY]);
      await mine();
      const amountAfter14Days = await mproMasterDistributor.getAllTokenDistribution();
      expect(amountAfter14Days).to.equal(ethers.parseUnits((250000 * 14).toString()) + INITIAL_DAILY_DISTRIBUTION);
      await mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime + (183 * ONE_DAY), ethers.parseUnits("300000"));
      await mproMasterDistributor.connect(distributionTimeManager).addDistributionReduction(initialDistributionStartTime + (366 * ONE_DAY), ethers.parseUnits("400000"));
      // + 183 DAYS with seconds dust
      await network.provider.send("evm_increaseTime", [183 * ONE_DAY]);
      await mine();
      const amountAfterReduction = await mproMasterDistributor.getAllTokenDistribution();
      expect(amountAfterReduction).to.equal(ethers.parseUnits((250000 * 183 + 14 * 300000).toString()) + INITIAL_DAILY_DISTRIBUTION + ethers.parseUnits("300000"));
      // + 183 DAYS with seconds dust
      await network.provider.send("evm_increaseTime", [183 * ONE_DAY]);
      await mine();
      const amountAfterSecondReduction = await mproMasterDistributor.getAllTokenDistribution();
      expect(amountAfterSecondReduction).to.equal(ethers.parseUnits((250000 * 183 + 183 * 300000 + 14 * 400000).toString()) + INITIAL_DAILY_DISTRIBUTION + ethers.parseUnits("300000") + ethers.parseUnits("400000"));
    })
  })
  describe("setJAKANTToken function", () => {
    it("Should return error if called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).setJAKANTToken(mproToken.target)).to.be.revertedWith(`Ownable: caller is not the owner`);
    })
    it("Should return error when token is already set", async () => {
      await expect(mproMasterDistributor.connect(owner).setJAKANTToken(mproToken.target)).to.be.revertedWith("JAKANTMasterDistributor: MPRO token is already set");
    })
  })
  describe("getBurnAmount function", () => {
    it("Should return the right burn amount", async () => {
      const burnAmount = await mproMasterDistributor.getBurnAmount(addrs[0].address, ethers.parseUnits("100"));
      expect(burnAmount).to.equal(ethers.parseUnits("10"));
    })
    it("Should return 0 when sender is whitelisted", async () => {
      await mproMasterDistributor.connect(lister).whitelist(addrs[0].address, true);
      const burnAmount = await mproMasterDistributor.getBurnAmount(addrs[0].address, ethers.parseUnits("100"));
      expect(burnAmount).to.equal(ethers.parseUnits("0"));
    })
  })
  describe("setBurnRate function", () => {
    it("Should return error if called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).setBurnRate(100)).to.be.revertedWith(`Ownable: caller is not the owner`);
    })
    it("Should return error when burn rate is greater than 100", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(1001)).to.be.revertedWith("JAKANTMasterDistributor: Burn rate cannot be greater than or equal to 10%");
    })
    it("Should set burn rate", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(500)).to.not.be.reverted;
    })
  })
  describe("setDistributorTimeAdministratorRoleManager function", () => {
    it("Should return error if called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).setDistributorTimeAdministratorRoleManager(distributionTimeRoleManager.address)).to.be.revertedWith(`Ownable: caller is not the owner`);
    })
    it("Should set distributor time administrator role manager", async () => {
      await expect(mproMasterDistributor.connect(owner).setDistributorTimeAdministratorRoleManager(distributionTimeRoleManager.address)).to.not.be.reverted;
    })
    it("Shoould not be able to set distributor time administrator manager role twice", async () => {
      await mproMasterDistributor.connect(owner).setDistributorTimeAdministratorRoleManager(distributionTimeRoleManager.address);
      await expect(mproMasterDistributor.connect(owner).setDistributorTimeAdministratorRoleManager(distributionTimeRoleManager.address)).to.be.revertedWith("JAKANTMasterDistributor: Role already granted to another account");
    })
    it("When role is granted to address 0 can not be longer granted", async () => {
      await expect(mproMasterDistributor.connect(owner).setDistributorTimeAdministratorRoleManager(ethers.ZeroAddress)).to.not.be.reverted;
      await expect(mproMasterDistributor.connect(owner).setDistributorTimeAdministratorRoleManager(distributionTimeRoleManager.address)).to.be.revertedWith("JAKANTMasterDistributor: Role is already burned");
    })
  })
  describe("setDistributorTimeAdministratorRole function", () => {
    beforeEach(async () => {
      await mproMasterDistributor.connect(owner).setDistributorTimeAdministratorRoleManager(distributionTimeRoleManager.address);
    })
    it("Should return error if called by non distributor time administrator role manager", async () => {
      await expect(mproMasterDistributor.connect(deployer).setDistributorTimeAdministratorRole(distributionTimeManager.address)).to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER()}`);
    })
    it("Should set distributor time administrator role", async () => {
      await expect(mproMasterDistributor.connect(distributionTimeRoleManager).setDistributorTimeAdministratorRole(distributionTimeManager.address)).to.not.be.reverted;
    })
    it("Shoould not be able to set distributor time administrator role twice", async () => {
      await mproMasterDistributor.connect(distributionTimeRoleManager).setDistributorTimeAdministratorRole(distributionTimeManager.address);
      await expect(mproMasterDistributor.connect(distributionTimeRoleManager).setDistributorTimeAdministratorRole(distributionTimeManager.address)).to.be.revertedWith("JAKANTMasterDistributor: Role already granted to another account");
    })
    it("When role is granted to address 0 can not be longer granted", async () => {
      await expect(mproMasterDistributor.connect(distributionTimeRoleManager).setDistributorTimeAdministratorRole(ethers.ZeroAddress)).to.not.be.reverted;
      await expect(mproMasterDistributor.connect(distributionTimeRoleManager).setDistributorTimeAdministratorRole(distributionTimeManager.address)).to.be.revertedWith("JAKANTMasterDistributor: Role is already burned");
    })
  })
  describe("grantRole function", () => {
    it("Should return error if called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).grantRole(await mproMasterDistributor.LISTER_ROLE(), lister.address)).to.be.revertedWith(`Ownable: caller is not the owner`);
    })
    it("Should return error when role is assigned to blocklisted account", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[0].address, true);
      await expect(mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.LISTER_ROLE(), addrs[0].address)).to.be.revertedWith("JAKANTMasterDistributor: Action on blocklisted account");
    })
    it("Should return error when role is assigned to address zero", async () => {
      await expect(mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.LISTER_ROLE(), ethers.ZeroAddress)).to.be.revertedWith("JAKANTMasterDistributor: Action on address zero");
    })
    it("Should return error when role is assigned more then once", async () => {
      await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(), addrs[0].address)
      await expect(mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(), addrs[0].address)).to.be.revertedWith("JAKANTMasterDistributor: Role already granted to another account");
    })
    it("Should grant role", async () => {
      await expect(mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(), lister.address)).to.not.be.reverted;
    })
    it("Should block adding role to multiple accounts", async () => {
      await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(), addrs[0].address)
      await expect(mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(), addrs[1].address)).to.be.revertedWith("JAKANTMasterDistributor: Role already granted to another account");
    })
    it("Should block adding role to multiple accounts when is revoked on different account", async () => {
      await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(), addrs[0].address)
      await expect(mproMasterDistributor.connect(owner).revokeRole(await mproMasterDistributor.DISTRIBUTIONS_ADMINISTRATOR_ROLE_MANAGER(), addrs[2].address)).to.be.revertedWith("JAKANTMasterDistributor: Account does not have role");
    })
  })
  describe("revokeRole function", () => {
    it("Should return error if called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).revokeRole(await mproMasterDistributor.LISTER_ROLE(), lister.address)).to.be.revertedWith('Ownable: caller is not the owner');
    })
    it("Should return error when role is revoked from address zero", async () => {
      await expect(mproMasterDistributor.connect(owner).revokeRole(await mproMasterDistributor.LISTER_ROLE(), ethers.ZeroAddress)).to.be.revertedWith("JAKANTMasterDistributor: Action on address zero");
    })
    it("Should revoke role", async () => {
      await expect(mproMasterDistributor.connect(owner).revokeRole(await mproMasterDistributor.LISTER_ROLE(), lister.address)).to.not.be.reverted;
    })
  })
  describe("blocklist function managed by lister role", () => {
    it("Should return error if called by non lister", async () => {
      await expect(mproMasterDistributor.connect(deployer).blocklist(addrs[0].address, true)).to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${await mproMasterDistributor.LISTER_ROLE()}`);
    })
    it("Should return error when blocklisting address zero", async () => {
      await expect(mproMasterDistributor.connect(lister).blocklist(ethers.ZeroAddress, true)).to.be.revertedWith("JAKANTMasterDistributor: Action on address zero");
    })
    it("Should return error when called on owner account", async () => {
      await expect(mproMasterDistributor.connect(lister).blocklist(owner.address, true)).to.be.revertedWith("JAKANTMasterDistributor: Account has a role and cannot be blocklisted");
    })
    it("Should return error when called on distributor account", async () => {
      await expect(mproMasterDistributor.connect(lister).blocklist(distributor.address, true)).to.be.revertedWith("JAKANTMasterDistributor: Account has a role and cannot be blocklisted");
    })
    it("Should return error when called on lister account", async () => {
      await expect(mproMasterDistributor.connect(lister).blocklist(lister.address, true)).to.be.revertedWith("JAKANTMasterDistributor: Account has a role and cannot be blocklisted");
    })
    it("Should blocklist account", async () => {
      await expect(mproMasterDistributor.connect(lister).blocklist(addrs[0].address, true)).to.not.be.reverted;
    })
  })
  describe("whitelist function managed by lister role", () => {
    it("Should return error if called by non lister", async () => {
      await expect(mproMasterDistributor.connect(deployer).whitelist(addrs[0].address, true)).to.be.revertedWith(`AccessControl: account ${deployer.address.toLowerCase()} is missing role ${await mproMasterDistributor.LISTER_ROLE()}`);
    })
    it("Should return error when whitelisting address zero", async () => {
      await expect(mproMasterDistributor.connect(lister).whitelist(ethers.ZeroAddress, true)).to.be.revertedWith("JAKANTMasterDistributor: Action on address zero");
    })
    it("Should whitelist account", async () => {
      await expect(mproMasterDistributor.connect(lister).whitelist(addrs[0].address, true)).to.not.be.reverted;
    })
  })
  describe("isBlocklisted function", () => {
    it("Should return false when account is not blocklisted", async () => {
      expect(await mproMasterDistributor.isBlocklisted(addrs[0].address)).to.be.false;
    })
    it("Should return true when account is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[0].address, true);
      expect(await mproMasterDistributor.isBlocklisted(addrs[0].address)).to.be.true;
    })
  })
  describe("mintAllowed function to call only from address(this)", () => {
    it("Should return false when called from other address", async () => {
      await expect(mproMasterDistributor.mintAllowed(deployer.address)).to.be.revertedWith("JAKANTMasterDistributor: Distributor only");
    })
    it("Should return true when called from this address", async () => {
      expect(await mproMasterDistributor.mintAllowed(mproMasterDistributor.target)).to.be.true;
    })
  })
  describe("transferAllowed function", () => {
    it("Should return false when from is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[0].address, true);
      await expect(mproMasterDistributor.transferAllowed(addrs[0].address, addrs[1].address, addrs[2].address)).to.be.revertedWith("JAKANTMasterDistributor: Action on blocklisted account");
    })
    it("Should return false when to is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[1].address, true);
      await expect(mproMasterDistributor.transferAllowed(addrs[0].address, addrs[1].address, addrs[2].address)).to.be.revertedWith("JAKANTMasterDistributor: Action on blocklisted account");
    })
    it("Should return false when caller is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[2].address, true);
      await expect(mproMasterDistributor.transferAllowed(addrs[0].address, addrs[1].address, addrs[2].address)).to.be.revertedWith("JAKANTMasterDistributor: Action on blocklisted account");
    })
    it("Should return true when none of the accounts are blocklisted", async () => {
      expect(await mproMasterDistributor.transferAllowed(addrs[0].address, addrs[1].address, addrs[2].address)).to.be.true;
    })
  })
  describe("approveAllowed function", () => {
    it("Should return false when spender is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[0].address, true);
      await expect(mproMasterDistributor.approveAllowed(addrs[0].address, addrs[1].address)).to.be.revertedWith("JAKANTMasterDistributor: Action on blocklisted account");
    })
    it("Should return false when caller is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[1].address, true);
      await expect(mproMasterDistributor.approveAllowed(addrs[0].address, addrs[1].address)).to.be.revertedWith("JAKANTMasterDistributor: Action on blocklisted account");
    })
    it("Should return true when none of the accounts are blocklisted", async () => {
      expect(await mproMasterDistributor.approveAllowed(addrs[0].address, addrs[1].address)).to.be.true;
    })
  })
});
