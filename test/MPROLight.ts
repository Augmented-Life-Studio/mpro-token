import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  EndpointV2Mock,
  LZMock__factory,
  MPROMasterDistributor,
  MPROMasterDistributor__factory,
} from "../typechain-types";
import { MPRO as MPROLight } from "../typechain-types/contracts/MPROLight.sol";
import { MPRO } from "../typechain-types/contracts/MPRO.sol";
import { MPRO__factory as MPROLight__factory } from "../typechain-types/factories/contracts/MPROLight.sol";
import { MPRO__factory } from "../typechain-types/factories/contracts/MPRO.sol";
import { mproMasterDistributorSol } from "../typechain-types/contracts";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { SendParamStruct } from "../typechain-types/contracts/MPRO.sol/MPRO";

// npx hardhat test test/MPROLight.ts

const zeroPad = (data: string, length: number): Uint8Array => {
  return ethers.getBytes(ethers.zeroPadValue(data, length), "hex")
}
const zero = ethers.toBigInt(0);

const createSendParams = (chainId: number, receiver: string, quantity: bigint): SendParamStruct => {
  let localReceiver = zeroPad(receiver, 32);
  if (receiver === "x0123") {
    localReceiver === Uint8Array.from([]);
  }
  const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

  const sendParam = [
    chainId,
    localReceiver,
    quantity,
    quantity,
    options,
    '0x',
    '0x',
  ] as unknown as SendParamStruct;
  return sendParam;
}

