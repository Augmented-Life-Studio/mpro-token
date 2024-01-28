import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { JAKANTToken, JAKANTToken__factory, JAKANTMasterDistributor, JAKANTMasterDistributor__factory } from "../typechain-types";

// npx hardhat test test/JAKANTToken.ts

describe("JAKANTToken", function () {
  let mproToken: JAKANTToken;
  let masterDistributor: JAKANTMasterDistributor;
  let deployer: HardhatEthersSigner, owner: HardhatEthersSigner, lister: HardhatEthersSigner, addr1: HardhatEthersSigner, addr2: HardhatEthersSigner, addr3: HardhatEthersSigner;

  beforeEach(async function () {
    [deployer, owner, lister, addr1, addr2, addr3] = await ethers.getSigners();

    const MasterDistributorFactory: JAKANTMasterDistributor__factory = await ethers.getContractFactory("JAKANTMasterDistributor");
    masterDistributor = await MasterDistributorFactory.deploy(owner.address);
    const masterDistributorAddress = await masterDistributor.getAddress();

    await masterDistributor.connect(owner).grantRole(await masterDistributor.JAKANT_MASTER_DISTRIBUTOR_ROLE(), owner.address);
    await masterDistributor.connect(owner).grantRole(await masterDistributor.LISTER_ROLE(), lister.address);

    const JAKANTTokenFactory: JAKANTToken__factory = await ethers.getContractFactory("JAKANTToken");
    mproToken = await JAKANTTokenFactory.deploy(
      "JAKANTToken",
      "MPRO",
      [owner.address], // Premint addresses
      [ethers.parseEther("100")], // Premint values
      ethers.ZeroAddress, // LayerZero Endpoint
      masterDistributorAddress,
      owner.address
    );

  });

  describe("Deployment", function () {
    it("Should properly deploy and set initial values", async function () {
      expect(await mproToken.name()).to.equal("JAKANTToken");
      expect(await mproToken.symbol()).to.equal("MPRO");
      expect(await mproToken.balanceOf(owner.address)).to.equal(ethers.parseEther("100"));
      expect(await mproToken.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Should fail to mint tokens when called by non-distributor", async function () {
      await expect(mproToken.connect(addr1).mint(addr2.address, ethers.parseEther("50"))).to.be.revertedWith("Distributor only");
    });
  });

  describe("Burning", function () {
    it("Should burn tokens correctly", async function () {
      await mproToken.connect(owner).burn(owner.address, ethers.parseEther("10"));
      expect(await mproToken.balanceOf(owner.address)).to.equal(ethers.parseEther("90"));
    });
  });

  describe("Transferring", function () {
    it("Should transfer tokens correctly", async function () {
      await mproToken.connect(owner).transfer(addr1.address, ethers.parseEther("10"));
      expect(await mproToken.balanceOf(addr1.address)).to.equal(ethers.parseEther("9"));
    });

    it("Should fail to transfer tokens when balance is insufficient", async function () {
      await expect(mproToken.connect(owner).transfer(addr1.address, ethers.parseEther("1000"))).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should fail to transfer tokens when sender is not approved", async function () {
      await expect(mproToken.connect(addr1).transferFrom(owner.address, addr2.address, ethers.parseEther("10"))).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should transfer tokens correctly when sender is approved", async function () {
      await mproToken.connect(owner).approve(addr1.address, ethers.parseEther("10"));
      await mproToken.connect(addr1).transferFrom(owner.address, addr2.address, ethers.parseEther("10"));
      expect(await mproToken.balanceOf(addr2.address)).to.equal(ethers.parseEther("9"));
    });
    it("Should fail to transfer when caller is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      await expect(mproToken.connect(addr1).transfer(addr2.address, ethers.parseEther("10"))).to.be.revertedWith("Action on blocklisted account");
    })
    it("Should fail to transfer when to is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr2.address, true);
      await expect(mproToken.connect(addr1).transfer(addr2.address, ethers.parseEther("10"))).to.be.revertedWith("Action on blocklisted account");
    })
    it("Should fail to transferFrom when caller is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      await expect(mproToken.connect(addr1).transferFrom(addr2.address, addr3.address, ethers.parseEther("10"))).to.be.revertedWith("Action on blocklisted account");
    })
    it("Should fail to transferFrom when from is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr3.address, true);
      await expect(mproToken.connect(addr1).transferFrom(addr2.address, addr3.address, ethers.parseEther("10"))).to.be.revertedWith("Action on blocklisted account");
    })
    it("Should fail to transferFrom when to is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr3.address, true);
      await expect(mproToken.connect(addr1).transferFrom(addr2.address, addr3.address, ethers.parseEther("10"))).to.be.revertedWith("Action on blocklisted account");
    })
  });

  describe("Approvals", function () {
    it("Should approve and check allowance", async function () {
      await mproToken.connect(owner).approve(addr1.address, ethers.parseEther("20"));
      expect(await mproToken.allowance(owner.address, addr1.address)).to.equal(ethers.parseEther("20"));
    });
    it("Should fail to approve when caller is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      await expect(mproToken.connect(addr1).approve(addr2.address, ethers.parseEther("10"))).to.be.revertedWith("Action on blocklisted account");
    })
  });
});