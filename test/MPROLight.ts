import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { LZEndpointMock, MPROMasterDistributor, MPROMasterDistributor__factory } from "../typechain-types";
import { MPRO as MPROLight } from "../typechain-types/contracts/MPROLight.sol";
import { MPRO } from "../typechain-types/contracts/MPRO.sol";
import { MPRO__factory as MPROLight__factory } from "../typechain-types/factories/contracts/MPROLight.sol";
import { MPRO__factory } from "../typechain-types/factories/contracts/MPRO.sol";
import { BytesLike } from "ethers";

// npx hardhat test test/MPROLight.ts

describe("MPROLight", function () {
  const localChainId = 1
  const remoteChainId = 2
  let lzEndpointMock: LZEndpointMock
  let mproToken: MPRO;
  let mproTokenLight: MPROLight;
  let masterDistributor: MPROMasterDistributor;
  let deployer: HardhatEthersSigner, owner: HardhatEthersSigner, lister: HardhatEthersSigner, addr1: HardhatEthersSigner, addr2: HardhatEthersSigner, addr3: HardhatEthersSigner;
  let localEndpoint, remoteEndpoint, deployerAddressBytes32: BytesLike

  let adapterParams = ethers.solidityPacked(["uint16", "uint256"], [1, 200000]) // default adapterParams example


  beforeEach(async function () {
    [deployer, owner, lister, addr1, addr2, addr3] = await ethers.getSigners();

    const MasterDistributorFactory = await ethers.getContractFactory("contracts/MPROMasterDistributorLight.sol:MPROMasterDistributor") as MPROMasterDistributor__factory;
    masterDistributor = await MasterDistributorFactory.deploy(owner.address);
    const masterDistributorAddress = await masterDistributor.getAddress();

    const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")

    localEndpoint = await LZEndpointMock.deploy(localChainId)
    remoteEndpoint = await LZEndpointMock.deploy(remoteChainId)

    await masterDistributor.connect(owner).grantRole(await masterDistributor.LISTER_ROLE(), lister.address);

    const MPROFactory: MPRO__factory = await ethers.getContractFactory("contracts/MPRO.sol:MPRO") as MPRO__factory;
    mproToken = await MPROFactory.deploy(
      "MPRO",
      "MPRO",
      [owner.address, deployer.address], // Premint addresses
      [ethers.parseEther("100"), ethers.parseEther("499999900")], // Premint values
      localEndpoint.target, // LayerZero Endpoint
      masterDistributorAddress,
      deployer.address
    );

    const MPROFactoryLight = await ethers.getContractFactory("contracts/MPROLight.sol:MPRO") as MPROLight__factory;
    mproTokenLight = await MPROFactoryLight.deploy(
      "MPRO",
      "MPRO",
      remoteEndpoint.target, // LayerZero Endpoint
      masterDistributorAddress,
      deployer.address,
    );

    // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
    await localEndpoint.setDestLzEndpoint(mproTokenLight.target, remoteEndpoint.target)
    await remoteEndpoint.setDestLzEndpoint(mproToken.target, localEndpoint.target)

    const remotePath = ethers.solidityPacked(
      ['address', 'address'],
      [mproTokenLight.target, mproToken.target],
    )

    const localPath = ethers.solidityPacked(
      ['address', 'address'],
      [mproToken.target, mproTokenLight.target],
    )

    await mproToken.setTrustedRemote(remoteChainId, remotePath)
    await mproTokenLight.setTrustedRemote(localChainId, localPath)

    await mproToken.setMinDstGas(remoteChainId, 0, 100000)
    await mproTokenLight.setMinDstGas(localChainId, 0, 100000)

    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    deployerAddressBytes32 = abiCoder.encode(["address"], [deployer.address])

  });

  describe("burn() function", function () {
    beforeEach(async function () {
      let totalAmount = ethers.parseEther("100")
      let nativeFee = (await mproToken.estimateSendFee(remoteChainId, deployerAddressBytes32, totalAmount, false, adapterParams))

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        { refundAddress: owner.address, zroPaymentAddress: ethers.ZeroAddress, adapterParams },
        { value: nativeFee[0] } // pass a msg.value to pay the LayerZero message fee
      )
    })
    it("Should burn tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100")
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(totalAmount)
      await mproTokenLight.connect(deployer).burn(deployer.address, totalAmount)
      expect(await mproTokenLight.totalSupply()).to.equal(0)
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0)
    });
  })
  describe("approve() function", function () {
    it("Should approve tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100")
      await mproTokenLight.connect(deployer).approve(addr1.address, totalAmount)
      expect(await mproTokenLight.allowance(deployer.address, addr1.address)).to.equal(totalAmount)
    });
    it("Should revert when user is not allowed to approve", async function () {
      // set addr1 to blocklist
      await masterDistributor.connect(lister).blocklist(addr1.address, true)
      const totalAmount = ethers.parseEther("100")
      await expect(mproTokenLight.connect(addr1).approve(addr2.address, totalAmount)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account")
    })
  })
  describe("transfer() function", function () {
    beforeEach(async function () {
      let totalAmount = ethers.parseEther("100")
      let nativeFee = (await mproToken.estimateSendFee(remoteChainId, deployerAddressBytes32, totalAmount, false, adapterParams))

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        { refundAddress: owner.address, zroPaymentAddress: ethers.ZeroAddress, adapterParams },
        { value: nativeFee[0] } // pass a msg.value
      )
    })
    it("Should transfer tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100")
      await mproTokenLight.connect(deployer).transfer(addr1.address, totalAmount)
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0)
      const burnRate = await masterDistributor.burnRate()
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal((Number(totalAmount) - (Number(totalAmount) * Number(burnRate) / 10 ** 4)).toString())
    });
    it("Should revert when user is not allowed to transfer", async function () {
      // set addr1 to blocklist
      await masterDistributor.connect(lister).blocklist(addr1.address, true)
      const totalAmount = ethers.parseEther("100")
      await expect(mproTokenLight.connect(addr1).transfer(addr2.address, totalAmount)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account")
    })
  })

  describe("transferFrom() function", function () {
    beforeEach(async function () {
      let totalAmount = ethers.parseEther("100")
      let nativeFee = (await mproToken.estimateSendFee(remoteChainId, deployerAddressBytes32, totalAmount, false, adapterParams))

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        { refundAddress: owner.address, zroPaymentAddress: ethers.ZeroAddress, adapterParams },
        { value: nativeFee[0] } // pass a msg.value
      )
    })
    it("Should transferFrom tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100")
      await mproTokenLight.connect(deployer).transferFrom(deployer.address, addr1.address, totalAmount)
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0)
      const burnRate = await masterDistributor.burnRate()
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal((Number(totalAmount) - (Number(totalAmount) * Number(burnRate) / 10 ** 4)).toString())
    });
    it("Should revert when user is not allowed to transfer", async function () {
      // set addr1 to blocklist
      await masterDistributor.connect(lister).blocklist(addr1.address, true)
      const totalAmount = ethers.parseEther("100")
      await expect(mproTokenLight.connect(addr1).transferFrom(addr1.address, addr2.address, totalAmount)).to.be.revertedWith("MPROMasterDistributor: Action on blocklisted account")
    })
  })
  it("sendFrom() function", async function () {
    let totalAmount = ethers.parseEther("8")
    let nativeFee = (await mproToken.estimateSendFee(remoteChainId, deployerAddressBytes32, totalAmount, false, adapterParams))

    await mproToken.connect(owner).sendFrom(
      owner.address, // source address to send tokens from
      remoteChainId, // destination chainId
      deployerAddressBytes32, // destination address to send tokens to
      totalAmount, // quantity of tokens to send (in units of wei)
      { refundAddress: owner.address, zroPaymentAddress: ethers.ZeroAddress, adapterParams },
      { value: nativeFee[0] } // pass a msg.value to pay the LayerZero message fee
    )
    expect(await mproToken.balanceOf(owner.address)).to.equal(ethers.parseEther("92"))
    expect(await mproTokenLight.totalSupply()).to.equal(totalAmount)
    expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(totalAmount)
  });
  it("burnRate() on transfer", async function () {
    const totalAmount = ethers.parseEther("100")
    expect(await masterDistributor.burnRate()).to.equal(10 ** 3)
    let nativeFee = (await mproToken.estimateSendFee(remoteChainId, deployerAddressBytes32, totalAmount, false, adapterParams))
    await mproToken.connect(owner).sendFrom(
      owner.address, // source address to send tokens from
      remoteChainId, // destination chainId
      deployerAddressBytes32, // destination address to send tokens to
      totalAmount, // quantity of tokens to send (in units of wei)
      { refundAddress: owner.address, zroPaymentAddress: ethers.ZeroAddress, adapterParams },
      { value: nativeFee[0] } // pass a msg.value to pay the LayerZero message fee
    )
    expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(ethers.parseEther("100"))
    await mproTokenLight.connect(deployer).transfer(addr1.address, ethers.parseEther("100"))
    expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(ethers.parseEther("90"))
  })
  it("sendFrom() local and sendFrom() remote", async function () {
    const totalAmount = ethers.parseEther("100")
    expect(await masterDistributor.burnRate()).to.equal(10 ** 3)
    let nativeFee = (await mproToken.estimateSendFee(remoteChainId, deployerAddressBytes32, totalAmount, false, adapterParams))
    await mproToken.connect(owner).sendFrom(
      owner.address, // source address to send tokens from
      remoteChainId, // destination chainId
      deployerAddressBytes32, // destination address to send tokens to
      totalAmount, // quantity of tokens to send (in units of wei)
      { refundAddress: owner.address, zroPaymentAddress: ethers.ZeroAddress, adapterParams },
      { value: nativeFee[0] } // pass a msg.value to pay the LayerZero message fee
    )

    await mproTokenLight.connect(deployer).sendFrom(
      deployer.address, // source address to send tokens from
      localChainId, // destination chainId
      deployerAddressBytes32, // destination address to send tokens to
      totalAmount, // quantity of tokens to send (in units of wei)
      { refundAddress: owner.address, zroPaymentAddress: ethers.ZeroAddress, adapterParams },
      { value: nativeFee[0] } // pass a msg.value to pay the LayerZero message fee
    )
  })

});