describe("MPROLight", function () {
  let tx
  const localChainId = 1;
  const remoteChainId = 2;
  const remoteChainId2 = 3;
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
    remoteEndpoint2;

  beforeEach(async function () {
    [deployer, owner, lister, addr1, addr2, addr3] = await ethers.getSigners();

    const MasterDistributorFactory = (await ethers.getContractFactory(
      "contracts/MPROMasterDistributorLight.sol:MPROMasterDistributor"
    )) as MPROMasterDistributor__factory;
    masterDistributor = await MasterDistributorFactory.deploy(owner.address);
    const masterDistributorAddress = await masterDistributor.getAddress();

    const LZMockFactory = await ethers.getContractFactory("contracts/mocks/LZEndpointMock.sol:LZMock") as LZMock__factory;

    localEndpoint = await LZMockFactory.deploy(localChainId);
    remoteEndpoint = await LZMockFactory.deploy(remoteChainId);
    remoteEndpoint2 = await LZMockFactory.deploy(remoteChainId2);

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
      owner.address
    );

    const mproLocalAddress = mproToken.target as string;

    const MPROFactoryLight = (await ethers.getContractFactory(
      "contracts/MPROLight.sol:MPRO"
    )) as MPROLight__factory;
    mproTokenLight = await MPROFactoryLight.deploy(
      "MPRO",
      "MPRO",
      remoteEndpoint.target, // LayerZero Endpoint
      masterDistributorAddress,
      owner.address
    );

    const mproRemoteAddress1 = mproTokenLight.target as string;

    const MPROFactoryLight2 = (await ethers.getContractFactory(
      "contracts/MPROLight.sol:MPRO"
    )) as MPROLight__factory;
    mproTokenLight2 = await MPROFactoryLight2.deploy(
      "MPRO",
      "MPRO",
      remoteEndpoint2.target, // LayerZero Endpoint
      masterDistributorAddress,
      owner.address
    );

    const mproRemoteAddress2 = mproTokenLight2.target as string;

    // // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
    await localEndpoint.setDestLzEndpoint(
      mproRemoteAddress1,
      remoteEndpoint.target
    );
    await localEndpoint.setDestLzEndpoint(
      mproRemoteAddress2,
      remoteEndpoint2.target
    );

    await remoteEndpoint.setDestLzEndpoint(
      mproLocalAddress,
      localEndpoint.target
    );
    await remoteEndpoint.setDestLzEndpoint(
      mproRemoteAddress2,
      remoteEndpoint2.target
    );

    await remoteEndpoint2.setDestLzEndpoint(
      mproLocalAddress,
      localEndpoint.target
    );
    await remoteEndpoint2.setDestLzEndpoint(
      mproRemoteAddress1,
      remoteEndpoint.target
    );

    const localPeer1 = zeroPad(
      mproRemoteAddress1, 32
    );
    const localPeer2 = zeroPad(
      mproRemoteAddress2, 32
    );

    const remotePeer1 = zeroPad(
      mproLocalAddress, 32
    );
    const remotePeer2 = zeroPad(
      mproRemoteAddress2, 32
    );

    const remotePeer3 = zeroPad(
      mproLocalAddress, 32
    );
    const remotePeer4 = zeroPad(
      mproRemoteAddress1, 32
    );

    tx = await mproToken.connect(owner).setPeer(remoteChainId, localPeer1);
    await tx.wait();
    tx = await mproToken.connect(owner).setPeer(remoteChainId2, localPeer2);
    await tx.wait();
    // Added
    tx = await mproTokenLight.connect(owner).setPeer(localChainId, remotePeer1);
    await tx.wait();
    tx = await mproTokenLight.connect(owner).setPeer(remoteChainId2, remotePeer2);
    await tx.wait();
    tx = await mproTokenLight2.connect(owner).setPeer(localChainId, remotePeer3);
    await tx.wait();
    tx = await mproTokenLight2.connect(owner).setPeer(remoteChainId, remotePeer4);
    await tx.wait();


  });

  describe("burn() function", function () {
    beforeEach(async function () {
      let totalAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId, deployer.address, totalAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, deployer.address, { value: nativeFee })
    });
    it("Should burn tokens correctly", async function () {
      const totalAmount = ethers.parseEther("100");
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        totalAmount
      );
      await mproTokenLight
        .connect(deployer)
        .burn(totalAmount);
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
      const sendParams = createSendParams(remoteChainId, deployer.address, totalAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, totalAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
    const sendParams = createSendParams(remoteChainId, deployer.address, totalAmount);

    let [nativeFee] = await mproToken.quoteSend(sendParams, false)

    await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })

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
    const sendParams = createSendParams(remoteChainId, deployer.address, totalAmount);

    let [nativeFee] = await mproToken.quoteSend(sendParams, false)

    await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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

    // it("Should revert when amount to send is 0", async function () {
    //   let sendAmount = ethers.parseEther("0");
    //   const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

    //   let [nativeFee] = await mproToken.quoteSend(sendParams, false)

    //   await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })

    //   await expect(
    //     mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
    //   ).to.be.revertedWith("OFTCore: amount too small");
    // });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);
        await mproToken.quoteSend(sendParams, false)
        expect.fail("estimating sendFee successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(`value out-of-bounds (argument="amountLD", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.1.0)`)
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await expect(
        mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      const sendParams2 = createSendParams(remoteChainId, deployer.address, sendAmount2);

      let [nativeFee2] = await mproToken.quoteSend(sendParams, false)

      await expect(
        mproToken.connect(owner).send(sendParams2, [nativeFee, zero] as any, owner.address, { value: nativeFee2 })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");


      try {
        const sendParams = createSendParams(remoteChainId, "0x123", sendAmount);

        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        expect.fail("send successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal('invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.1.0)')
      }
    });


    it("Should revert when chainId is invalid", async function () {
      try {
        let sendAmount = ethers.parseEther("100");
        const sendParams = createSendParams(4, deployer.address, sendAmount);

        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
        expect.fail("send successful - should not be");
      } catch (error: any) {

        expect(error.message).to.equal(`VM Exception while processing transaction: reverted with custom error 'NoPeer(4)'`);
      }
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, tokensMinted);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(owner).transfer(addr3.address, sendAmount);
      await mproToken.connect(deployer).transfer(addr3.address, sendAmount);
      expect(await mproToken.balanceOf(addr3.address)).to.equal(tokensMinted);
      await mproToken.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, tokensMinted);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(owner).transfer(addr3.address, sendAmount);
      await mproToken.connect(deployer).transfer(addr3.address, sendAmount);
      expect(await mproToken.balanceOf(addr3.address)).to.equal(tokensMinted);
      await mproToken.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
      expect(await mproToken.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );

      let sendAmount2 = tokensMinted;
      const sendParams2 = createSendParams(localChainId, deployer.address, sendAmount2);

      let [nativeFee2] = await mproTokenLight.quoteSend(sendParams2, false)
      await mproTokenLight.connect(deployer).send(sendParams2, [nativeFee2, zero] as any, deployer.address, { value: nativeFee2 })
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Token -> Light2", function () {
    it("Should properly send some tokens", async function () {
      let sendAmount = ethers.parseEther("10");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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

    it("Should not revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        expect.fail("estimating sendFee successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(`value out-of-bounds (argument="amountLD", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.1.0)`)
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await expect(
        mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      expect(await mproToken.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      const sendParams2 = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee2] = await mproToken.quoteSend(sendParams2, false)

      await expect(
        mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee2 })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");


      try {
        const sendParams = createSendParams(remoteChainId2, "0x123", sendAmount);
        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
        expect.fail("send successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal('invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.1.0)')
      }
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      try {
        const sendParams = createSendParams(4, deployer.address, sendAmount);
        await mproToken.quoteSend(sendParams, false)
      } catch (error: any) {
        expect(error.message).to.equal(`VM Exception while processing transaction: reverted with custom error 'NoPeer(4)'`);
      }
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, tokensMinted);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(owner).transfer(addr3.address, sendAmount);
      await mproToken.connect(deployer).transfer(addr3.address, sendAmount);
      expect(await mproToken.balanceOf(addr3.address)).to.equal(tokensMinted);
      await mproToken.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, tokensMinted);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(owner).transfer(addr3.address, sendAmount);
      await mproToken.connect(deployer).transfer(addr3.address, sendAmount);
      expect(await mproToken.balanceOf(addr3.address)).to.equal(tokensMinted);
      await mproToken.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
      expect(await mproToken.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );

      let sendAmount2 = tokensMinted;
      const sendParams2 = createSendParams(localChainId, deployer.address, sendAmount2);

      let [nativeFee2] = await mproTokenLight2.quoteSend(sendParams2, false)
      await mproTokenLight2.connect(deployer).send(sendParams2, [nativeFee, zero] as any, deployer.address, { value: nativeFee2 })
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Light2 -> Light", function () {
    beforeEach(async function () {
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      let totalAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId2, deployer.address, totalAmount);

      let [nativeFee2] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(owner).send(sendParams, [nativeFee2, zero] as any, owner.address, { value: nativeFee2 })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)
      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)
      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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

    it("Should not revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      await mproTokenLight2.quoteSend(sendParams, false)
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        expect.fail("estimating sendFee successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(`value out-of-bounds (argument="amountLD", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.1.0)`)
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await expect(
        mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      const sendParams2 = createSendParams(remoteChainId, deployer.address, sendAmount2);

      let [nativeFee2] = await mproTokenLight2.quoteSend(sendParams2, false)

      await expect(
        mproTokenLight2.connect(owner).send(sendParams, [nativeFee2, zero] as any, owner.address, { value: nativeFee2 })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");

      try {
        const sendParams = createSendParams(remoteChainId, "0x123", sendAmount);

        let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)
        await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
        expect.fail("send successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal('invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.1.0)')
      }
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      try {
        const sendParams = createSendParams(4, deployer.address, sendAmount);
        await mproTokenLight2.quoteSend(sendParams, false)
      } catch (error: any) {
        expect(error.message).to.equal(`VM Exception while processing transaction: reverted with custom error 'NoPeer(4)'`);
      }
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      const sendParams = createSendParams(remoteChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams2 = createSendParams(remoteChainId2, deployer.address, tokensDeployer);

      let [nativeFee2] = await mproToken.quoteSend(sendParams2, false)
      await mproToken.connect(addr3).send(sendParams2, [nativeFee2, zero] as any, addr3.address, { value: nativeFee2 })
      await mproTokenLight2
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId, deployer.address, tokensMinted);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight2.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, tokensDeployer);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
      await mproTokenLight2
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      const sendParams2 = createSendParams(remoteChainId, deployer.address, tokensMinted);

      let [nativeFee2] = await mproTokenLight2.quoteSend(sendParams2, false)

      await mproTokenLight2.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight2.connect(addr3).send(sendParams2, [nativeFee2, zero] as any, addr3.address, { value: nativeFee2 })
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(0);
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );

      let sendAmount2 = tokensMinted;
      const sendParams3 = createSendParams(remoteChainId2, deployer.address, sendAmount2);

      let [nativeFee3] = await mproTokenLight.quoteSend(sendParams3, false)
      await mproTokenLight.connect(deployer).send(sendParams3, [nativeFee3, zero] as any, deployer.address, { value: nativeFee3 })
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Light2 -> Token", function () {
    beforeEach(async function () {
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      let totalAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId2, deployer.address, totalAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)
      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)
      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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

    it("Should not revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        expect.fail("estimating sendFee successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(`value out-of-bounds (argument="amountLD", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.1.0)`)
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await expect(
        mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      expect(await mproTokenLight2.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      const sendParams2 = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee2] = await mproTokenLight2.quoteSend(sendParams2, false)

      await expect(
        mproTokenLight2.connect(owner).send(sendParams, [nativeFee2, zero] as any, owner.address, { value: nativeFee2 })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");


      try {
        const sendParams = createSendParams(localChainId, "0x123", sendAmount);
        let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)
        await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
        expect.fail("send successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(
          'invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.1.0)'
        );
      }
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");

      try {
        const sendParams = createSendParams(4, deployer.address, sendAmount);
        await mproTokenLight2.quoteSend(sendParams, false)
      } catch (error: any) {
        expect(error.message).to.equal(`VM Exception while processing transaction: reverted with custom error 'NoPeer(4)'`);

      }


    });

    it("Should not revert when source address is different than connect address", async function () {
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, deployer.address, { value: nativeFee })
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams2 = createSendParams(remoteChainId2, deployer.address, tokensDeployer);

      let [nativeFee2] = await mproToken.quoteSend(sendParams2, false)
      await mproToken.connect(addr3).send(sendParams2, [nativeFee2, zero] as any, addr3.address, { value: nativeFee2 })
      await mproTokenLight2
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(localChainId, deployer.address, tokensMinted);

      let [nativeFee] = await mproTokenLight2.quoteSend(sendParams, false)

      await mproTokenLight2.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight2.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, tokensDeployer);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
      await mproTokenLight2
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      const sendParams2 = createSendParams(localChainId, deployer.address, tokensMinted);

      let [nativeFee2] = await mproTokenLight2.quoteSend(sendParams2, false)

      await mproTokenLight2.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight2.connect(addr3).send(sendParams2, [nativeFee2, zero] as any, addr3.address, { value: nativeFee2 })
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
      expect(await mproTokenLight2.balanceOf(addr3.address)).to.equal(0);
      let sendAmount2 = tokensMinted;
      const sendParams3 = createSendParams(remoteChainId2, deployer.address, sendAmount2);

      let [nativeFee3] = await mproToken.quoteSend(sendParams3, false)
      await mproToken.connect(deployer).send(sendParams3, [nativeFee3, zero] as any, deployer.address, { value: nativeFee3 })
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });

  describe("sendFrom() function, Bridge: Light -> Token", function () {
    beforeEach(async function () {
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      let totalAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId, deployer.address, totalAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)
      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)
      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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

    it("Should not revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

        await mproToken.quoteSend(sendParams, false)
        expect.fail("estimating sendFee successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(
          `value out-of-bounds (argument="amountLD", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.1.0)`
        );
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)

      await expect(
        mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      const sendParams2 = createSendParams(localChainId, deployer.address, sendAmount2);

      let [nativeFee2] = await mproTokenLight.quoteSend(sendParams2, false)

      await expect(
        mproTokenLight.connect(owner).send(sendParams2, [nativeFee2, zero] as any, owner.address, { value: nativeFee2 })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");


      try {
        const sendParams = createSendParams(localChainId, "0x123", sendAmount);

        let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)
        await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
        expect.fail("send successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(
          'invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.1.0)'
        );
      }
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      try {
        const sendParams = createSendParams(4, deployer.address, sendAmount);

        await mproTokenLight.quoteSend(sendParams, false)
        expect.fail("estimating sendFee successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(`VM Exception while processing transaction: reverted with custom error 'NoPeer(4)'`);
      }
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      const sendParams = createSendParams(localChainId, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, tokensDeployer);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
      await mproTokenLight
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      const sendParams2 = createSendParams(localChainId, deployer.address, tokensMinted);

      let [nativeFee2] = await mproTokenLight.quoteSend(sendParams2, false)

      await mproTokenLight.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight.connect(addr3).send(sendParams2, [nativeFee2, zero] as any, addr3.address, { value: nativeFee2 })
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
      const sendParams3 = createSendParams(remoteChainId, deployer.address, tokensDeployer);

      let [nativeFee3] = await mproToken.quoteSend(sendParams3, false)
      await mproToken.connect(addr3).send(sendParams3, [nativeFee3, zero] as any, addr3.address, { value: nativeFee3 })
      await mproTokenLight
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(localChainId, deployer.address, tokensMinted);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight.connect(addr3).send(sendParams, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
      expect(await mproToken.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(0);
      let sendAmount2 = tokensMinted;
      const sendParams2 = createSendParams(remoteChainId, deployer.address, sendAmount2);

      let [nativeFee2] = await mproToken.quoteSend(sendParams2, false)
      await mproToken.connect(deployer).send(sendParams2, [nativeFee2, zero] as any, deployer.address, { value: nativeFee2 })
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });
  // npx hardhat test test/MPROLight.ts --grep "LOL"
  describe("sendFrom() function, Bridge: Light -> Light2", function () {
    beforeEach(async function () {
      await masterDistributor.connect(lister).whitelist(deployer.address, true);
      let totalAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId, deployer.address, totalAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)
      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)
      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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

    it("Should not revert when amount to send is 0", async function () {
      let sendAmount = ethers.parseEther("0");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
    });

    it("Should revert when amount to send is negative", async function () {
      let sendAmount = ethers.parseEther("-1");

      try {
        const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        expect.fail("estimating sendFee successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(
          `value out-of-bounds (argument="amountLD", value=-1000000000000000000, code=INVALID_ARGUMENT, version=6.1.0)`
        );
      }
    });

    it("Should revert when sending more tokens than owner has", async function () {
      let sendAmount = ethers.parseEther("101");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await expect(
        mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should revert when trying to send tokens after sending all available tokens", async function () {
      let sendAmount = ethers.parseEther("100");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproToken.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
      expect(await mproTokenLight.balanceOf(owner.address)).to.equal(
        ethers.parseEther("0")
      );

      let sendAmount2 = ethers.parseEther("1");
      const sendParams2 = createSendParams(remoteChainId2, deployer.address, sendAmount2);

      let [nativeFee2] = await mproToken.quoteSend(sendParams2, false)

      await expect(
        mproTokenLight.connect(owner).send(sendParams2, [nativeFee2, zero] as any, owner.address, { value: nativeFee2 })
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("Should throw error when destination address is invalid", async function () {
      let sendAmount = ethers.parseEther("100");

      try {
        const sendParams = createSendParams(remoteChainId2, "0x123", sendAmount);
        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
        expect.fail("send successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal('invalid BytesLike value (argument="value", value="0x123", code=INVALID_ARGUMENT, version=6.1.0)')
      }
    });

    it("Should revert when chainId is invalid", async function () {
      let sendAmount = ethers.parseEther("100");
      try {
        const sendParams = createSendParams(4, deployer.address, sendAmount);

        let [nativeFee] = await mproToken.quoteSend(sendParams, false)
        await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
        expect.fail("send successful - should not be");
      } catch (error: any) {
        expect(error.message).to.equal(`VM Exception while processing transaction: reverted with custom error 'NoPeer(4)'`);
      }
    });

    it("Should properly send min number of tokens", async function () {
      let sendAmount = ethers.parseEther("0.000001");
      const sendParams = createSendParams(remoteChainId2, deployer.address, sendAmount);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams, false)

      await mproTokenLight.connect(owner).send(sendParams, [nativeFee, zero] as any, owner.address, { value: nativeFee })
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
      const paramsToSend = createSendParams(remoteChainId, deployer.address, tokensDeployer);

      let [nativeFee2] = await mproToken.quoteSend(paramsToSend, false)
      await mproToken.connect(addr3).send(paramsToSend, [nativeFee2, zero] as any, addr3.address, { value: nativeFee2 })
      await mproTokenLight
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      const sendParams2 = createSendParams(remoteChainId2, deployer.address, tokensMinted);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams2, false)

      await mproTokenLight.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight.connect(addr3).send(sendParams2, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
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
      const sendParams = createSendParams(remoteChainId, deployer.address, tokensDeployer);

      let [nativeFee4] = await mproToken.quoteSend(sendParams, false)
      await mproToken.connect(addr3).send(sendParams, [nativeFee4, zero] as any, addr3.address, { value: nativeFee4 })
      await mproTokenLight
        .connect(deployer)
        .transfer(addr3.address, tokensDeployer);

      const tokensMinted = ethers.parseEther("500000000");
      let sendAmount = ethers.parseEther("100");
      const sendParams2 = createSendParams(remoteChainId2, deployer.address, tokensMinted);

      let [nativeFee] = await mproTokenLight.quoteSend(sendParams2, false)

      await mproTokenLight.connect(owner).transfer(addr3.address, sendAmount);
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(
        tokensMinted
      );
      await mproTokenLight.connect(addr3).send(sendParams2, [nativeFee, zero] as any, addr3.address, { value: nativeFee })
      expect(await mproTokenLight2.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
      expect(await mproTokenLight.balanceOf(addr3.address)).to.equal(0);
      let sendAmount2 = tokensMinted;
      const sendParams3 = createSendParams(remoteChainId, deployer.address, sendAmount2);

      let [nativeFee3] = await mproTokenLight2.quoteSend(sendParams3, false)
      await mproTokenLight2.connect(deployer).send(sendParams3, [nativeFee3, zero] as any, deployer.address, { value: nativeFee3 })
      expect(await mproTokenLight.balanceOf(deployer.address)).to.equal(
        tokensMinted
      );
    });
  });
});
