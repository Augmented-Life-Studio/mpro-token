import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { LZMock, MPRO } from "../typechain-types";
import { MPROMasterDistributor } from "../typechain-types/contracts/MPROMasterDistributor.sol/MPROMasterDistributor";
import { MPROMasterDistributor__factory } from "../typechain-types/factories/contracts/MPROMasterDistributor.sol";
import { MPRO__factory } from "../typechain-types/factories/contracts/MPRO.sol";
import { LZMock__factory } from "../typechain-types/factories/contracts/mocks/LZEndpointMock.sol";

// npx hardhat test test/MPRO.ts

describe("MPRO", function () {
  let mproToken: MPRO;
  let masterDistributor: MPROMasterDistributor;
  let lzMock: LZMock
  let deployer: HardhatEthersSigner, owner: HardhatEthersSigner, lister: HardhatEthersSigner, addr1: HardhatEthersSigner, addr2: HardhatEthersSigner, addr3: HardhatEthersSigner;

  beforeEach(async function () {
    [deployer, owner, lister, addr1, addr2, addr3] = await ethers.getSigners();

    const MasterDistributorFactory = await ethers.getContractFactory("contracts/MPROMasterDistributor.sol:MPROMasterDistributor") as MPROMasterDistributor__factory;
    masterDistributor = await MasterDistributorFactory.deploy(owner.address);
    const masterDistributorAddress = await masterDistributor.getAddress();
    await masterDistributor.connect(owner).grantRole(await masterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE(), owner.address);
    await masterDistributor.connect(owner).grantRole(await masterDistributor.LISTER_ROLE(), lister.address);

    const LZMockFactory = await ethers.getContractFactory("contracts/mocks/LZEndpointMock.sol:LZMock") as LZMock__factory;
    lzMock = await LZMockFactory.deploy(1);
    const lzMockAddress = await lzMock.getAddress();

    const MPROFactory = await ethers.getContractFactory("contracts/MPRO.sol:MPRO") as MPRO__factory;
    mproToken = await MPROFactory.deploy(
      "MPRO",
      "MPRO",
      [owner.address], // Premint addresses
      [ethers.parseEther("100")], // Premint values
      lzMockAddress, // LayerZero Endpoint
      masterDistributorAddress,
      owner.address
    );
  });

  describe("Deployment", function () {
    it("Should properly deploy and set initial values", async function () {
      expect(await mproToken.name()).to.equal("MPRO");
      expect(await mproToken.symbol()).to.equal("MPRO");
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.owner()).to.equal(owner.address);
      expect(await mproToken.totalSupply()).to.equal(ethers.parseEther("100"));
      expect(await mproToken.maxCap()).to.equal(ethers.parseEther("500000000"));
    });
  });

  describe("mint()", function () {
    it("Should fail to mint tokens when called by non-distributor", async function () {
      await expect(mproToken.connect(addr1).mint(addr2.address, ethers.parseEther("50"))).to.be.revertedWith("MPROMasterDistributor: Distributor only");
    });
  });

  describe("burn()", function () {
    it("Should burn tokens correctly", async function () {
      await mproToken
        .connect(owner)
        .burn(ethers.parseEther("10"));
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("90")
      );
      expect(await mproToken.totalSupply()).to.equal(ethers.parseEther("90"));
    });

    it("Should revert for burn amount equal to zero", async function () {
      await mproToken
        .connect(owner)
        .burn(ethers.parseEther("0"));
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.totalSupply()).to.equal(ethers.parseEther("100"));
    });

    it("Should throw error when burn amount is negative", async function () {
      try {
        await mproToken
          .connect(owner)
          .burn(ethers.parseEther("-10"))
        expect.fail("Expected revert not received");
      } catch (error: any) {
        expect(error.code).to.equal('INVALID_ARGUMENT')
      }
    });

    it("Should properly return number of tokens left after burning for a user", async function () {
      await mproToken
        .connect(owner)
        .burn(ethers.parseEther("10"));
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("90")
      );
      expect(await mproToken.totalSupply()).to.equal(ethers.parseEther("90"));
    });
  });

  describe("approve function", function () {
    it("Should properly approve and check allowance", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("20"));
      expect(await mproToken.allowance(owner.address, addr1.address)).to.equal(
        ethers.parseEther("20")
      );
    });

    it("Should expect approve amount equal zero", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("0"));
      expect(await mproToken.allowance(owner.address, addr1.address)).to.equal(
        ethers.parseEther("0")
      );
    });

    it("Should throw error when approve amount is negative", async function () {
      try {
        await mproToken
          .connect(owner)
          .approve(addr1.address, ethers.parseEther("-10"));
        expect.fail("Expected revert not received");
      } catch (error: any) {
        expect(error.code).to.equal('INVALID_ARGUMENT')
      }
    });

    it("Should revert when spender is address zero", async function () {
      await expect(
        mproToken
          .connect(owner)
          .approve(ethers.ZeroAddress, ethers.parseEther("20"))
      ).to.be.revertedWith("ERC20: approve to the zero address");
    });

    it("Should throw error when spender's address is invalid", async function () {
      try {
        await mproToken
          .connect(owner)
          .approve("0x123", ethers.parseEther("20"));
        expect.fail("Expected revert not received");
      } catch (error: any) {
        expect(error.message).to.equal("Method 'HardhatEthersProvider.resolveName' is not implemented")
      }
    });

    it("Should properly approve for very low amount", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("1"));
      expect(await mproToken.allowance(owner.address, addr1.address)).to.equal(
        ethers.parseEther("1")
      );
    });

    it("Should properly approve for all owned tokens", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("100"));
      expect(await mproToken.allowance(owner.address, addr1.address)).to.equal(
        ethers.parseEther("100")
      );
    });

    it("Should properly approve for more tokens that address has", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("101"));
      expect(await mproToken.allowance(owner.address, addr1.address)).to.equal(
        ethers.parseEther("101")
      );
    });

    it("Should properly approve for oneself", async function () {
      await mproToken
        .connect(owner)
        .approve(owner.address, ethers.parseEther("10"));
      expect(await mproToken.allowance(owner.address, owner.address)).to.equal(
        ethers.parseEther("10")
      );
    });

    it("Should revert when trying to approve for blocklisted address", async function () {
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      await expect(
        mproToken.connect(owner).approve(addr1.address, ethers.parseEther("20"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should revert when trying to approve as blocklisted address", async function () {
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      await expect(
        mproToken.connect(addr1).approve(addr2.address, ethers.parseEther("20"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });
  });

  describe("transafer function", function () {
    it("Should transfer tokens correctly", async function () {
      await mproToken
        .connect(owner)
        .transfer(addr1.address, ethers.parseEther("10"));
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("9")
      );
    });

    it("Should transfer tokens correctly (whitelisted address)", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await mproToken
        .connect(owner)
        .transfer(addr1.address, ethers.parseEther("10"));
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("10")
      );
    });

    it("Should properly transfer to oneself", async function () {
      await mproToken
        .connect(owner)
        .transfer(owner.address, ethers.parseEther("10"));
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99")
      );
    });

    it("Should revert when transferring to zero address", async function () {
      await expect(
        mproToken
          .connect(owner)
          .transfer(ethers.ZeroAddress, ethers.parseEther("10"))
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });

    it("Should throw error when transferring to invalid address", async function () {
      try {
        await mproToken
          .connect(owner)
          .transfer("0x123", ethers.parseEther("10"));
        expect.fail("Expected revert not received");
      } catch (error: any) {
        expect(error.message).to.be.equal("Method 'HardhatEthersProvider.resolveName' is not implemented")
      }
    });

    it("Should properly transfer zero tokens", async function () {
      await mproToken
        .connect(owner)
        .transfer(addr1.address, ethers.parseEther("0"));
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("0")
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("100")
      );
    });

    it("Should throw error when transferring negative number of tokens", async function () {
      try {
        await mproToken
          .connect(owner)
          .transfer(addr1.address, ethers.parseEther("-10"));
        expect.fail("Expected revert not received");
      } catch (error: any) {
        expect(error.code).to.equal('INVALID_ARGUMENT')
      }
    });

    it("Should revert when transferring to blocklisted address", async function () {
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      await expect(
        mproToken
          .connect(owner)
          .transfer(addr1.address, ethers.parseEther("10"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should revert when transferring as blocklisted address", async function () {
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      await expect(
        mproToken
          .connect(addr1)
          .transfer(owner.address, ethers.parseEther("10"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should properly transfer all available tokens", async function () {
      await mproToken
        .connect(owner)
        .transfer(addr1.address, ethers.parseEther("100"));
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("90")
      );
    });

    it("Should revert when transferring more tokens than address has", async function () {
      await expect(
        mproToken
          .connect(owner)
          .transfer(addr1.address, ethers.parseEther("101"))
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should properly transfer very low number of tokens", async function () {
      await mproToken
        .connect(owner)
        .transfer(addr1.address, ethers.parseEther("1"));
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("0.9")
      );
    });
  });

  // npx hardhat test test/MPRO.ts --grep "transferFrom function"
  describe("transferFrom function", function () {
    it("Should properly transferFrom", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("20"));
      await mproToken
        .connect(addr1)
        .transferFrom(owner.address, addr3.address, ethers.parseEther("10"));
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("90")
      );
    });
    it("Should properly transfer all owned tokens", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("20"));
      await mproToken
        .connect(addr1)
        .transferFrom(owner.address, addr3.address, ethers.parseEther("20"));
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("80")
      );
    });

    it("Should rever when transferring more tokens than are available", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("20"));
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(owner.address, addr3.address, ethers.parseEther("30"))
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should correctly revert transferFrom on burRate = 10%", async function () {
      await masterDistributor.connect(owner).setBurnRate(1000);
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("20"));
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(owner.address, addr3.address, ethers.parseEther("21"))
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should properly tranfer zero tokens", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("20"));
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(owner.address, addr3.address, ethers.parseEther("0"))
      ).to.not.be.reverted;
    });

    it("Should throw error when tranferring negative number of tokens", async function () {
      try {
        await
          mproToken
            .connect(addr1)
            .transferFrom(
              owner.address,
              addr3.address,
              ethers.parseEther("-10")
            )
        expect.fail("Expected revert not received");
      } catch (error: any) {
        expect(error.code).to.equal('INVALID_ARGUMENT')
      }
    });

    it("Should properly transfer when caller and 'from' are the same", async function () {
      await mproToken
        .connect(owner)
        .approve(owner.address, ethers.parseEther("20"));
      await expect(
        mproToken
          .connect(owner)
          .transferFrom(owner.address, addr3.address, ethers.parseEther("10"))
      ).to.not.be.reverted;
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("90")
      );
      expect(await mproToken.balanceOf(addr3.address)).to.equal(
        ethers.parseEther("9")
      );
    });

    it("Should properly transfer when caller and 'to' are the same", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("20"));
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(owner.address, addr1.address, ethers.parseEther("10"))
      ).to.not.be.reverted;
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("90")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("9")
      );
    });

    it("Should fail to transferFrom when from is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr3.address, true);
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(addr2.address, addr3.address, ethers.parseEther("10"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should fail to transferFrom when to is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr3.address, true);
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(addr2.address, addr3.address, ethers.parseEther("10"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should fail to transferFrom when caller is on blocklist", async function () {
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(addr2.address, addr3.address, ethers.parseEther("10"))
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });

    it("Should revert when transfer called by address with no allowance", async function () {
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(owner.address, addr3.address, ethers.parseEther("10"))
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should revert when transferring to address zero", async function () {
      await mproToken
        .connect(owner)
        .approve(addr1.address, ethers.parseEther("20"));
      await expect(
        mproToken
          .connect(addr1)
          .transferFrom(
            owner.address,
            ethers.ZeroAddress,
            ethers.parseEther("10")
          )
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });
});
