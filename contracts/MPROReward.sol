// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MPROReward is Ownable, AccessControl {
    bytes32 public constant MPRO_MASTER_DISTRIBUTOR_ROLE =
        keccak256("MPRO_MASTER_DISTRIBUTOR_ROLE");

    struct Reward {
        address _rewardToken;
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

    constructor(address _initialOwner) {
        _transferOwnership(_initialOwner);
    }

    function addReward(
        address _rewardToken,
        uint256 _rewardAmount,
        address _claimer
    ) public onlyOwner {
        Reward memory reward = userRewards[_claimer];
        uint256 currentRewardToClaim = reward._rewardToClaim;
        currentRewardToClaim += _rewardAmount;
        userRewards[_rewardToken] = Reward({
            _rewardToken: _rewardToken,
            _rewardToClaim: currentRewardToClaim,
            _claimedReward: reward._claimedReward,
            _lastRewardTimestamp: reward._lastRewardTimestamp
        });
    }

    function claimReward(address _claimer) public {
        Reward memory reward = userRewards[_claimer];
        require(reward._rewardToClaim > 0, "No reward to claim");
        uint256 rewardToClaim = reward._rewardToClaim;

        userClaimHistory[_claimer].push(
            Claim({
                _claimer: _claimer,
                _claimedReward: rewardToClaim,
                _claimTimestamp: block.timestamp
            })
        );
    }
}
