import { ethers, getNamedAccounts, network } from 'hardhat';
import { expect } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { mine } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { MPROMasterDistributor__factory } from '../typechain-types/factories/contracts/MPROMasterDistributorLight.sol';
import { MPROMasterDistributor } from '../typechain-types/contracts/MPROMasterDistributorLight.sol';
import { MPRO } from '../typechain-types/contracts/MPROLight.sol';
import { MPRO__factory } from '../typechain-types/factories/contracts/MPROLight.sol';

// npx hardhat test test/MPROMasterDistributorLight.ts

describe('MPROMasterDistributorLight', () => {
  let mproToken: MPRO;
  let mproMasterDistributor: MPROMasterDistributor;
  let deployer: HardhatEthersSigner, owner: HardhatEthersSigner, lister: HardhatEthersSigner, vesting: HardhatEthersSigner, distributor: HardhatEthersSigner, addrs: HardhatEthersSigner[];
  beforeEach(async () => {
    [
      deployer,
      owner,
      lister,
      vesting,
      distributor,
      ...addrs
    ] = await ethers.getSigners()


    const MasterDistributorFactory = await ethers.getContractFactory("contracts/MPROMasterDistributorLight.sol:MPROMasterDistributor") as MPROMasterDistributor__factory;
    mproMasterDistributor = await MasterDistributorFactory.deploy(owner.address);

    await mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.LISTER_ROLE(), lister.address);

    const MPRO = await ethers.getContractFactory('contracts/MPROLight.sol:MPRO') as MPRO__factory;
    mproToken = await MPRO.deploy(
      'MPRO', 'MPRO', '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1', mproMasterDistributor.target, owner.address
    );
  });

  describe('Deployment', () => {
    it('Should set the right owner', async () => {
      expect(await mproMasterDistributor.owner()).to.be.equal(owner.address);
      expect(await mproToken.owner()).to.equal(owner.address);
    });

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
      await expect(mproMasterDistributor.connect(owner).setBurnRate(1001)).to.be.revertedWith("MPROMasterDistributor: Burn rate cannot be greater than or equal to 10%");
    })
    it("Should set burn rate", async () => {
      await expect(mproMasterDistributor.connect(owner).setBurnRate(500)).to.not.be.reverted;
    })
  })

  describe("grantRole function", () => {
    it("Should return error if called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).grantRole(await mproMasterDistributor.LISTER_ROLE(), lister.address)).to.be.revertedWith(`Ownable: caller is not the owner`);
    })
    it("Should return error when role is assigned to blocklisted account", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[0].address, true);
      await expect(mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.LISTER_ROLE(), addrs[0].address)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account");
    })
    it("Should return error when role is assigned to address zero", async () => {
      await expect(mproMasterDistributor.connect(owner).grantRole(await mproMasterDistributor.LISTER_ROLE(), ethers.ZeroAddress)).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
    })
  })
  describe("revokeRole function", () => {
    it("Should return error if called by non owner", async () => {
      await expect(mproMasterDistributor.connect(deployer).revokeRole(await mproMasterDistributor.LISTER_ROLE(), lister.address)).to.be.revertedWith('Ownable: caller is not the owner');
    })
    it("Should return error when role is revoked from address zero", async () => {
      await expect(mproMasterDistributor.connect(owner).revokeRole(await mproMasterDistributor.LISTER_ROLE(), ethers.ZeroAddress)).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
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
      await expect(mproMasterDistributor.connect(lister).blocklist(ethers.ZeroAddress, true)).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
    })
    it("Should return error when called on owner account", async () => {
      await expect(mproMasterDistributor.connect(lister).blocklist(owner.address, true)).to.be.revertedWith("MPROMasterDistributor: Account has a role and cannot be blocklisted");
    })
    it("Should return error when called on lister account", async () => {
      await expect(mproMasterDistributor.connect(lister).blocklist(lister.address, true)).to.be.revertedWith("MPROMasterDistributor: Account has a role and cannot be blocklisted");
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
      await expect(mproMasterDistributor.connect(lister).whitelist(ethers.ZeroAddress, true)).to.be.revertedWith("MPROMasterDistributor: Action on address zero");
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
  describe("transferAllowed function", () => {
    it("Should return false when from is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[0].address, true);
      await expect(mproMasterDistributor.transferAllowed(addrs[0].address, addrs[1].address, addrs[2].address)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account");
    })
    it("Should return false when to is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[1].address, true);
      await expect(mproMasterDistributor.transferAllowed(addrs[0].address, addrs[1].address, addrs[2].address)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account");
    })
    it("Should return false when caller is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[2].address, true);
      await expect(mproMasterDistributor.transferAllowed(addrs[0].address, addrs[1].address, addrs[2].address)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account");
    })
    it("Should return true when none of the accounts are blocklisted", async () => {
      expect(await mproMasterDistributor.transferAllowed(addrs[0].address, addrs[1].address, addrs[2].address)).to.be.true;
    })
  })
  describe("approveAllowed function", () => {
    it("Should return false when spender is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[0].address, true);
      await expect(mproMasterDistributor.approveAllowed(addrs[0].address, addrs[1].address)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account");
    })
    it("Should return false when caller is blocklisted", async () => {
      await mproMasterDistributor.connect(lister).blocklist(addrs[1].address, true);
      await expect(mproMasterDistributor.approveAllowed(addrs[0].address, addrs[1].address)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account");
    })
    it("Should return true when none of the accounts are blocklisted", async () => {
      expect(await mproMasterDistributor.approveAllowed(addrs[0].address, addrs[1].address)).to.be.true;
    })
  })
});
