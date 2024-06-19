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

    // Unlock percent divider
    uint256 private constant UNLOCK_PERCENT_DIVIDER = 10000;

    // Reward token
    IERC20 public immutable rewardToken;

    // Start of staking period
    uint256 public stakeStartTimestamp;
    // End of staking period
    uint256 public stakeEndTimestamp;
    // Reward to be paid out per second
    uint256 public rewardPerSecond;
    // Quantity of reward token to be paid out
    uint256 public rewardTokenQuantity;
    // Total staked
    uint256 public totalStakedSupply;

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
        // pure staked tokens only
        uint256 staked;
        // staked tokens with compounds
        uint256 balanceWithRewards;
        uint256 claimedBalance;
        uint256 reward;
        uint256 rewardDebt;
    }

    struct StakeConfig {
        uint256 stakeStartTimestamp;
        uint256 stakeEndTimestamp;
        uint256 rewardPerSecond;
        uint256 rewardTokenQuantity;
        uint256 totalStakedSupply;
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
            isStakeWhitelisted[_msgSender()],
            "MPROStake: Stake contract is not whitelisted"
        );
        _;
    }

    modifier onlyWhitelistedUpdaters() {
        require(
            isUpdaterWhitelisted[_msgSender()] || _msgSender() == owner(),
            "MPROStake: Address is not whitelisted updater"
        );
        _;
    }

    event StakeReward(address _staker, uint256 _rewardAmount);
    event Stake(address _staker, uint256 _stakeAmount);
    event MoveToStake(address _staker, address _stake, uint256 _amount);
    event Unstake(address _staker, uint256 _amount);
    event ClaimReward(address _staker, uint256 _amount);
    event UpdateReward(uint256 _amount, uint256 _rewardPerSecond);

    /**
     * @dev Initializes the MPROAutoStake contract.
     *
     * This function initializes the MPROAutoStake contract with the specified reward token address and the new owner address. It sets the reward token and transfers the ownership to the new owner.
     *
     * @param _rewardTokenAddress The address of the reward token.
     * @param _newOwner The address of the new owner.
     */
    constructor(address _rewardTokenAddress, address _newOwner) {
        rewardToken = ERC20(_rewardTokenAddress);
        _transferOwnership(_newOwner);
    }

    function stake(uint256 _amount) public {
        // Update pool before updating stakers
        updatePool();
        Staker storage _staker = staker[_msgSender()];

        // stake reward
        uint256 reward = stakeReward(_msgSender());
        // Update staked amount
        uint256 stakeAmount = stakeLocal(_msgSender(), _amount);

        _staker.rewardDebt = getAmountByWallet(_msgSender())
            .mul(accRewardTokenPerShare)
            .div(1e18);

        walletStakeUpdates[_msgSender()].push(
            StakeUpdate({
                _blockTimestamp: block.timestamp,
                _updatedAmount: stakeAmount + reward
            })
        );
        // Send required tokens to the contract address
        rewardToken.transferFrom(_msgSender(), address(this), stakeAmount);
        // Update total staked supply increased by pending rewards
        rewardTokenQuantity -= reward;
        totalStakedSupply += stakeAmount + reward;

        emit Stake(_msgSender(), stakeAmount + reward);
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

        emit StakeReward(_wallet, pending);
        return pending;
    }

    /**
     * @dev Stakes tokens for a specific staker.
     *
     * This function allows the contract owner to stake tokens for a specific staker. It verifies the validity of the stake period, ensures that the staker's balance is greater than zero, and calculates the amount to stake based on the staker's address and the specified amount. If the staker's balance is zero, the function returns zero. Otherwise, it calculates the amount to stake, updates the staker's information, and returns the staked amount.
     *
     * @param _wallet The address of the staker.
     * @param _amount The amount of tokens to stake.
     * @return uint256 The staked amount.
     */
    function stakeLocal(
        address _wallet,
        uint256 _amount
    ) private returns (uint256) {
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

    /**
     * @dev Updates the pool.
     *
     * This function updates the pool by calculating the multiplier for timestamps and the reward token reward. It then updates the accumulated reward per share based on the reward token reward and the total staked supply. If the current timestamp is less than or equal to the last reward timestamp, the function returns without updating the pool. If the total staked supply is zero, the function returns without updating the pool. Otherwise, it calculates the multiplier for timestamps and the reward token reward, updates the accumulated reward per share, and sets the last reward timestamp to the current timestamp.
     */
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

    /**
     * @dev Retrieves the multiplier for timestamps.
     *
     * This function calculates and returns the multiplier for timestamps based on the start and end timestamps of the stake period. If the end timestamp is less than or equal to the specified timestamp, the function returns the difference between the two timestamps. If the start timestamp is greater than or equal to the specified timestamp, the function returns zero. Otherwise, it returns the difference between the end timestamp and the specified timestamp.
     *
     * @param _from The start timestamp.
     * @param _to The end timestamp.
     * @return uint256 The multiplier for timestamps.
     */
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

    /**
     * @dev Retrieves the claimed balance for a specific staker.
     *
     * This function returns the claimed balance for a specific staker based on their account address.
     *
     * @param _account The address of the staker.
     * @return uint256 The claimed balance.
     */
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
    function updateReward(uint256 _amount) public onlyWhitelistedUpdaters {
        require(
            stakeStartTimestamp > 0 && stakeEndTimestamp > 0,
            "Invalid stake period config"
        );
        require(block.timestamp < stakeEndTimestamp, "Stake period has ended");
        updatePool();
        rewardToken.transferFrom(_msgSender(), address(this), _amount);
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

        emit UpdateReward(_amount, rewardPerSecond);
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
        uint256 stakedSupply = totalStakedSupply;
        updatePool();
        Staker storage _staker = staker[_stakerAddress];
        // Update remaining balance to claim
        if (pendingReward(_stakerAddress) > 0) {
            uint256 reward = stakeReward(_stakerAddress);
            stakedSupply += reward;
            rewardTokenQuantity -= reward;
        }

        uint256 tokensEnableToTransfer = _staker.balanceWithRewards -
            _staker.claimedBalance;

        if (tokensEnableToTransfer == 0) {
            return (false, "No tokens to release", tokensEnableToTransfer);
        }

        _staker.claimedBalance += tokensEnableToTransfer;
        rewardToken.transfer(_msgSender(), tokensEnableToTransfer);

        _staker.staked = 0;
        stakedSupply -= tokensEnableToTransfer;
        totalStakedSupply = stakedSupply;

        _staker.rewardDebt = getAmountByWallet(_stakerAddress)
            .mul(accRewardTokenPerShare)
            .div(1e18);

        emit MoveToStake(_stakerAddress, _msgSender(), tokensEnableToTransfer);

        return (
            true,
            "Tokens transferred successfully",
            tokensEnableToTransfer
        );
    }

    /**
     * @dev Retrieves the staked amount for a specific staker.
     *
     * This function returns the staked amount for a specific staker based on their account address.
     *
     * @param wallet The address of the staker.
     * @return uint256 The staked amount.
     */
    function getAmountByWallet(address wallet) private view returns (uint256) {
        Staker storage _staker = staker[wallet];
        return _staker.balanceWithRewards.sub(_staker.claimedBalance);
    }

    function claimReward() external virtual whenNotPaused {
        require(
            claimRewardStartTimestamp > 0 &&
                block.timestamp >= claimRewardStartTimestamp,
            "MPROStake: Claim period has not started"
        );

        uint256 _pendingReward = pendingReward(_msgSender());
        require(_pendingReward > 0, "MPROStake: No tokens to claim");
        updatePool();
        Staker storage _staker = staker[_msgSender()];
        rewardTokenQuantity -= _pendingReward;
        rewardToken.transfer(_msgSender(), _pendingReward);

        _staker.rewardDebt = getAmountByWallet(_msgSender())
            .mul(accRewardTokenPerShare)
            .div(1e18);

        emit ClaimReward(_msgSender(), _pendingReward);
    }

    /**
     * @dev Claims tokens for the sender.
     *
     * This function allows the sender to claim tokens. It verifies that the contract is not paused and there are tokens available for claim. It updates the staker's balance to claim if there are pending rewards. It then ensures that the remaining balance to claim is sufficient for the tokens to be claimed. If the conditions are met, the tokens are transferred to the sender.
     */
    function unstake() external virtual whenNotPaused {
        require(
            claimRewardStartTimestamp > 0 &&
                block.timestamp >= claimRewardStartTimestamp,
            "MPROStake: Claim period has not started"
        );
        uint256 stakedSupply = totalStakedSupply;
        updatePool();
        Staker storage _staker = staker[_msgSender()];
        // Update remaining balance to claim
        if (pendingReward(_msgSender()) > 0) {
            uint256 reward = stakeReward(_msgSender());
            stakedSupply += reward;
            rewardTokenQuantity -= reward;
        }
        uint256 tokensEnableForRelease = enableForRelease();

        require(tokensEnableForRelease > 0, "MPROStake: No tokens to claim");

        require(
            _staker.balanceWithRewards - _staker.claimedBalance >=
                tokensEnableForRelease,
            "MPROStake: Not enough tokens to claim"
        );
        _staker.claimedBalance += tokensEnableForRelease;
        rewardToken.transfer(_msgSender(), tokensEnableForRelease);

        _staker.staked = 0;
        stakedSupply -= tokensEnableForRelease;
        totalStakedSupply = stakedSupply;

        _staker.rewardDebt = getAmountByWallet(_msgSender())
            .mul(accRewardTokenPerShare)
            .div(1e18);

        emit Unstake(_msgSender(), tokensEnableForRelease);
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
            }
            // When claim config is not set we allow to claim all tokens
            else {
                return getAmountByWallet(_msgSender());
            }
        } else {
            return 0;
        }
    }

    function compoundReward() external virtual whenNotPaused {
        uint256 _pendingReward = pendingReward(_msgSender());
        require(_pendingReward > 0, "MPROStake: No rewards to compound");
        updatePool();
        Staker storage _staker = staker[_msgSender()];
        uint256 reward = stakeReward(_msgSender());
        walletStakeUpdates[_msgSender()].push(
            StakeUpdate({
                _blockTimestamp: block.timestamp,
                _updatedAmount: reward
            })
        );

        rewardTokenQuantity -= reward;
        totalStakedSupply += reward;

        _staker.rewardDebt = getAmountByWallet(_msgSender())
            .mul(accRewardTokenPerShare)
            .div(1e18);
    }

    /**
     * @dev Retrieves the next release allocation.
     *
     * This function calculates and returns the next release allocation based on the current timestamp and the claim reward start timestamp. If the current timestamp is greater than or equal to the claim reward start timestamp, it retrieves the staker's information and calculates the percent to claim based on the current cycle. It then calculates the claimable tokens based on the staker's balance with rewards and claimed balance. If the claimable tokens are greater than the balance with rewards, it sets the claimable tokens to the balance with rewards. If the claim configuration is not set, it allows claiming all tokens. If the conditions are not met, it returns zero.
     *
     * @return uint256 The next release allocation.
     */
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
                    .sub(_staker.claimedBalance)
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

    /**
     * @dev Retrieves the next release timestamp.
     *
     * This function calculates and returns the next release timestamp based on the current timestamp and the claim reward start timestamp. If the current timestamp is less than the claim reward start timestamp, it returns the claim reward start timestamp. Otherwise, it calculates the reward cycle and returns the next release timestamp.
     *
     * @return uint256 The next release timestamp.
     */
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

    /**
     * @dev Retrieves the percent of tokens to claim for the current cycle.
     */
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
        rewardToken.transfer(_msgSender(), _amount);
    }

    /**
     * @dev Withdraws emergency reward tokens from the contract.
     */
    function emergencyRewardWithdrawal() public onlyOwner {
        updatePool();
        rewardToken.transferFrom(
            address(this),
            _msgSender(),
            rewardTokenQuantity
        );
        rewardTokenQuantity -= rewardTokenQuantity;
        accRewardTokenQuantity -= rewardTokenQuantity;
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
     * @dev Sets the stake configuration parameters.
     *
     * This function allows the contract owner to set the stake configuration parameters including the start and end timestamps for staking and declaration periods.
     *
     * @param _stakeStartTimestamp The start timestamp for the stake period.
     * @param _stakeEndTimestamp The end timestamp for the stake period.
     */
    function setStakeConfig(
        uint256 _stakeStartTimestamp,
        uint256 _stakeEndTimestamp
    ) public onlyOwner {
        require(
            _stakeStartTimestamp < _stakeEndTimestamp,
            "MPROStake: Invalid stake configuration"
        );
        require(
            _stakeStartTimestamp > block.timestamp &&
                _stakeEndTimestamp > block.timestamp,
            "MPROStake: Invalid stake configuration - timestamps should be in the future"
        );

        // Check if the stake start timestamp is greater than the current timestamp
        if (stakeStartTimestamp == 0 || block.timestamp < stakeStartTimestamp) {
            stakeStartTimestamp = _stakeStartTimestamp;
            stakeEndTimestamp = _stakeEndTimestamp;
        }
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
            "MPROStake: Invalid claim reward configuration"
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

    function pause() public onlyWhitelistedUpdaters {
        _pause();
    }

    function unpause() public onlyWhitelistedUpdaters {
        _unpause();
    }

    function getStakeConfig()
        public
        view
        returns (StakeConfig memory stakeConfig)
    {
        return
            StakeConfig({
                stakeStartTimestamp: stakeStartTimestamp,
                stakeEndTimestamp: stakeEndTimestamp,
                rewardPerSecond: rewardPerSecond,
                rewardTokenQuantity: rewardTokenQuantity,
                totalStakedSupply: totalStakedSupply
            });
    }
}
