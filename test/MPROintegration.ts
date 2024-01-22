import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { MPROMasterDistributor, MPROMasterDistributor__factory, MPRORoleManager, MPRORoleManager__factory, MPROToken, MPROToken__factory } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { mine } from '@nomicfoundation/hardhat-network-helpers'

// npx hardhat test test/MPROintegration.ts

describe('MPROintegration', () => {
    let tx;
    let mproToken: MPROToken;
    let mproTokenAddress: string;
    let mproRoleManager: MPRORoleManager
    let mproRoleManagerAddress: string;
    let mproMasterDistributor: MPROMasterDistributor;
    let mproMasterDistributorAddress: string;

    let owner: HardhatEthersSigner;
    let masterDistributor: HardhatEthersSigner;
    let vestingContract1: HardhatEthersSigner;
    let vestingContract2: HardhatEthersSigner;
    let otherAccounts: HardhatEthersSigner[];

    beforeEach(async () => {
        const [ownerAcc, master, vest1, vest2, ...otherAccts] = await ethers.getSigners();
        owner = ownerAcc;
        masterDistributor = master;
        vestingContract1 = vest1;
        vestingContract2 = vest2;
        otherAccounts = otherAccts;

        const MPROToken: MPROToken__factory = await ethers.getContractFactory('MPROToken');
        const MPRORoleManager: MPRORoleManager__factory = await ethers.getContractFactory('MPRORoleManager');
        const MPROMasterDistributor: MPROMasterDistributor__factory = await ethers.getContractFactory('MPROMasterDistributor');


        mproRoleManager = await MPRORoleManager.deploy(owner.address);
        mproRoleManagerAddress = await mproRoleManager.getAddress();

        mproMasterDistributor = await MPROMasterDistributor.deploy(owner.address, mproRoleManagerAddress);
        mproMasterDistributorAddress = await mproMasterDistributor.getAddress();

        const distributorRole = await mproRoleManager.DISTRIBUTOR_ROLE();
        const masterDistributorRole = await mproMasterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE();

        tx = await mproRoleManager.connect(owner).grantRole(
            distributorRole,
            mproMasterDistributorAddress
        )
        await tx.wait();

        tx = await mproMasterDistributor.connect(owner).grantRole(
            masterDistributorRole,
            masterDistributor.address
        )

        await tx.wait();

        mproToken = await MPROToken.deploy(
            'MPRO', 'MPRO', [vestingContract1.address, vestingContract2.address], [ethers.parseEther("1000"), ethers.parseEther("10000")], '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1', mproRoleManagerAddress, mproMasterDistributorAddress
        );

        // Check balances on vesting contracts
        expect(await mproToken.balanceOf(vestingContract1.address)).to.equal(ethers.parseEther("1000"));
        expect(await mproToken.balanceOf(vestingContract2.address)).to.equal(ethers.parseEther("10000"));

        mproTokenAddress = await mproToken.getAddress();

        tx = await mproMasterDistributor.connect(owner).setMPROToken(
            mproTokenAddress
        )

        await tx.wait();
    });

    describe('Deployment', () => {
        it('Should set the right mproToken name', async () => {
            expect(await mproToken.name()).to.equal('MPRO');
        })
        it('Should set the right mproToken symbol', async () => {
            expect(await mproToken.symbol()).to.equal('MPRO');
        })
        it('Should set the right mproToken decimals', async () => {
            expect(await mproToken.decimals()).to.equal(18);
        })
        it("Should set the right mproToken totalSupply", async () => {
            expect(await mproToken.totalSupply()).to.equal(ethers.parseEther("11000"));
        })
        it("Should have the right maxCap", async () => {
            expect(await mproToken._maxCap()).to.equal(ethers.parseEther("500000000"));
        })
    })
    describe('RoleManager', () => {
        it('Should have the right owner', async () => {
            expect(await mproRoleManager.isDistributor(mproMasterDistributorAddress)).to.true;
        })
        it('Should have the right DISTRIBUTOR_ROLE', async () => {
            expect(await mproRoleManager.DISTRIBUTOR_ROLE()).to.eq("0xfbd454f36a7e1a388bd6fc3ab10d434aa4578f811acbbcf33afb1c697486313c")
        })
    })
    describe('Distribute', () => {
        it('Should not enable mint before 30 days', async () => {
            await expect(mproMasterDistributor.connect(masterDistributor).distribute(owner.address, 100)).to.be.revertedWith('MPROMasterDistributor: Minting is not enabled yet');
        })
        it('Should enable mint by masterDistributor', async () => {
            await mine(60 * 60 * 24 * 30);
            await mproMasterDistributor.connect(masterDistributor).distribute(owner.address, ethers.parseEther("100"));
            // Check token balance
            expect(await mproToken.balanceOf(owner.address)).to.equal(ethers.parseEther("100"));
        })
        it('Should not enable mint by other accounts', async () => {
            await expect(mproMasterDistributor.connect(otherAccounts[0]).distribute(owner.address, ethers.parseEther("100"))).to.be.revertedWith(`AccessControl: account ${otherAccounts[0].address.toLowerCase()} is missing role 0xb19c0b5de53e6e8b2996523385ad2b2e358ef774bb7335734b02556c8b75f198`);
        })
    })
    describe('Distribute bulk', () => {
        it('Should not enable mint before 30 days', async () => {
            await expect(mproMasterDistributor.connect(masterDistributor).distributeBulk([owner.address], [ethers.parseEther("100")])).to.be.revertedWith('MPROMasterDistributor: Minting is not enabled yet');
        })
        it('Should enable mint by masterDistributor', async () => {
            // mine 14 days mine(blocknumber)
            await network.provider.send("evm_increaseTime", [(14 * 24 * 60 * 60) + 1]);
            await mproMasterDistributor.connect(masterDistributor).distributeBulk([owner.address], [ethers.parseEther("1")]);
            // Check token balance
            expect(await mproToken.balanceOf(owner.address)).to.equal(ethers.parseEther("1"));
        })
        it('Should not enable mint by other accounts', async () => {
            await expect(mproMasterDistributor.connect(otherAccounts[0]).distributeBulk([owner.address], [ethers.parseEther("100")])).to.be.revertedWith(`AccessControl: account ${otherAccounts[0].address.toLowerCase()} is missing role 0xb19c0b5de53e6e8b2996523385ad2b2e358ef774bb7335734b02556c8b75f198`);
        })
    })
});
