import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  LZEndpointMock,
  MPROMasterDistributor,
  MPROMasterDistributor__factory,
} from "../typechain-types";
import { MPRO as MPROLight } from "../typechain-types/contracts/MPROLight.sol";
import { MPRO } from "../typechain-types/contracts/MPRO.sol";
import { MPRO__factory as MPROLight__factory } from "../typechain-types/factories/contracts/MPROLight.sol";
import { MPRO__factory } from "../typechain-types/factories/contracts/MPRO.sol";
import { BytesLike } from "ethers";
import { mproMasterDistributorSol } from "../typechain-types/contracts";

// npx hardhat test test/MPROLight.ts

describe("MPROLight", function () {
  const localChainId = 1;
  const remoteChainId = 2;
  const remoteChainId2 = 3;
  let lzEndpointMock: LZEndpointMock;
  let mproToken: MPRO;
  let mproTokenLight: MPROLight;
  let mproTokenLight2: MPROLight;
  let masterDistributor: MPROMasterDistributor;
  let deployer: HardhatEthersSigner,
    owner: HardhatEthersSigner,
    lister: HardhatEthersSigner,
    addr1: HardhatEthersSigner,
    addr2: HardhatEthersSigner,
    addr3: HardhatEthersSigner;
  let localEndpoint,
    remoteEndpoint,
    remoteEndpoint2,
    deployerAddressBytes32local: BytesLike,
    deployerAddressBytes322: BytesLike,
    deployerAddressBytes32: BytesLike;

  let adapterParams = ethers.solidityPacked(["uint16", "uint256"], [1, 200000]); // default adapterParams example

  beforeEach(async function () {
    [deployer, owner, lister, addr1, addr2, addr3] = await ethers.getSigners();

    const MasterDistributorFactory = (await ethers.getContractFactory(
      "contracts/MPROMasterDistributorLight.sol:MPROMasterDistributor"
    )) as MPROMasterDistributor__factory;
    masterDistributor = await MasterDistributorFactory.deploy(owner.address);
    const masterDistributorAddress = await masterDistributor.getAddress();

    const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock");

    localEndpoint = await LZEndpointMock.deploy(localChainId);
    remoteEndpoint = await LZEndpointMock.deploy(remoteChainId);
    remoteEndpoint2 = await LZEndpointMock.deploy(remoteChainId2);

    await masterDistributor
      .connect(owner)
      .grantRole(await masterDistributor.LISTER_ROLE(), lister.address);

    const MPROFactory: MPRO__factory = (await ethers.getContractFactory(
      "contracts/MPRO.sol:MPRO"
    )) as MPRO__factory;
    mproToken = await MPROFactory.deploy(
      "MPRO",
      "MPRO",
      [owner.address, deployer.address, addr3.address], // Premint addresses
      [
        ethers.parseEther("100"),
        ethers.parseEther("100"),
        ethers.parseEther("499999800"),
      ], // Premint values
      localEndpoint.target, // LayerZero Endpoint
      masterDistributorAddress,
      deployer.address
    );

    const MPROFactoryLight = (await ethers.getContractFactory(
      "contracts/MPROLight.sol:MPRO"
    )) as MPROLight__factory;
    mproTokenLight = await MPROFactoryLight.deploy(
      "MPRO",
      "MPRO",
      remoteEndpoint.target, // LayerZero Endpoint
      masterDistributorAddress,
      deployer.address
    );

    const MPROFactoryLight2 = (await ethers.getContractFactory(
      "contracts/MPROLight.sol:MPRO"
    )) as MPROLight__factory;
    mproTokenLight2 = await MPROFactoryLight2.deploy(
      "MPRO",
      "MPRO",
      remoteEndpoint2.target, // LayerZero Endpoint
      masterDistributorAddress,
      deployer.address
    );

    // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
    await localEndpoint.setDestLzEndpoint(
      mproTokenLight.target,
      remoteEndpoint.target
    );
    await remoteEndpoint.setDestLzEndpoint(
      mproToken.target,
      localEndpoint.target
    );

    await localEndpoint.setDestLzEndpoint(
      mproTokenLight2.target,
      remoteEndpoint2.target
    );
    await remoteEndpoint2.setDestLzEndpoint(
      mproToken.target,
      localEndpoint.target
    );

    await remoteEndpoint.setDestLzEndpoint(
      mproTokenLight2.target,
      remoteEndpoint2
    );
    await remoteEndpoint2.setDestLzEndpoint(
      mproTokenLight.target,
      remoteEndpoint
    );

    const remotePath = ethers.solidityPacked(
      ["address", "address"],
      [mproTokenLight.target, mproToken.target]
    );

    const localPath = ethers.solidityPacked(
      ["address", "address"],
      [mproToken.target, mproTokenLight.target]
    );

    const remotePath2 = ethers.solidityPacked(
      ["address", "address"],
      [mproTokenLight2.target, mproToken.target]
    );

    const localPath2 = ethers.solidityPacked(
      ["address", "address"],
      [mproToken.target, mproTokenLight2.target]
    );

    const lightLightPath = ethers.solidityPacked(
      ["address", "address"],
      [mproTokenLight2.target, mproTokenLight.target]
    );

    const lightLightPath2 = ethers.solidityPacked(
      ["address", "address"],
      [mproTokenLight.target, mproTokenLight2.target]
    );

    await mproToken.setTrustedRemote(remoteChainId, remotePath);
    await mproTokenLight.setTrustedRemote(localChainId, localPath);

    // Added
    await mproToken.setTrustedRemote(remoteChainId2, remotePath2);
    await mproTokenLight2.setTrustedRemote(localChainId, localPath2);

    await mproTokenLight.setTrustedRemote(remoteChainId2, lightLightPath);
    await mproTokenLight2.setTrustedRemote(remoteChainId, lightLightPath2);

    await mproToken.setMinDstGas(remoteChainId, 0, 100000);
    await mproTokenLight.setMinDstGas(localChainId, 0, 100000);

    // Added
    await mproToken.setMinDstGas(remoteChainId2, 0, 100000);
    await mproTokenLight2.setMinDstGas(localChainId, 0, 100000);

    await mproTokenLight.setMinDstGas(remoteChainId2, 0, 100000);
    await mproTokenLight2.setMinDstGas(remoteChainId, 0, 100000);

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    deployerAddressBytes32 = abiCoder.encode(["address"], [deployer.address]);
    deployerAddressBytes322 = abiCoder.encode(["address"], [deployer.address]);
    deployerAddressBytes32local = abiCoder.encode(
      ["address"],
      [deployer.address]
    );
  });

  describe("burn() function", function () {
    beforeEach(async function () {
      let totalAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        totalAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value to pay the LayerZero message fee
      );
    });
    it("Should burn tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100");
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        totalAmount
      );
      await mproTokenLight
        .connect(deployer)
        .burn(deployer.address, totalAmount);
      expect(await mproTokenLight.totalSupply()).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
    });
  });
  describe("approve() function", function () {
    it("Should approve tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100");
      await mproTokenLight
        .connect(deployer)
        .approve(addr1.address, totalAmount);
      expect(
        await mproTokenLight.allowance(deployer.address, addr1.address)
      ).to.equal(totalAmount);
    });
    it("Should revert when user is not allowed to approve", async function () {
      // set addr1 to blocklist
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      const totalAmount = ethers.parseEther("100");
      await expect(
        mproTokenLight.connect(addr1).approve(addr2.address, totalAmount)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });
  });
  describe("transfer() function", function () {
    beforeEach(async function () {
      let totalAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        totalAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
    });
    it("Should transfer tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100");
      await mproTokenLight
        .connect(deployer)
        .transfer(addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      const burnRate = await masterDistributor.burnRate();
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });
    it("Should revert when user is not allowed to transfer", async function () {
      // set addr1 to blocklist
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      const totalAmount = ethers.parseEther("100");
      await expect(
        mproTokenLight.connect(addr1).transfer(addr2.address, totalAmount)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });
  });

  describe("transferFrom() function", function () {
    beforeEach(async function () {
      let totalAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        totalAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
    });
    it("Should transferFrom tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100");
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      const burnRate = await masterDistributor.burnRate();
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });
    it("Should revert when user is not allowed to transfer", async function () {
      // set addr1 to blocklist
      await masterDistributor.connect(lister).blocklist(addr1.address, true);
      const totalAmount = ethers.parseEther("100");
      await expect(
        mproTokenLight
          .connect(addr1)
          .transferFrom(addr1.address, addr2.address, totalAmount)
      ).to.be.revertedWith(
        "MPROMasterDistributor: Action on blocklisted account"
      );
    });
  });
  it("sendFrom() function", async function () {
    let totalAmount = ethers.parseEther("8");
    let nativeFee = await mproToken.estimateSendFee(
      remoteChainId,
      deployerAddressBytes32,
      totalAmount,
      false,
      adapterParams
    );

    await mproToken.connect(owner).sendFrom(
      owner.address, // source address to send tokens from
      remoteChainId, // destination chainId
      deployerAddressBytes32, // destination address to send tokens to
      totalAmount, // quantity of tokens to send (in units of wei)
      {
        refundAddress: owner.address,
        zroPaymentAddress: ethers.ZeroAddress,
        adapterParams,
      },
      { value: nativeFee[0] } // pass a msg.value to pay the LayerZero message fee
    );
    expect(await mproToken.balanceOf(owner.address)).to.equal(
      ethers.parseEther("92")
    );
    expect(await mproTokenLight.totalSupply()).to.equal(totalAmount);
    expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
      totalAmount
    );
  });

  it("burnRate() on transfer", async function () {
    const totalAmount = ethers.parseEther("100");
    expect(await masterDistributor.burnRate()).to.equal(10 ** 3);
    let nativeFee = await mproToken.estimateSendFee(
      remoteChainId,
      deployerAddressBytes32,
      totalAmount,
      false,
      adapterParams
    );
    await mproToken.connect(owner).sendFrom(
      owner.address, // source address to send tokens from
      remoteChainId, // destination chainId
      deployerAddressBytes32, // destination address to send tokens to
      totalAmount, // quantity of tokens to send (in units of wei)
      {
        refundAddress: owner.address,
        zroPaymentAddress: ethers.ZeroAddress,
        adapterParams,
      },
      { value: nativeFee[0] } // pass a msg.value to pay the LayerZero message fee
    );
    expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
      ethers.parseEther("100")
    );
    await mproTokenLight
      .connect(deployer)
      .transfer(addr1.address, ethers.parseEther("100"));
    expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
      ethers.parseEther("90")
    );
  });

  /*
          Bridges
          */

  describe("sendFrom() function, Bridge: Token -> Light", function () {
    it("Should properly send some tokens", async function () {
      let sendAmount = ethers.parseEther("10");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("90")
      );
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send when amount is floating value", async function () {
      let sendAmount = ethers.parseEther("0.1");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.9")
      );
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("OFTCore: amount too small");
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        let nativeFee = await mproToken.estimateSendFee(
          remoteChainId,
          deployerAddressBytes32,
          sendAmount,
          false,
          adapterParams
        );
        throw new Error("estimating sendFee successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_amount", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount2,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount2, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId, // destination chainId
          "0x123", // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should throw error when source address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproToken.connect(owner).sendFrom(
          "0x123", // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
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

    it("Should revert when source address is address zero", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          ethers.ZeroAddress, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          4, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("LzApp: minGasLimit not set");
    });

    it("Should revert when source address is different than connect address", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          deployer.address, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.999999")
      );
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all minted tokens (500m)", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);
      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        tokensMinted,
        false,
        adapterParams
      );
      await mproToken.connect(owner).transfer(addr3.address, sendAmount);
      await mproToken.connect(deployer).transfer(addr3.address, sendAmount);
      expect(await mproToken.balanceOf(addr3.address)).to.equal(tokensMinted);
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });

    it("Should properly send all minted tokens back to MPROToken address", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);
      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        tokensMinted,
        false,
        adapterParams
      );
      await mproToken.connect(owner).transfer(addr3.address, sendAmount);
      await mproToken.connect(deployer).transfer(addr3.address, sendAmount);
      expect(await mproToken.balanceOf(addr3.address)).to.equal(tokensMinted);
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );

      let sendAmount2 = tokensMinted;
      let nativeFee2 = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount2,
        false,
        adapterParams
      );
      await mproTokenLight.connect(deployer).sendFrom(
        deployer.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount2, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Token -> Light2", function () {
    it("Should properly send some tokens", async function () {
      let sendAmount = ethers.parseEther("10");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("90")
      );
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = ethers.parseEther("10");
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send when amount is floating value", async function () {
      let sendAmount = ethers.parseEther("0.1");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.9")
      );
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("OFTCore: amount too small");
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        let nativeFee = await mproToken.estimateSendFee(
          remoteChainId2,
          deployerAddressBytes322,
          sendAmount,
          false,
          adapterParams
        );
        throw new Error("estimating sendFee successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_amount", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount2,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount2, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          "0x123", // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should throw error when source address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproToken.connect(owner).sendFrom(
          "0x123", // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
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

    it("Should revert when source address is address zero", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          ethers.ZeroAddress, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          4, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("LzApp: minGasLimit not set");
    });

    it("Should revert when source address is different than connect address", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproToken.connect(owner).sendFrom(
          deployer.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.999999")
      );
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all minted tokens (500m)", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);
      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        tokensMinted,
        false,
        adapterParams
      );
      await mproToken.connect(owner).transfer(addr3.address, sendAmount);
      await mproToken.connect(deployer).transfer(addr3.address, sendAmount);
      expect(await mproToken.balanceOf(addr3.address)).to.equal(tokensMinted);
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });

    it("Should properly send all minted tokens back to MPROToken address", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);
      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        tokensMinted,
        false,
        adapterParams
      );
      await mproToken.connect(owner).transfer(addr3.address, sendAmount);
      await mproToken.connect(deployer).transfer(addr3.address, sendAmount);
      expect(await mproToken.balanceOf(addr3.address)).to.equal(tokensMinted);
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );

      let sendAmount2 = tokensMinted;
      let nativeFee2 = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount2,
        false,
        adapterParams
      );
      await mproTokenLight2.connect(deployer).sendFrom(
        deployer.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount2, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Light2 -> Light", function () {
    beforeEach(async function () {
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      let totalAmount = ethers.parseEther("100");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        totalAmount,
        false,
        adapterParams
      );
      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee2[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        totalAmount
      );
      const transferAmount = ethers.parseEther("100");
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, owner.address, transferAmount);
      await masterDistributor
        .connect(lister)
        .whitelist(deployer.address, false);
    });
    it("Should send some tokens correctly", async function () {
      let sendAmount = ethers.parseEther("10");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );
      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );
      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send when amount is floating value", async function () {
      let sendAmount = ethers.parseEther("0.1");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.9")
      );
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("OFTCore: amount too small");
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        let nativeFee = await mproToken.estimateSendFee(
          remoteChainId,
          deployerAddressBytes32,
          sendAmount,
          false,
          adapterParams
        );
        throw new Error("estimating sendFee successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_amount", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount2,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount2, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId, // destination chainId
          "0x123", // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should throw error when source address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproTokenLight2.connect(owner).sendFrom(
          "0x123", // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
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

    it("Should revert when source address is address zero", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          ethers.ZeroAddress, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          4, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("LzApp: minGasLimit not set");
    });

    it("Should revert when source address is different than connect address", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          deployer.address, // source address to send tokens from
          remoteChainId, // destination chainId
          deployerAddressBytes32, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.999999")
      );
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        sendAmount
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all minted tokens (500m)", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);

      await mproToken
        .connect(deployer)
        .transfer(addr3.address, ethers.parseEther("100"));
      const tokensDeployer = ethers.parseEther("499999900");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        tokensDeployer,
        false,
        adapterParams
      );
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        tokensDeployer, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee2[0] } // pass a msg.value
      );
      await mproTokenLight2
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        tokensMinted,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight2.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });

    it("Should properly send all minted tokens back to MPROToken address", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);

      await mproToken
        .connect(deployer)
        .transfer(addr3.address, ethers.parseEther("100"));
      const tokensDeployer = ethers.parseEther("499999900");
      let nativeFee3 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        tokensDeployer,
        false,
        adapterParams
      );
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        tokensDeployer, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee3[0] } // pass a msg.value
      );
      await mproTokenLight2
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        tokensMinted,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight2.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );

      let sendAmount2 = tokensMinted;
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount2,
        false,
        adapterParams
      );
      await mproTokenLight.connect(deployer).sendFrom(
        deployer.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount2, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Light2 -> Token", function () {
    beforeEach(async function () {
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      let totalAmount = ethers.parseEther("100");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        totalAmount,
        false,
        adapterParams
      );
      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee2[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        totalAmount
      );
      const transferAmount = ethers.parseEther("100");
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, owner.address, transferAmount);
      await masterDistributor
        .connect(lister)
        .whitelist(deployer.address, false);
    });
    it("Should send some tokens correctly", async function () {
      let sendAmount = ethers.parseEther("10");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );
      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproToken
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );
      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(0);

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproToken
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send when amount is floating value", async function () {
      let sendAmount = ethers.parseEther("0.1");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.9")
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproToken
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("OFTCore: amount too small");
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        let nativeFee = await mproToken.estimateSendFee(
          localChainId,
          deployerAddressBytes32local,
          sendAmount,
          false,
          adapterParams
        );
        throw new Error("estimating sendFee successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_amount", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      let nativeFee2 = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount2,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount2, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          localChainId, // destination chainId
          "0x123", // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should throw error when source address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproTokenLight2.connect(owner).sendFrom(
          "0x123", // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
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

    it("Should revert when source address is address zero", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          ethers.ZeroAddress, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          4, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("LzApp: minGasLimit not set");
    });

    it("Should revert when source address is different than connect address", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight2.connect(owner).sendFrom(
          deployer.address, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.999999")
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproToken
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all minted tokens (500m)", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);

      await mproToken
        .connect(deployer)
        .transfer(addr3.address, ethers.parseEther("100"));
      const tokensDeployer = ethers.parseEther("499999900");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        tokensDeployer,
        false,
        adapterParams
      );
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        tokensDeployer, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee2[0] } // pass a msg.value
      );
      await mproTokenLight2
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        tokensMinted,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight2.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(0);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });

    it("Should properly send all minted tokens back to MPROTokenLight2 address", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);

      await mproToken
        .connect(deployer)
        .transfer(addr3.address, ethers.parseEther("100"));
      const tokensDeployer = ethers.parseEther("499999900");
      let nativeFee3 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        tokensDeployer,
        false,
        adapterParams
      );
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        tokensDeployer, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee3[0] } // pass a msg.value
      );
      await mproTokenLight2
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        tokensMinted,
        false,
        adapterParams
      );

      await mproTokenLight2.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight2.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(0);
      let sendAmount2 = tokensMinted;
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount2,
        false,
        adapterParams
      );
      await mproToken.connect(deployer).sendFrom(
        deployer.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount2, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Light -> Token", function () {
    beforeEach(async function () {
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      let totalAmount = ethers.parseEther("100");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        totalAmount,
        false,
        adapterParams
      );
      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee2[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        totalAmount
      );
      const transferAmount = ethers.parseEther("100");
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, owner.address, transferAmount);
      await masterDistributor
        .connect(lister)
        .whitelist(deployer.address, false);
    });
    it("Should send some correctly", async function () {
      let sendAmount = ethers.parseEther("10");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );
      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproToken
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );
      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(0);

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproToken
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send when amount is floating value", async function () {
      let sendAmount = ethers.parseEther("0.1");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.9")
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproToken
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("OFTCore: amount too small");
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        let nativeFee = await mproToken.estimateSendFee(
          localChainId,
          deployerAddressBytes32local,
          sendAmount,
          false,
          adapterParams
        );
        throw new Error("estimating sendFee successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_amount", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      let nativeFee2 = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount2,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount2, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          localChainId, // destination chainId
          "0x123", // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should throw error when source address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproTokenLight.connect(owner).sendFrom(
          "0x123", // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
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

    it("Should revert when source address is address zero", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          ethers.ZeroAddress, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          4, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("LzApp: minGasLimit not set");
    });

    it("Should revert when source address is different than connect address", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          deployer.address, // source address to send tokens from
          localChainId, // destination chainId
          deployerAddressBytes32local, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.999999")
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproToken
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        ethers.parseEther("100")
      );
      expect(await mproToken.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all minted tokens (500m)", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);

      await mproToken
        .connect(deployer)
        .transfer(addr3.address, ethers.parseEther("100"));
      const tokensDeployer = ethers.parseEther("499999900");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        tokensDeployer,
        false,
        adapterParams
      );
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        tokensDeployer, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee2[0] } // pass a msg.value
      );
      await mproTokenLight
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        tokensMinted,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(0);
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });

    it("Should properly send all minted tokens back to MPROTokenLight address", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);

      await mproToken
        .connect(deployer)
        .transfer(addr3.address, ethers.parseEther("100"));
      const tokensDeployer = ethers.parseEther("499999900");
      let nativeFee3 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        tokensDeployer,
        false,
        adapterParams
      );
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        tokensDeployer, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee3[0] } // pass a msg.value
      );
      await mproTokenLight
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        localChainId,
        deployerAddressBytes32local,
        tokensMinted,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        localChainId, // destination chainId
        deployerAddressBytes32local, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(0);
      let sendAmount2 = tokensMinted;
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount2,
        false,
        adapterParams
      );
      await mproToken.connect(deployer).sendFrom(
        deployer.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount2, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Light -> Light2", function () {
    beforeEach(async function () {
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      let totalAmount = ethers.parseEther("100");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        totalAmount,
        false,
        adapterParams
      );
      await mproToken.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        totalAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee2[0] } // pass a msg.value
      );
      expect(await mproToken.balanceOf(owner.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        totalAmount
      );
      const transferAmount = ethers.parseEther("100");
      await mproTokenLight
        .connect(deployer)
        .transferFrom(deployer.address, owner.address, transferAmount);
      await masterDistributor
        .connect(lister)
        .whitelist(deployer.address, false);
    });
    it("Should send some correctly", async function () {
      let sendAmount = ethers.parseEther("10");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );
      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );
      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(0);

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send when amount is floating value", async function () {
      let sendAmount = ethers.parseEther("0.1");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.9")
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("OFTCore: amount too small");
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        let nativeFee = await mproToken.estimateSendFee(
          remoteChainId2,
          deployerAddressBytes322,
          sendAmount,
          false,
          adapterParams
        );
        throw new Error("estimating sendFee successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: value out-of-bounds (argument="_amount", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount2,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount2, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          "0x123", // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
      } catch (error) {
        if (
          error ==
          'TypeError: invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.10.0)'
        ) {
        } else {
          console.log(error);
        }
      }
    });

    it("Should throw error when source address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      try {
        await mproTokenLight.connect(owner).sendFrom(
          "0x123", // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        );
        throw new Error("send successful - should not be");
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

    it("Should revert when source address is address zero", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          ethers.ZeroAddress, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          owner.address, // source address to send tokens from
          4, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("LzApp: minGasLimit not set");
    });

    it("Should revert when source address is different than connect address", async function () {
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await expect(
        mproTokenLight.connect(owner).sendFrom(
          deployer.address, // source address to send tokens from
          remoteChainId2, // destination chainId
          deployerAddressBytes322, // destination address to send tokens to
          sendAmount, // quantity of tokens to send (in units of wei)
          {
            refundAddress: owner.address,
            zroPaymentAddress: ethers.ZeroAddress,
            adapterParams,
          },
          { value: nativeFee[0] } // pass a msg.value
        )
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        sendAmount,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).sendFrom(
        owner.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        sendAmount, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(
        ethers.parseEther("99.999999")
      );

      const totalAmount = sendAmount;
      const burnRate = await masterDistributor.burnRate();
      await mproTokenLight2
        .connect(deployer)
        .transferFrom(deployer.address, addr1.address, totalAmount);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(addr1.address)).to.equal(
        (
          Number(totalAmount) -
          (Number(totalAmount) * Number(burnRate)) / 10 ** 4
        ).toString()
      );
    });

    it("Should properly send all minted tokens (500m)", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);

      await mproToken
        .connect(deployer)
        .transfer(addr3.address, ethers.parseEther("100"));
      const tokensDeployer = ethers.parseEther("499999900");
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        tokensDeployer,
        false,
        adapterParams
      );
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        tokensDeployer, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee2[0] } // pass a msg.value
      );
      await mproTokenLight
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        tokensMinted,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });

    it("Should properly send all minted tokens back to MPROTokenLight address", async function () {
      await masterDistributor.connect(lister).whitelist(owner.address, true);
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      await masterDistributor.connect(lister).whitelist(addr3.address, true);

      await mproToken
        .connect(deployer)
        .transfer(addr3.address, ethers.parseEther("100"));
      const tokensDeployer = ethers.parseEther("499999900");
      let nativeFee3 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        tokensDeployer,
        false,
        adapterParams
      );
      await mproToken.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        tokensDeployer, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee3[0] } // pass a msg.value
      );
      await mproTokenLight
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      let nativeFee = await mproToken.estimateSendFee(
        remoteChainId2,
        deployerAddressBytes322,
        tokensMinted,
        false,
        adapterParams
      );

      await mproTokenLight.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight.connect(addr3).sendFrom(
        addr3.address, // source address to send tokens from
        remoteChainId2, // destination chainId
        deployerAddressBytes322, // destination address to send tokens to
        tokensMinted, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(0);
      let sendAmount2 = tokensMinted;
      let nativeFee2 = await mproToken.estimateSendFee(
        remoteChainId,
        deployerAddressBytes32,
        sendAmount2,
        false,
        adapterParams
      );
      await mproTokenLight2.connect(deployer).sendFrom(
        deployer.address, // source address to send tokens from
        remoteChainId, // destination chainId
        deployerAddressBytes32, // destination address to send tokens to
        sendAmount2, // quantity of tokens to send (in units of wei)
        {
          refundAddress: owner.address,
          zroPaymentAddress: ethers.ZeroAddress,
          adapterParams,
        },
        { value: nativeFee[0] } // pass a msg.value
      );
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });
});
