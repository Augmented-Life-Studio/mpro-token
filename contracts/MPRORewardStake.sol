// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract MPRORewardStake is Ownable {
    using SafeMath for uint256;

    uint256 private constant UNLOCK_PERCENT_DIVIDER = 10000;

    IERC20 public immutable mproToken;

    struct Staker {
        uint256 staked;
        uint256 lastUpdated;
        uint256 balanceToClaim;
        uint256 claimedBalance;
        uint256 reward;
    }

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
    // Quantity of reward token to be paid out
    uint256 public rewardTokenQuantity;
    // Total staked
    uint256 public totalStakedSupply;

    // Stakers
    mapping(address => Staker) public staker;
    // Stakers length
    uint256 public stakersLength;

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
        claimRewardStartTimestamp = _stakeEndTimestamp;
        _transferOwnership(_newOwner);
    }

    function updateStakers(
        address[] memory _stakers,
        uint256[] memory _amounts
    ) public onlyOwner {
        require(_stakers.length == _amounts.length, "Invalid input");
        // Counting amount to update including pending rewards
        uint256 stakedAmountToUpdate = 0;
        // Counting amount to transfer based on stakers amount
        uint256 totalAmountToUpdate = 0;
        // Total rewards to be paid out
        uint256 rewardedAmountToUpdate = 0;
        for (uint256 i = 0; i < _stakers.length; i++) {
            Staker storage _staker = staker[_stakers[i]];
            // Skip new stakers if declaration period is over
            if (
                _staker.staked == 0 &&
                block.timestamp < declarationEndTimestamp &&
                block.timestamp > declarationEndTimestamp
            ) {
                return;
            } else {
                // Increase stakers length if new staker
                if (_staker.staked == 0) {
                    stakersLength++;
                }
                // Get pending reward from staked amount
                uint256 rewardFromLastUpdateAt = compoundWalletReward(
                    _stakers[i]
                );
                // Update staked amount
                _staker.staked += _amounts[i];
                // Update total amount to transfer
                totalAmountToUpdate += _amounts[i];
                // Amount that will be available to claim including compounded rewards
                stakedAmountToUpdate += _amounts[i] + rewardFromLastUpdateAt;
                // Update balance to claim
                _staker.balanceToClaim += _amounts[i];
                // Update reward
                rewardedAmountToUpdate += rewardFromLastUpdateAt;
            }
        }
        // Send required tokens to the contract address
        mproToken.transferFrom(msg.sender, address(this), totalAmountToUpdate);
        // Update total staked supply increased by pending rewards
        rewardTokenQuantity -= rewardedAmountToUpdate;
        totalStakedSupply += stakedAmountToUpdate;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return _min(stakeEndTimestamp, block.timestamp);
    }

    function compoundWalletReward(address _account) private returns (uint256) {
        Staker storage _staker = staker[_account];
        uint256 rewardToUpdate = pendingReward(_account);
        _staker.balanceToClaim += rewardToUpdate;
        _staker.lastUpdated = _min(block.timestamp, stakeEndTimestamp);
        return rewardToUpdate;
    }

    function compoundReward() public {
        Staker storage _staker = staker[_msgSender()];
        require(_staker.staked > 0, "MPRORewardStake: No staked amount");
        uint256 rewardToUpdate = pendingReward(_msgSender());
        _staker.balanceToClaim += rewardToUpdate;
        _staker.lastUpdated = _min(block.timestamp, stakeEndTimestamp);
        rewardTokenQuantity -= rewardToUpdate;
        totalStakedSupply += rewardToUpdate;
    }

    function pendingReward(address _account) public view returns (uint256) {
        Staker memory _staker = staker[_account];
        if (_staker.lastUpdated == 0) {
            return 0;
        }
        uint256 currentBalance = _staker.balanceToClaim;
        uint256 pendingRewardPerToken = rewardPerTokenFromTimestamp(
            _staker.lastUpdated
        );
        return (currentBalance * (pendingRewardPerToken)) / 1e18;
    }

    function rewardPerTokenFromTimestamp(
        uint256 _updatedTimestamp
    ) public view returns (uint256) {
        if (totalStakedSupply == 0) {
            return rewardTokenQuantity;
        }
        uint256 stakingPeriod = lastTimeRewardApplicable() - _updatedTimestamp;
        return ((rewardRate * stakingPeriod) * 1e18) / totalStakedSupply;
    }

    function stakeDuration() public view returns (uint256) {
        return stakeEndTimestamp - stakeStartTimestamp;
    }

    function getStakedAmount(address _account) public view returns (uint256) {
        return staker[_account].staked;
    }

    function getEarnedAmount(address _account) public view returns (uint256) {
        return staker[_account].reward;
    }

    function updateReward(uint256 _amount) public onlyOwner {
        mproToken.transferFrom(msg.sender, address(this), _amount);
        rewardTokenQuantity += _amount;
        rewardRate = rewardTokenQuantity / stakeDuration();
    }

    function moveToStake(address _stakeAddress) public {
        require(
            block.timestamp >= claimRewardStartTimestamp,
            "MPRORewardStake: Not yet unlocked"
        );
        uint256 tokensEnableForRelease = enableForRelease();
        require(
            tokensEnableForRelease > 0,
            "MPRORewardStake: No tokens to release"
        );
        Staker storage _staker = staker[_msgSender()];
        _staker.claimedBalance += tokensEnableForRelease;
        NextStake(_stakeAddress).transferStake(tokensEnableForRelease);
    }

    function claim() external virtual {
        require(
            block.timestamp >= claimRewardStartTimestamp,
            "MPRORewardStake: Not yet unlocked"
        );
        Staker storage _staker = staker[_msgSender()];
        uint256 tokensEnableForRelease = enableForRelease();
        require(
            tokensEnableForRelease > 0,
            "MPRORewardStake: No tokens to claim"
        );
        require(
            _staker.balanceToClaim - _staker.claimedBalance >=
                tokensEnableForRelease,
            "MPRORewardStake: Not enough tokens to claim"
        );
        _staker.claimedBalance += tokensEnableForRelease;
        console.log(
            tokensEnableForRelease,
            "tokensEnableForReleasetokensEnableForRelease"
        );
        mproToken.transfer(_msgSender(), tokensEnableForRelease);
    }

    function enableForRelease() public view returns (uint256) {
        Staker memory _staker = staker[_msgSender()];
        if (block.timestamp >= claimRewardStartTimestamp) {
            if (
                claimPeriodDuration > 0 && rewardUnlockPercentPerPeriod < 10000
            ) {
                uint256 currentCycle = block
                    .timestamp
                    .sub(claimRewardStartTimestamp)
                    .div(claimPeriodDuration);

                // Calculate percent to claim
                uint256 percentToClaim = rewardUnlockPercentPerPeriod.mul(
                    currentCycle
                );

                // For instance balance to claim = 100, percent per period = 50, claimed balance = 0
                uint256 claimableTokens = _staker
                    .balanceToClaim
                    .mul(percentToClaim)
                    .div(UNLOCK_PERCENT_DIVIDER);

                if (
                    claimableTokens >
                    _staker.balanceToClaim - _staker.claimedBalance
                ) {
                    return _staker.balanceToClaim - _staker.claimedBalance;
                } else {
                    return claimableTokens.sub(_staker.claimedBalance);
                }
            } else {
                return
                    _staker
                        .balanceToClaim
                        .mul(rewardUnlockPercentPerPeriod)
                        .div(UNLOCK_PERCENT_DIVIDER);
            }
        } else {
            return 0;
        }
    }

    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x <= y ? x : y;
    }

    function setClaimRewardConfig(
        uint256 _claimRewardStartTimestamp,
        uint256 _claimPeriodDuration,
        uint256 _rewardUnlockPercentPerPeriod
    ) public onlyOwner {
        claimRewardStartTimestamp = _claimRewardStartTimestamp;
        claimPeriodDuration = _claimPeriodDuration;
        rewardUnlockPercentPerPeriod = _rewardUnlockPercentPerPeriod;
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
