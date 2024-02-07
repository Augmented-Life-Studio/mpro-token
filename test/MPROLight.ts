import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { JAKANTMasterDistributor__factory, LZEndpointMock } from "../typechain-types";
import { JAKANTToken as JAKANTLight } from "../typechain-types/contracts/MPROLight.sol";
import { JAKANTToken } from "../typechain-types/contracts/MPRO.sol";
import { JAKANTToken__factory as JAKANTLight__factory } from "../typechain-types/factories/contracts/MPROLight.sol";
import { JAKANTToken__factory } from "../typechain-types/factories/contracts/MPRO.sol";
import { BytesLike } from "ethers";
import { JAKANTMasterDistributor } from "../typechain-types/contracts/MPROMasterDistributor.sol";

// npx hardhat test test/JAKANTLight.ts

describe("JAKANTLight", function () {
  const localChainId = 1
  const remoteChainId = 2
  let lzEndpointMock: LZEndpointMock
  let mproToken: JAKANTToken;
  let mproTokenLight: JAKANTLight;
  let masterDistributor: JAKANTMasterDistributor;
  let deployer: HardhatEthersSigner, owner: HardhatEthersSigner, lister: HardhatEthersSigner, addr1: HardhatEthersSigner, addr2: HardhatEthersSigner, addr3: HardhatEthersSigner;
  let localEndpoint, remoteEndpoint, deployerAddressBytes32: BytesLike

  let adapterParams = ethers.solidityPacked(["uint16", "uint256"], [1, 200000]) // default adapterParams example


  beforeEach(async function () {
    [deployer, owner, lister, addr1, addr2, addr3] = await ethers.getSigners();

    const MasterDistributorFactory = await ethers.getContractFactory("contracts/MPROMasterDistributorLight.sol:JAKANTMasterDistributor") as JAKANTMasterDistributor__factory;
    masterDistributor = await MasterDistributorFactory.deploy(owner.address);
    const masterDistributorAddress = await masterDistributor.getAddress();

    const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")

    localEndpoint = await LZEndpointMock.deploy(localChainId)
    remoteEndpoint = await LZEndpointMock.deploy(remoteChainId)

    await masterDistributor.connect(owner).grantRole(await masterDistributor.LISTER_ROLE(), lister.address);

    const MPROFactory: JAKANTToken__factory = await ethers.getContractFactory("contracts/MPRO.sol:JAKANTToken") as JAKANTToken__factory;
    mproToken = await MPROFactory.deploy(
      "MPRO",
      "MPRO",
      [owner.address, deployer.address], // Premint addresses
      [ethers.parseEther("100"), ethers.parseEther("100")], // Premint values
      localEndpoint.target, // LayerZero Endpoint
      masterDistributorAddress,
      deployer.address
    );

    const MPROFactoryLight = await ethers.getContractFactory("contracts/JAKANTLight.sol:MPRO") as JAKANTLight__factory;
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
    await mproTokenLight.setMinDstGas(localChainId, 1, 100000)

    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    deployerAddressBytes32 = abiCoder.encode(["address"], [deployer.address])

  });


  it("Should sendFrom() tokens correctly", async function () {
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
  it("Should properly get burnRate on transfer", async function () {
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

});