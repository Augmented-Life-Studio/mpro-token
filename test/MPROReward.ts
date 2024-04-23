import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC20, LZMock__factory, MPRO, MPROMasterDistributor, MPROMasterDistributor__factory, MPROReward, MPROReward__factory, MPRO__factory, Router, Router__factory, WhoaToken__factory } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

const ONE_DAY = 24 * 60 * 60;

// npx hardhat test test/MPROReward.ts
describe('MPROReward', function () {
    let deployer: HardhatEthersSigner, owner: HardhatEthersSigner, distributor: HardhatEthersSigner, users: HardhatEthersSigner[]
    // All needed contract instances
    let erc20: ERC20;
    let mproToken: MPRO;
    let mproMasterDistributor: MPROMasterDistributor;
    let router: Router;
    let mproReward: MPROReward;
    let INITIAL_DAILY_DISTRIBUTION = ethers.parseUnits("250000");

    let masterDistributorDeploymentTimestamp: number;
    let initialDistributionStartTime: number;
    let DISTRIBUTION_START_DELAY = 0; // 14 days

    beforeEach(async () => {
        [deployer, owner, distributor, ...users] = await ethers.getSigners();
        const MasterDistributorFactory = await ethers.getContractFactory("contracts/MPROMasterDistributor.sol:MPROMasterDistributor") as MPROMasterDistributor__factory;
        mproMasterDistributor = await MasterDistributorFactory.deploy(owner.address);

        const LZMockFactory = await ethers.getContractFactory("contracts/mocks/LZEndpointMock.sol:LZMock") as LZMock__factory;
        const lzMock = await LZMockFactory.deploy(1);

        const MPRO: MPRO__factory = await ethers.getContractFactory('contracts/MPRO.sol:MPRO') as MPRO__factory;
        mproToken = await MPRO.deploy(
            'MPRO', 'MPRO', [owner], [ethers.parseUnits("100")], lzMock.target, mproMasterDistributor.target, owner.address
        );

        await mproMasterDistributor.connect(owner).setMPRO(mproToken.target);
        const masterDistributorRole = await mproMasterDistributor.MPRO_MASTER_DISTRIBUTOR_ROLE();
        await mproMasterDistributor.connect(owner).grantRole(masterDistributorRole, distributor.address);
        const startTimeStamp = ((await ethers.provider.getBlock('latest'))?.timestamp || 0) + 2;
        await mproMasterDistributor.connect(owner).setDistributionStartTime(startTimeStamp);

        const distributionStartTimestamp = await mproMasterDistributor.distributionStartTimestamp();
        const mproMasterDistributorDeploymentBlockNumber = mproMasterDistributor.deploymentTransaction()?.blockNumber as number;
        masterDistributorDeploymentTimestamp = (await ethers.provider.getBlock(mproMasterDistributorDeploymentBlockNumber))!.timestamp as number;
        initialDistributionStartTime = masterDistributorDeploymentTimestamp + DISTRIBUTION_START_DELAY;

        const RouterFactory = (await ethers.getContractFactory(
            'contracts/mocks/Router.sol:Router',
        )) as Router__factory
        router = await RouterFactory.connect(deployer).deploy();

        const MPRORewardFactory = await ethers.getContractFactory('contracts/MPROReward.sol:MPROReward') as MPROReward__factory;
        mproReward = await MPRORewardFactory.connect(deployer).deploy(
            mproToken.target,
            mproMasterDistributor.target,
            router.target,
            owner.address
        );

        const MPRO_MASTER_DISTRIBUTOR_ROLE = await mproReward.MPRO_MASTER_DISTRIBUTOR_ROLE();
        await mproReward.connect(owner).grantRole(MPRO_MASTER_DISTRIBUTOR_ROLE, distributor.address);

        const ERC20Factory: WhoaToken__factory = await ethers.getContractFactory(
            "WhoaToken"
        );
        erc20 = await ERC20Factory.deploy(
            "ERC20",
            "ERC20",
            ethers.parseUnits("100000"),
            owner.address
        );
    })

    describe("Deployment", function () {
        it("Should deploy the contract correctly", async function () {
            expect(await mproMasterDistributor.owner()).to.equal(owner.address);
        });
    })

    describe("addReward function", function () {
        it("Should add reward correctly", async function () {
            const rewardAmount = ethers.parseUnits("1000");
            console.log('====================================');
            console.log("rewardAmount", rewardAmount.toString());
            console.log('====================================');
            const txCostEstimate = ethers.parseUnits("20");
            console.log('====================================');
            console.log('txCostEstimate', txCostEstimate.toString(), rewardAmount.toString());
            console.log('====================================');
            const claimerAddress = users[0].address;
            await mproMasterDistributor.connect(distributor).distribute(mproReward.target, rewardAmount);
            const txFee = await (await mproReward.connect(distributor).addReward(rewardAmount, txCostEstimate, claimerAddress)).getTransaction();
            console.log(txFee, "txFee.toString()txFee.toString()txFee.toString()");

            // const txFeeInMPRO = await mproReward.getNativeValueInMPRO(txFee);
            // console.log(txFeeInMPRO.toString(), "txFee.toString()txFee.toString()txFee.toString()");

            // await mproReward.connect(distributor).addReward(rewardAmount, txFeeInMPRO, claimerAddress);
            // expect(await mproReward.getReward(claimerAddress)).to.equal(rewardAmount);
        });
    })


});