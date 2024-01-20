import { ethers } from 'hardhat';
import { expect } from 'chai';
import { MPROMasterDistributor, MPROMasterDistributor__factory, MPRORoleManager, MPRORoleManager__factory, MPROToken, MPROToken__factory } from '../typechain-types';

// npx hardhat test test/MPROToken.ts

describe('MPROToken', () => {
  let mproToken: MPROToken;
  let mproRoleManager: MPRORoleManager
    let mproMasterDistributor: MPROMasterDistributor;

  beforeEach(async () => {
    const [owner, otherAccount] = await ethers.getSigners();

    const MPROToken: MPROToken__factory = await ethers.getContractFactory('MPROToken');
    const MPRORoleManager: MPRORoleManager__factory = await ethers.getContractFactory('MPRORoleManager');
    const MPROMasterDistributor: MPROMasterDistributor__factory = await ethers.getContractFactory('MPROMasterDistributor');
    mproToken = await MPROToken.deploy(
      'MPRO', 'MPRO', [], [], '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1', '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1', '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1'
    );
    mproRoleManager = await MPRORoleManager.deploy(owner.address);
    mproMasterDistributor = await MPROMasterDistributor.deploy(owner.address);
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
      expect(await mproToken.totalSupply()).to.equal(0);
    })
    it("Should have the right maxCap", async () => { 
      expect(await mproToken._maxCap()).to.equal("500000000000000000000000000");
    })
  })
});
