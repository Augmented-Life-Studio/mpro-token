// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MPRORewardStake is Ownable, Pausable {
    using SafeMath for uint256;

    uint256 private constant UNLOCK_PERCENT_DIVIDER = 10000;

    IERC20 public immutable mproToken;

    // Start of staking period
    uint256 public stakeStartTimestamp;
    // End of staking period
    uint256 public stakeEndTimestamp;
    // Reward to be paid out per second
    uint256 public rewardRate;
    // Quantity of reward token to be paid out
    uint256 public rewardTokenQuantity;
    // Total staked
    uint256 public totalStakedSupply;

    // DECLARATION CONFIG
    // Start timestamp of the declaration period (enable to add new wallets to the staking pool)
    uint256 public declarationStartTimestamp;
    // End timestamp of the declaration period (disable to add new wallets to the staking pool)
    uint256 public declarationEndTimestamp;

    struct Staker {
        uint256 staked;
        uint256 lastUpdatedAt;
        uint256 balanceToClaim;
        uint256 claimedBalance;
        uint256 reward;
    }
    // Stakers
    mapping(address => Staker) public staker;

    // CLAIM REWARD CONFIG
    // Start timestamp for claiming rewards
    uint256 public claimRewardStartTimestamp;
    // Reward unlock percent per period (10000 = 100%, 9000 = 90%, etc.)
    uint256 public rewardUnlockPercentPerPeriod = 10000;
    // Duration of each claim period in seconds
    uint256 public claimPeriodDuration;

    constructor(address _mproTokenAddress, address _newOwner) {
        mproToken = IERC20(_mproTokenAddress);
        _transferOwnership(_newOwner);
    }

    /**
     * @dev Updates stakers' information and rewards within the contract.
     *
     * This function is used by the contract owner to update stakers' information and distribute rewards accordingly. It verifies the validity of inputs, ensures that the stake period is valid, and calculates the amount to update including pending rewards. It iterates through the provided stakers and their corresponding amounts, updating their staked amounts, total amounts to transfer, rewards to be paid out, and balances to claim. If a new staker is encountered within the declaration period, their length is increased. Rewards are compounded based on the time since the last update. After updating the stakers' information, the required tokens are transferred to the contract address, and the total staked supply and rewards are adjusted accordingly.
     *
     * @param _stakers An array of stakers' addresses.
     * @param _amounts An array of corresponding staked amounts for each staker.
     */
    function updateStakers(
        address[] memory _stakers,
        uint256[] memory _amounts
    ) public onlyOwner {
        // Check if input is valid
        require(
            _stakers.length == _amounts.length,
            "Invalid input - length mismatch"
        );
        // Check if stake config is set
        require(
            stakeStartTimestamp > 0 && stakeEndTimestamp > 0,
            "Require to set stake config"
        );
        // Check is the staking period is valid
        require(
            block.timestamp >= stakeStartTimestamp,
            "Can not update out of the staking period"
        );
        // Counting amount to update including pending rewards
        uint256 stakedAmountToUpdate = 0;
        // Counting amount to transfer based on stakers amount
        uint256 totalAmountToUpdate = 0;
        // Total rewards to be paid out
        uint256 rewardedAmountToUpdate = 0;
        for (uint256 i = 0; i < _stakers.length; i++) {
            Staker storage _staker = staker[_stakers[i]];
            // Skip new stakers if declaration period is over or not started
            if (
                _staker.staked == 0 &&
                (block.timestamp > declarationEndTimestamp ||
                    block.timestamp < declarationStartTimestamp)
            ) {
                continue;
            } else {
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
    /**
     * @dev Returns the last applicable time for rewards calculation.
     *
     * This function computes the last applicable time for rewards calculation, which is the minimum value between the end of the stake period and the current block timestamp. It ensures that rewards are calculated only up to the end of the stake period or the current block timestamp, whichever comes first.
     *
     * @return uint256 The last applicable time for rewards calculation.
     */
    function lastTimeRewardApplicable() public view returns (uint256) {
        return _min(stakeEndTimestamp, block.timestamp);
    }

    /**
     * @dev Compounds wallet rewards for a specific staker.
     *
     * This function calculates and updates the wallet rewards for a specific staker. It retrieves the staker's information from storage, computes the pending reward using the `pendingReward` function, adds it to the staker's reward and balance to claim, and updates the last updated timestamp to the minimum value between the current block timestamp and the stake end timestamp. The calculated reward amount is returned.
     *
     * @param _account The address of the staker.
     * @return uint256 The calculated reward amount.
     */
    function compoundWalletReward(address _account) private returns (uint256) {
        if (block.timestamp < stakeStartTimestamp) {
            return 0;
        }
        Staker storage _staker = staker[_account];
        uint256 rewardToUpdate = pendingReward(_account);
        _staker.reward += rewardToUpdate;
        _staker.balanceToClaim += rewardToUpdate;
        _staker.lastUpdatedAt = _min(block.timestamp, stakeEndTimestamp);
        return rewardToUpdate;
    }

    /**
     * @dev Retrieves the pending reward for a specific staker.
     *
     * This function calculates and returns the pending reward for a specific staker based on their balance to claim, the reward per token from the last updated timestamp, and the current balance. If the staker's last updated timestamp is zero, indicating no previous updates, the function returns zero. Otherwise, it computes the pending reward per token and returns the result.
     *
     * @param _account The address of the staker.
     * @return uint256 The pending reward amount.
     */
    function pendingReward(address _account) public view returns (uint256) {
        Staker memory _staker = staker[_account];
        if (_staker.lastUpdatedAt == 0) {
            return 0;
        }
        uint256 currentBalance = _staker.balanceToClaim;
        uint256 pendingRewardPerToken = rewardPerTokenFromTimestamp(
            _staker.lastUpdatedAt
        );
        return (currentBalance * (pendingRewardPerToken)) / 1e18;
    }

    /**
     * @dev Computes the reward per token from a specific updated timestamp.
     *
     * This function calculates and returns the reward per token based on the provided updated timestamp. If the total staked supply is zero, indicating no stakers, it returns the entire reward token quantity. Otherwise, it computes the staking period as the difference between the last applicable time for rewards calculation and the provided updated timestamp. It then calculates and returns the reward per token using the reward rate, staking period, and total staked supply.
     *
     * @param _updatedTimestamp The timestamp when the staker's information was last updated.
     * @return uint256 The reward per token.
     */
    function rewardPerTokenFromTimestamp(
        uint256 _updatedTimestamp
    ) public view returns (uint256) {
        if (totalStakedSupply == 0) {
            return rewardTokenQuantity;
        }
        uint256 stakingPeriod = lastTimeRewardApplicable() - _updatedTimestamp;
        return ((rewardRate * stakingPeriod) * 1e18) / totalStakedSupply;
    }

    /**
     * @dev Returns the duration of the stake period.
     *
     * This function computes and returns the duration of the stake period by subtracting the start timestamp from the end timestamp.
     *
     * @return uint256 The duration of the stake period.
     */
    function stakeDuration() public view returns (uint256) {
        return stakeEndTimestamp - stakeStartTimestamp;
    }

    /**
     * @dev Retrieves the staked amount for a specific staker.
     *
     * This function returns the staked amount for a specific staker based on their account address.
     *
     * @param _account The address of the staker.
     * @return uint256 The staked amount.
     */
    function getStakedAmount(address _account) public view returns (uint256) {
        return staker[_account].staked;
    }

    /**
     * @dev Retrieves the earned reward amount for a specific staker.
     *
     * This function returns the earned reward amount for a specific staker based on their account address.
     *
     * @param _account The address of the staker.
     * @return uint256 The earned reward amount.
     */
    function getEarnedAmount(address _account) public view returns (uint256) {
        return staker[_account].reward;
    }

    /**
     * @dev Updates the reward tokens within the contract.
     *
     * This function is used by the contract owner to update the reward tokens within the contract. It verifies the validity of the stake period, transfers the specified amount of reward tokens to the contract address, increases the reward token quantity by the transferred amount, and updates the reward rate based on the new reward token quantity and stake duration.
     *
     * @param _amount The amount of reward tokens to be added.
     */
    function updateReward(uint256 _amount) public onlyOwner {
        require(
            stakeStartTimestamp > 0 && stakeEndTimestamp > 0,
            "Invalid stake period config"
        );
        mproToken.transferFrom(msg.sender, address(this), _amount);
        rewardTokenQuantity += _amount;
        rewardRate = rewardTokenQuantity / stakeDuration();
    }

    /**
     * @dev Moves tokens to another stake contract.
     *
     * This function allows the sender to move tokens to another stake contract. It verifies that the contract is not paused, and the claim reward period has started. It calculates the amount of tokens available for release using the `enableForRelease` function and ensures that it is greater than zero. The tokens available for release are then added to the staker's claimed balance, and the stake contract specified by `_stakeAddress` is called to transfer the tokens.
     *
     * @param _stakeAddress The address of the stake contract to which tokens will be moved.
     */
    function moveToStake(address _stakeAddress) external virtual whenNotPaused {
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
        NextStake(_stakeAddress).transferStake(
            tokensEnableForRelease,
            _msgSender()
        );
    }

    /**
     * @dev Claims tokens for the sender.
     *
     * This function allows the sender to claim tokens. It verifies that the contract is not paused and there are tokens available for claim. It updates the staker's balance to claim if there are pending rewards. It then ensures that the remaining balance to claim is sufficient for the tokens to be claimed. If the conditions are met, the tokens are transferred to the sender.
     */
    function claim() external virtual whenNotPaused {
        Staker storage _staker = staker[_msgSender()];
        // Update remaining balance to claim
        if (pendingReward(_msgSender()) > 0) {
            uint256 rewardFromLastUpdateAt = compoundWalletReward(_msgSender());
            rewardTokenQuantity -= rewardFromLastUpdateAt;
            totalStakedSupply += rewardFromLastUpdateAt;
        }
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
        mproToken.transfer(_msgSender(), tokensEnableForRelease);
    }

    /**
     * @dev Computes the amount of tokens available for release.
     *
     * This function calculates and returns the amount of tokens available for release for the sender. It checks if the current timestamp is greater than or equal to the claim reward start timestamp. If claim configuration is set to retrieve data about cycles, it calculates the current cycle, the percent to claim, and the claimable tokens based on the staker's balance to claim and claimed balance. If claim configuration is not set, it allows claiming all tokens. If the conditions are not met, it returns zero.
     *
     * @return uint256 The amount of tokens available for release.
     */
    function enableForRelease() public view returns (uint256) {
        if (block.timestamp >= claimRewardStartTimestamp) {
            Staker memory _staker = staker[_msgSender()];
            // Check if claim config is set to retrive data about cycles
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
                // When claim config is not set we allow to claim all tokens
            } else {
                return _staker.balanceToClaim;
            }
        } else {
            return 0;
        }
    }

    /**
     * @dev Removes dust tokens from the contract.
     *
     * This function allows the contract owner to transfer all remaining tokens (dust) from the contract to the owner's address.
     */
    function removeDust() public onlyOwner {
        mproToken.transfer(msg.sender, mproToken.balanceOf(address(this)));
    }

    /**
     * @dev Sets the stake configuration parameters.
     *
     * This function allows the contract owner to set the stake configuration parameters including the start and end timestamps for staking and declaration periods.
     *
     * @param _stakeStartTimestamp The start timestamp for the stake period.
     * @param _stakeEndTimestamp The end timestamp for the stake period.
     * @param _declarationStartTimestamp The start timestamp for the declaration period.
     * @param _declarationEndTimestamp The end timestamp for the declaration period.
     */
    function setStakeConfig(
        uint256 _stakeStartTimestamp,
        uint256 _stakeEndTimestamp,
        uint256 _declarationStartTimestamp,
        uint256 _declarationEndTimestamp
    ) public onlyOwner {
        require(
            _stakeStartTimestamp < _stakeEndTimestamp &&
                _declarationStartTimestamp < _declarationEndTimestamp,
            "Invalid stake or declaration period"
        );
        stakeStartTimestamp = _stakeStartTimestamp;
        stakeEndTimestamp = _stakeEndTimestamp;
        declarationStartTimestamp = _declarationStartTimestamp;
        declarationEndTimestamp = _declarationEndTimestamp;
    }

    /**
     * @dev Sets the claim reward configuration parameters.
     *
     * This function allows the contract owner to set the claim reward configuration parameters including the start timestamp for claiming rewards, the duration of each claim period, and the percent of rewards to unlock per period.
     *
     * @param _claimRewardStartTimestamp The start timestamp for claiming rewards.
     * @param _claimPeriodDuration The duration of each claim period is seconds.
     * @param _rewardUnlockPercentPerPeriod The percent of rewards to unlock per period. 10000 = 100%, 9000 = 90%, etc.
     */
    function setClaimRewardConfig(
        uint256 _claimRewardStartTimestamp,
        uint256 _claimPeriodDuration,
        uint256 _rewardUnlockPercentPerPeriod
    ) public onlyOwner {
        require(
            _claimRewardStartTimestamp > 0 &&
                _claimPeriodDuration > 0 &&
                _rewardUnlockPercentPerPeriod > 0,
            "Invalid claim reward configuration"
        );
        claimRewardStartTimestamp = _claimRewardStartTimestamp;
        claimPeriodDuration = _claimPeriodDuration;
        rewardUnlockPercentPerPeriod = _rewardUnlockPercentPerPeriod;
    }

    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x <= y ? x : y;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
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
    function transferStake(uint256 _amount, address _staker) external;
}
