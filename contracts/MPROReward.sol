// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

interface Router {
    function WETH() external pure returns (address);
    function getAmountsOut(
        uint amountIn,
        address[] memory path
    ) external pure returns (uint[] memory amounts);
}

contract MPROReward is Ownable, AccessControl {
    bytes32 public constant MPRO_MASTER_DISTRIBUTOR_ROLE =
        keccak256("MPRO_MASTER_DISTRIBUTOR_ROLE");

    uint256 private oneUSDT = 1000000; // 1 USDT = 1000000 wei

    address public usdtAddress; // USDT address

    struct Reward {
        uint256 _rewardToClaim;
        uint256 _claimedReward;
        uint256 _lastRewardTimestamp;
    }

    struct Claim {
        address _claimer;
        uint256 _claimedReward;
        uint256 _claimTimestamp;
    }

    mapping(address => Reward) private walletRewards;

    mapping(address => Claim[]) private userClaimHistory;

    address public rewardTokenAddress;

    Router private router; // Router contract (Uniswap)

    ERC20 claimToken;

    event AddReward(
        address indexed claimer,
        uint256 rewardAmount,
        uint256 transactionCostManual,
        uint256 transactionCostAuto
    );

    constructor(
        address _rewardTokenAddress,
        address _usdtAddress,
        address _routerAddress,
        address _initialOwner
    ) {
        rewardTokenAddress = _rewardTokenAddress;
        usdtAddress = _usdtAddress;
        claimToken = ERC20(_rewardTokenAddress);
        router = Router(_routerAddress);
        _transferOwnership(_initialOwner);
    }

    function addReward(
        uint256 _rewardAmountInRewardToken,
        uint256 _addRewardTxCostInRewardToken,
        address _claimer
    ) public onlyRole(MPRO_MASTER_DISTRIBUTOR_ROLE) {
        uint256 gasBefore = gasleft();
        require(
            _rewardAmountInRewardToken > 0,
            "Reward amount must be greater than 0"
        );
        console.log(_rewardAmountInRewardToken, _addRewardTxCostInRewardToken);
        require(
            _rewardAmountInRewardToken > _addRewardTxCostInRewardToken,
            "Reward amount must be greater than transaction cost"
        );
        Reward memory reward = walletRewards[_claimer];
        require(
            reward._lastRewardTimestamp + 1 days < block.timestamp,
            "You can claim reward once a day"
        );

        uint256 rewardTokenBalance = claimToken.balanceOf(address(this));

        require(
            rewardTokenBalance >= _rewardAmountInRewardToken,
            "Not enough reward token balance"
        );

        uint256 currentRewardToClaim = reward._rewardToClaim;

        currentRewardToClaim +=
            _rewardAmountInRewardToken -
            _addRewardTxCostInRewardToken;

        walletRewards[msg.sender] = Reward({
            _rewardToClaim: currentRewardToClaim,
            _claimedReward: reward._claimedReward,
            _lastRewardTimestamp: reward._lastRewardTimestamp
        });

        uint256 gasUsed = gasBefore - gasleft();
        uint256 txCost = gasUsed * tx.gasprice;
        uint256 transactionCostInRewardToken = getNativeValueInMPRO(txCost);
        console.log(
            tx.gasprice,
            txCost,
            "txCosttxCosttxCosttxCosttxCosttxCosttxCost"
        );
        if (transactionCostInRewardToken >= _addRewardTxCostInRewardToken)
            revert("Transaction cost is not enough");
        emit AddReward(
            _claimer,
            _rewardAmountInRewardToken,
            _addRewardTxCostInRewardToken,
            transactionCostInRewardToken
        );
    }

    function claimReward(address _claimer) public {
        Reward storage reward = walletRewards[_claimer];
        require(reward._rewardToClaim > 0, "No reward to claim");
        uint256 rewardToClaim = reward._rewardToClaim;

        ERC20(rewardTokenAddress).transferFrom(
            address(this),
            _claimer,
            rewardToClaim
        );

        reward._claimedReward += rewardToClaim;
        reward._rewardToClaim = 0;
        reward._lastRewardTimestamp = block.timestamp;

        userClaimHistory[_claimer].push(
            Claim({
                _claimer: _claimer,
                _claimedReward: rewardToClaim,
                _claimTimestamp: block.timestamp
            })
        );
    }

    function getReward(address _claimer) public view returns (Reward memory) {
        return walletRewards[_claimer];
    }

    function getClaimHistory(
        address _claimer
    ) public view returns (Claim[] memory) {
        return userClaimHistory[_claimer];
    }

    function grantRole(
        bytes32 _role,
        address _account
    ) public virtual override onlyOwner {
        _grantRole(_role, _account);
    }

    function getNativeValueInMPRO(
        uint256 _amount
    ) public view returns (uint256) {
        address wethAddress = router.WETH(); // Get the WETH address
        address[] memory path = new address[](2);
        path[0] = rewardTokenAddress;
        path[1] = wethAddress; // USDT to WETH

        uint[] memory amounts = router.getAmountsOut(_amount, path);
        return amounts[path.length - 1];
    }
}
