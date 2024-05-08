// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract MPRORewardStake is Ownable {
    using SafeMath for uint256;

    uint256 private constant UNLOCK_PERCENT_DIVIDER = 10000;

    IERC20 public immutable mproToken;

    // Start of staking period
    uint256 public stakeStartTimestamp;
    // End of staking period
    uint256 public stakeEndTimestamp;
    // Reward to be paid out per second
    uint256 public rewardRate;

    // Start timestamp of the declaration period (enable to add new wallets to the staking pool)
    uint256 public declarationStartTimestamp;
    // End timestamp of the declaration period (disable to add new wallets to the staking pool)
    uint256 public declarationEndTimestamp;

    // Sum of (reward rate * dt * 1e18 / total staked supply)
    uint256 public rewardPerTokenStored;
    // Quantity of reward token to be paid out
    uint256 public rewardTokenQuantity;

    // Total staked
    uint256 public totalStakedSupply;
    // User address => staked amount
    mapping(address => uint256) public staked;
    // User address => staked amount
    mapping(address => uint256) public walletLastUpdated;
    // User address => claimable amount
    mapping(address => uint256) public balanceToClaim;
    // User address => claimable amount
    mapping(address => uint256) public claimedBalance;
    // User address => rewards to be claimed
    mapping(address => uint256) public rewards;
    // Stakers length
    uint256 public stakersLength;

    address public nextStakeAddress;

    NextStake public nextStake;

    // Claim reward config
    uint256 public claimRewardStartTimestamp;

    uint256 public rewardUnlockPercentPerPeriod = 10000;

    uint256 public claimPeriodDuration;

    constructor(
        address _mproTokenAddress,
        uint256 _stakeStartTimestamp,
        uint256 _stakeEndTimestamp,
        uint256 _declarationEndTimestamp,
        address _newOwner
    ) {
        mproToken = IERC20(_mproTokenAddress);
        stakeStartTimestamp = _stakeStartTimestamp;
        stakeEndTimestamp = _stakeEndTimestamp;
        declarationEndTimestamp = _declarationEndTimestamp;
        _transferOwnership(_newOwner);
    }

    function getMultiplierForTimestamp(
        uint256 _from,
        uint256 _to
    ) public view returns (uint256) {
        if (_to <= stakeEndTimestamp) {
            return _to.sub(_from);
        } else if (_from >= stakeEndTimestamp) {
            return 0;
        } else {
            return stakeEndTimestamp.sub(_from);
        }
    }

    function updateStakers(
        address[] memory _stakers,
        uint256[] memory _amounts
    ) public onlyOwner {
        require(_stakers.length == _amounts.length, "Invalid input");
        uint256 updateAmount = 0;
        for (uint256 i = 0; i < _stakers.length; i++) {
            if (
                staked[_stakers[i]] == 0 &&
                block.timestamp < declarationEndTimestamp &&
                block.timestamp > declarationEndTimestamp
            ) {
                return;
            } else {
                if (staked[_stakers[i]] == 0) {
                    stakersLength++;
                }
                uint256 pending = updateWalletReward(_stakers[i]);
                staked[_stakers[i]] += _amounts[i];
                balanceToClaim[_stakers[i]] += _amounts[i];
                updateAmount += _amounts[i] + pending;
            }
        }
        totalStakedSupply += updateAmount;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return _min(stakeEndTimestamp, block.timestamp);
    }

    function updateWalletReward(address _account) public returns (uint256) {
        rewards[_account] += pendingReward(_account);
        uint256 pending = rewards[_account];
        rewardTokenQuantity -= rewards[_account];
        balanceToClaim[_account] += rewards[_account];
        walletLastUpdated[_account] = _min(block.timestamp, stakeEndTimestamp);
        rewards[_account] = 0;
        return pending;
    }

    function pendingReward(address _account) public view returns (uint256) {
        if (walletLastUpdated[_account] == 0) {
            return 0;
        }
        uint256 currentBalance = balanceToClaim[_account];
        uint256 pendingRewardPerToken = rewardPerTokenFromTimestamp(
            walletLastUpdated[_account]
        );
        return (currentBalance * (pendingRewardPerToken)) / 1e18;
    }

    function rewardPerTokenFromTimestamp(
        uint256 _updatedTimestamp
    ) public view returns (uint256) {
        if (totalStakedSupply == 0) {
            return rewardTokenQuantity;
        }

        uint256 stakingPeriod = _min(block.timestamp, stakeEndTimestamp) -
            _updatedTimestamp;
        return ((rewardRate * stakingPeriod) * 1e18) / totalStakedSupply;
    }

    function stakeDuration() public view returns (uint256) {
        return stakeEndTimestamp - stakeStartTimestamp;
    }

    function getStakedAmount(address _account) public view returns (uint256) {
        return staked[_account];
    }

    function updateReward(uint256 _amount) public onlyOwner {
        mproToken.transferFrom(msg.sender, address(this), _amount);
        rewardTokenQuantity += _amount;
        rewardRate = rewardTokenQuantity / stakeDuration();
    }

    function earned(address _account) public view returns (uint256) {
        return rewards[_account];
    }

    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x <= y ? x : y;
    }

    function moveToStake() public {
        require(
            block.timestamp >= claimRewardStartTimestamp,
            "MPRORewardStake: Not yet unlocked"
        );
        uint256 tokensEnableForRelease = enableForRelease();
        require(
            tokensEnableForRelease > 0,
            "MPRORewardStake: No tokens to release"
        );

        claimedBalance[_msgSender()] += tokensEnableForRelease;
        mproToken.transfer(_msgSender(), tokensEnableForRelease);
    }

    function claim() external virtual {
        require(
            block.timestamp >= claimRewardStartTimestamp,
            "MPRORewardStake: Not yet unlocked"
        );
        uint256 tokensEnableForRelease = enableForRelease();
        require(
            tokensEnableForRelease > 0,
            "MPRORewardStake: No tokens to release"
        );

        claimedBalance[_msgSender()] += tokensEnableForRelease;
        nextStake.transferStake(tokensEnableForRelease);
    }

    function enableForRelease() public view returns (uint256) {
        uint256 totalTokens = balanceToClaim[_msgSender()];
        if (block.timestamp >= claimRewardStartTimestamp) {
            if (
                claimPeriodDuration > 0 && rewardUnlockPercentPerPeriod < 10000
            ) {
                uint256 claimingCicles = block
                    .timestamp
                    .sub(claimRewardStartTimestamp)
                    .div(claimPeriodDuration);
                uint256 percentToClaim = rewardUnlockPercentPerPeriod.mul(
                    claimingCicles
                );
                uint256 claimableTokens = totalTokens.mul(percentToClaim).div(
                    UNLOCK_PERCENT_DIVIDER
                );
                if (claimableTokens > balanceToClaim[_msgSender()]) {
                    return balanceToClaim[_msgSender()];
                } else {
                    return claimableTokens;
                }
            } else {
                return
                    totalTokens.mul(rewardUnlockPercentPerPeriod).div(
                        UNLOCK_PERCENT_DIVIDER
                    );
            }
        } else {
            return 0;
        }
    }
}

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}

interface NextStake {
    function transferStake(uint256 _amount) external;
}
