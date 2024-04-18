// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MPROReward is Ownable, AccessControl {
    bytes32 public constant MPRO_MASTER_DISTRIBUTOR_ROLE =
        keccak256("MPRO_MASTER_DISTRIBUTOR_ROLE");

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

    mapping(address => Reward) private userRewards;

    mapping(address => Claim[]) private userClaimHistory;

    uint256 private tokenBalanceForReward;

    address claimTokenAddress;

    ERC20 claimToken;

    constructor(address _initialOwner, address _claimTokenAddress) {
        claimTokenAddress = _claimTokenAddress;
        _transferOwnership(_initialOwner);
    }

    function addReward(
        uint256 _rewardAmountInRewardToken,
        uint256 _addRewardTxCostInRewardToken,
        address _claimer
    ) public onlyOwner {
        Reward memory reward = userRewards[_claimer];
        require(
            reward._lastRewardTimestamp + 1 days < block.timestamp,
            "You can claim reward once a day"
        );

        uint256 rewardTokenBalance = ERC20(claimTokenAddress).balanceOf(
            address(this)
        );

        require(
            rewardTokenBalance >=
                _rewardAmountInRewardToken + _rewardAmountInRewardToken,
            "Not enough reward token balance"
        );

        uint256 currentRewardToClaim = reward._rewardToClaim;

        currentRewardToClaim +=
            _rewardAmountInRewardToken -
            _addRewardTxCostInRewardToken;
        userRewards[msg.sender] = Reward({
            _rewardToClaim: currentRewardToClaim,
            _claimedReward: reward._claimedReward,
            _lastRewardTimestamp: reward._lastRewardTimestamp
        });

        tokenBalanceForReward += _rewardAmountInRewardToken;
    }

    function claimReward(address _claimer) public {
        Reward storage reward = userRewards[_claimer];
        require(reward._rewardToClaim > 0, "No reward to claim");
        uint256 rewardToClaim = reward._rewardToClaim;

        ERC20(claimTokenAddress).transferFrom(
            _claimer,
            address(this),
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

        tokenBalanceForReward -= rewardToClaim;
    }

    function getClaimHistory(
        address _claimer
    ) public view returns (Claim[] memory) {
        return userClaimHistory[_claimer];
    }
}
