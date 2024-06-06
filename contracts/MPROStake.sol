// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";
// TODO remove console
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MPROStake is Ownable, Pausable {
    using SafeMath for uint256;

    uint256 private constant UNLOCK_PERCENT_DIVIDER = 10000;

    IERC20 public immutable rewardToken;

    // Start of staking period
    uint256 public stakeStartTimestamp;
    // End of staking period
    uint256 public stakeEndTimestamp;
    // Start of updating period
    uint256 public updateStakersStartTimestamp;
    // End of updating period
    uint256 public updateStakersEndTimestamp;
    // Reward to be paid out per second
    uint256 public rewardPerSecond;
    // Quantity of reward token to be paid out
    uint256 public rewardTokenQuantity;
    // Total staked
    uint256 public totalStakedSupply;

    // DECLARATION CONFIG
    // Start timestamp of the declaration period (enable to add new wallets to the staking pool)
    uint256 public declarationStartTimestamp;
    // End timestamp of the declaration period (disable to add new wallets to the staking pool)
    uint256 public declarationEndTimestamp;
    // Last reward timestamp
    uint256 public lastRewardTimestamp;
    // Accumulated reward per share
    uint256 public accRewardTokenPerShare;
    // Accumulated reward token quantity
    uint256 public accRewardTokenQuantity;
    //  Last update reward timestamp (function updateReward)
    uint256 public lastUpdateRewardTimestamp;
    // For updating rewards in the future we need to know how much reward was distributed
    uint256 private distributedReward;

    struct Staker {
        // pure staked tokens
        uint256 staked;
        // staked tokens with compounds
        uint256 balanceWithRewards;
        uint256 claimedBalance;
        uint256 reward;
        uint256 rewardDebt;
    }
    // Stakers
    mapping(address => Staker) public staker;

    struct StakeUpdate {
        uint256 _blockTimestamp;
        uint256 _updatedAmount;
    }

    mapping(address => StakeUpdate[]) public walletStakeUpdates;

    // CLAIM REWARD CONFIG
    // Start timestamp for claiming rewards
    uint256 public claimRewardStartTimestamp;
    // Reward unlock percent per period (10000 = 100%, 9000 = 90%, etc.)
    uint256 public rewardUnlockPercentPerPeriod = 10000;
    // Duration of each claim period in seconds
    uint256 public claimPeriodDuration;

    mapping(address => bool) public isStakeWhitelisted;

    mapping(address => bool) public isUpdaterWhitelisted;

    modifier onlyWhitelistedStakes() {
        require(
            isStakeWhitelisted[msg.sender],
            "MPRORewardStake: Stake contract is not whitelisted"
        );
        _;
    }

    modifier onlyWhitelistedUpdaters() {
        require(
            isUpdaterWhitelisted[msg.sender] || msg.sender == owner(),
            "MPRORewardStake: Address is not whitelisted updater"
        );
        _;
    }

    constructor(address _rewardTokenAddress, address _newOwner) {
        rewardToken = ERC20(_rewardTokenAddress);
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
    ) public onlyWhitelistedUpdaters {
        // Check if input is valid
        require(
            _stakers.length == _amounts.length,
            "Invalid input - length mismatch"
        );
        // Check if stake config is set
        require(
            updateStakersStartTimestamp > 0 && updateStakersEndTimestamp > 0,
            "Require to set stake config"
        );
        // Check is the staking period is valid
        require(
            block.timestamp >= updateStakersStartTimestamp,
            "Can not update out of the updating period"
        );
        // Update pool before updating stakers
        updatePool();
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
                // stake reward
                uint256 reward = stakeReward(_stakers[i]);
                // Update staked amount
                uint256 stakeAmount = stake(_stakers[i], _amounts[i]);

                // Amount taht will be subtracted from rewards
                rewardedAmountToUpdate += reward;
                // Update total amount to transfer for every staker
                totalAmountToUpdate += stakeAmount;
                // Amount that will be available to claim including compounded rewards
                stakedAmountToUpdate += stakeAmount + reward;

                _staker.rewardDebt = getAmountByWallet(_stakers[i])
                    .mul(accRewardTokenPerShare)
                    .div(1e18);

                walletStakeUpdates[_stakers[i]].push(
                    StakeUpdate({
                        _blockTimestamp: block.timestamp,
                        _updatedAmount: _amounts[i] + reward
                    })
                );
            }
        }
        // Send required tokens to the contract address
        rewardToken.transferFrom(
            msg.sender,
            address(this),
            totalAmountToUpdate
        );
        // Update total staked supply increased by pending rewards
        rewardTokenQuantity -= rewardedAmountToUpdate;
        totalStakedSupply += stakedAmountToUpdate;
    }

    function stakeReward(address _wallet) private returns (uint256) {
        Staker storage _staker = staker[_wallet];
        uint256 pending = getAmountByWallet(_wallet)
            .mul(accRewardTokenPerShare)
            .div(1e18)
            .sub(_staker.rewardDebt);

        if (pending > 0) {
            _staker.reward += pending;
            _staker.balanceWithRewards += pending;
        }
        _staker.rewardDebt = getAmountByWallet(_wallet)
            .mul(accRewardTokenPerShare)
            .div(1e18);

        return pending;
    }

    function stake(address _wallet, uint256 _amount) private returns (uint256) {
        Staker storage _staker = staker[_wallet];
        _staker.staked += _amount;
        _staker.balanceWithRewards += _amount;

        _staker.rewardDebt = getAmountByWallet(_wallet)
            .mul(accRewardTokenPerShare)
            .div(1e18);

        return _amount;
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
        uint256 _accRewardPerShare = accRewardTokenPerShare;
        if (block.timestamp > lastRewardTimestamp && totalStakedSupply != 0) {
            uint256 multiplier = getMultiplierForTimestamps(
                lastRewardTimestamp,
                block.timestamp
            );

            uint256 rewardTokenReward = multiplier.mul(rewardPerSecond);
            _accRewardPerShare = accRewardTokenPerShare.add(
                rewardTokenReward.mul(1e18).div(totalStakedSupply)
            );
        }

        return
            getAmountByWallet(_account).mul(_accRewardPerShare).div(1e18).sub(
                _staker.rewardDebt
            );
    }

    function updatePool() public {
        if (block.timestamp <= lastRewardTimestamp) {
            return;
        }
        if (totalStakedSupply == 0) {
            lastRewardTimestamp = block.timestamp;
            return;
        }
        uint256 multiplier = getMultiplierForTimestamps(
            lastRewardTimestamp,
            block.timestamp
        );
        uint256 rewardTokenReward = multiplier.mul(rewardPerSecond);
        accRewardTokenPerShare = accRewardTokenPerShare.add(
            rewardTokenReward.mul(1e18).div(totalStakedSupply)
        );

        lastRewardTimestamp = block.timestamp;
    }

    function getMultiplierForTimestamps(
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

    function getWalletStakeUpdates(
        address _account
    ) public view returns (StakeUpdate[] memory) {
        return walletStakeUpdates[_account];
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
        require(block.timestamp < stakeEndTimestamp, "Stake period has ended");
        updatePool();
        rewardToken.transferFrom(msg.sender, address(this), _amount);
        rewardTokenQuantity += _amount;
        accRewardTokenQuantity += _amount;
        uint256 remainingStakeTime = stakeEndTimestamp - block.timestamp;
        if (block.timestamp < stakeStartTimestamp) {
            remainingStakeTime = stakeEndTimestamp - stakeStartTimestamp;
        }

        if (
            lastUpdateRewardTimestamp > 0 &&
            block.timestamp > stakeStartTimestamp
        ) {
            distributedReward += rewardPerSecond.mul(
                block.timestamp - lastUpdateRewardTimestamp
            );
        }

        rewardPerSecond =
            (accRewardTokenQuantity - distributedReward) /
            remainingStakeTime;

        if (block.timestamp > stakeStartTimestamp) {
            lastUpdateRewardTimestamp = block.timestamp;
        } else {
            lastUpdateRewardTimestamp = stakeStartTimestamp;
        }
    }

    /**
     * @dev Moves tokens to another stake contract.
     *
     * This function allows the sender to move tokens to another stake contract. It verifies that the contract is not paused, and the claim reward period has started. It calculates the amount of tokens available for release using the `enableForRelease` function and ensures that it is greater than zero. The tokens available for release are then added to the staker's claimed balance, and the stake contract specified by `_stakeAddress` is called to transfer the tokens.
     *
     * @param _stakerAddress The address of the staker.
     */
    function moveToStake(
        address _stakerAddress
    )
        external
        virtual
        whenNotPaused
        onlyWhitelistedStakes
        returns (bool, string memory, uint256)
    {
        if (
            claimRewardStartTimestamp == 0 ||
            block.timestamp < claimRewardStartTimestamp
        ) return (false, "Claim period has not started", 0);
        updatePool();
        Staker storage _staker = staker[_stakerAddress];
        // Update remaining balance to claim
        if (pendingReward(_stakerAddress) > 0) {
            uint256 reward = stakeReward(_stakerAddress);
            rewardTokenQuantity -= reward;
        }

        uint256 tokensEnableToTransfer = _staker.balanceWithRewards -
            _staker.claimedBalance;

        if (tokensEnableToTransfer == 0) {
            return (false, "No tokens to release", tokensEnableToTransfer);
        }

        _staker.claimedBalance += tokensEnableToTransfer;
        rewardToken.transfer(_msgSender(), tokensEnableToTransfer);

        _staker.rewardDebt = getAmountByWallet(_stakerAddress)
            .mul(accRewardTokenPerShare)
            .div(1e18);

        return (
            true,
            "Tokens transferred successfully",
            tokensEnableToTransfer
        );
    }

    function getAmountByWallet(address wallet) private view returns (uint256) {
        Staker storage _staker = staker[wallet];
        return _staker.balanceWithRewards;
    }

    /**
     * @dev Claims tokens for the sender.
     *
     * This function allows the sender to claim tokens. It verifies that the contract is not paused and there are tokens available for claim. It updates the staker's balance to claim if there are pending rewards. It then ensures that the remaining balance to claim is sufficient for the tokens to be claimed. If the conditions are met, the tokens are transferred to the sender.
     */
    function claim() external virtual whenNotPaused {
        require(
            claimRewardStartTimestamp > 0 &&
                block.timestamp >= claimRewardStartTimestamp,
            "MPRORewardStake: Claim period has not started"
        );
        updatePool();
        Staker storage _staker = staker[_msgSender()];
        // Update remaining balance to claim
        if (pendingReward(_msgSender()) > 0) {
            uint256 reward = stakeReward(_msgSender());
            totalStakedSupply += reward;
            rewardTokenQuantity -= reward;
        }
        uint256 tokensEnableForRelease = enableForRelease();

        require(
            tokensEnableForRelease > 0,
            "MPRORewardStake: No tokens to claim"
        );

        require(
            _staker.balanceWithRewards - _staker.claimedBalance >=
                tokensEnableForRelease,
            "MPRORewardStake: Not enough tokens to claim"
        );
        _staker.claimedBalance += tokensEnableForRelease;
        rewardToken.transfer(_msgSender(), tokensEnableForRelease);

        _staker.rewardDebt = getAmountByWallet(_msgSender())
            .mul(accRewardTokenPerShare)
            .div(1e18);
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
                // Calculate percent to claim
                uint256 percentToClaim = getCyclePercentToClaim(0);

                // For instance balance to claim = 100, percent per period = 50, claimed balance = 0
                uint256 claimableTokens = _staker
                    .balanceWithRewards
                    .mul(percentToClaim)
                    .div(UNLOCK_PERCENT_DIVIDER);

                if (
                    claimableTokens > _staker.balanceWithRewards // for example 60 // Balance to claim for example 60
                ) {
                    claimableTokens = _staker.balanceWithRewards;
                }
                return claimableTokens.sub(_staker.claimedBalance);
                // When claim config is not set we allow to claim all tokens
            } else {
                return _staker.balanceWithRewards;
            }
        } else {
            return 0;
        }
    }

    function nextReleaseAllocation() public view returns (uint256) {
        if (block.timestamp >= claimRewardStartTimestamp) {
            Staker memory _staker = staker[_msgSender()];
            // Check if claim config is set to retrive data about cycles
            if (
                claimPeriodDuration > 0 && rewardUnlockPercentPerPeriod < 10000
            ) {
                // Calculate percent to claim
                uint256 percentToClaim = getCyclePercentToClaim(1);

                // For instance balance to claim = 100, percent per period = 50, claimed balance = 0
                uint256 claimableTokens = _staker
                    .balanceWithRewards
                    .mul(percentToClaim)
                    .div(UNLOCK_PERCENT_DIVIDER);
                if (
                    claimableTokens > // for example 60
                    _staker.balanceWithRewards - _staker.claimedBalance // Balance to claim for example 60
                ) {
                    return _staker.balanceWithRewards - _staker.claimedBalance;
                } else {
                    return claimableTokens.sub(_staker.claimedBalance);
                }
                // When claim config is not set we allow to claim all tokens
            } else {
                return _staker.balanceWithRewards;
            }
        } else {
            return 0;
        }
    }

    function nextReleaseTimestamp() public view returns (uint256) {
        if (block.timestamp < claimRewardStartTimestamp) {
            return claimRewardStartTimestamp;
        } else {
            uint256 rewardCycle = 1;
            rewardCycle += block.timestamp.sub(claimRewardStartTimestamp).div(
                claimPeriodDuration
            );
            return
                claimRewardStartTimestamp.add(
                    rewardCycle.mul(claimPeriodDuration)
                );
        }
    }

    function getCyclePercentToClaim(
        uint256 _cyclesToAdd
    ) private view returns (uint256) {
        if (block.timestamp >= claimRewardStartTimestamp) {
            uint256 currentCycle = (
                block.timestamp.sub(claimRewardStartTimestamp).div(
                    claimPeriodDuration
                )
                // We add 1 to the current cycle to get the next cycle
            ).add(_cyclesToAdd.add(1));

            // Calculate percent to claim
            uint256 percentToClaim = rewardUnlockPercentPerPeriod.mul(
                currentCycle
            );
            return percentToClaim;
        } else {
            return 0;
        }
    }

    /**
     * @dev Removes dust tokens from the contract.
     *
     * This function allows the contract owner to transfer all remaining tokens (dust) from the contract to the owner's address.
     * @param _amount The amount to remove from the contract.
     */
    function removeDust(uint256 _amount) public onlyOwner {
        rewardToken.transfer(msg.sender, _amount);
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
        uint256 _updateStakersStartTimestamp,
        uint256 _updateStakersEndTimestamp,
        uint256 _declarationStartTimestamp,
        uint256 _declarationEndTimestamp
    ) public onlyOwner {
        require(
            _stakeStartTimestamp < _stakeEndTimestamp &&
                _declarationStartTimestamp < _declarationEndTimestamp &&
                _updateStakersStartTimestamp < _updateStakersEndTimestamp,
            "MPRORewardStake: Invalid stake configuration"
        );
        require(
            _stakeStartTimestamp > block.timestamp &&
                _stakeEndTimestamp > block.timestamp &&
                _updateStakersStartTimestamp > block.timestamp &&
                _updateStakersEndTimestamp > block.timestamp &&
                _declarationStartTimestamp > block.timestamp &&
                _declarationEndTimestamp > block.timestamp,
            "MPRORewardStake: Invalid stake configuration - timestamps should be in the future"
        );
        if (stakeStartTimestamp > 0) {
            require(
                block.timestamp < stakeStartTimestamp,
                "MPRORewardStake: Stake period has started"
            );
        }
        stakeStartTimestamp = _stakeStartTimestamp;
        stakeEndTimestamp = _stakeEndTimestamp;
        updateStakersStartTimestamp = _updateStakersStartTimestamp;
        updateStakersEndTimestamp = _updateStakersEndTimestamp;
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
                _rewardUnlockPercentPerPeriod > 0 &&
                _rewardUnlockPercentPerPeriod <= 10000,
            "MPRORewardStake: Invalid claim reward configuration"
        );
        claimRewardStartTimestamp = _claimRewardStartTimestamp;
        claimPeriodDuration = _claimPeriodDuration;
        rewardUnlockPercentPerPeriod = _rewardUnlockPercentPerPeriod;
    }

    function setStakeWhitelisted(
        address _stakeAddress,
        bool _isWhitelisted
    ) public onlyOwner {
        isStakeWhitelisted[_stakeAddress] = _isWhitelisted;
    }

    function setUpdaterWhitelisted(
        address _walletAddress,
        bool _isWhitelisted
    ) public onlyOwner {
        isUpdaterWhitelisted[_walletAddress] = _isWhitelisted;
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
