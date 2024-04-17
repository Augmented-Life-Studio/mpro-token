// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MPROVesting is Context, Ownable {
    using SafeMath for uint256;

    /**
     * @dev Constant representing the divider for percentage values. This is used to convert percentage values
     * to their decimal representation. For example, a value of 10000 represents 100%.
     */
    uint256 private constant UNLOCK_PERCENT_DIVIDER = 10000;

    /**
     * @dev Struct representing a beneficiary of the vesting contract. Each beneficiary is associated with
     * a specific amount of tokens and a claimable amount of tokens. The `amount` field represents the total
     * amount of tokens allocated to the beneficiary. The `claimed` field represents the amount of tokens that
     * the beneficiary has already claimed from their allocation.
     */
    struct VestingBeneficiary {
        uint256 amount;
        uint256 claimed;
    }

    /**
     * @dev The ERC20 token address which is being vested in this contract.
     */
    address public token;
    /**
     * @dev Mapping of beneficiary addresses to their respective vesting data.
     */
    mapping(address => VestingBeneficiary) private vestingBeneficiaries;
    /**
     * @dev The timestamp deadline after which the TGE unlock timestamp cannot be updated.
     */
    uint256 private immutable tgeUnlockTimestampDeadline;
    /**
     * @dev The timestamp after which tokens begin to unlock.
     */
    uint256 public tgeUnlockTimestamp;
    /**
     * @dev The percentage of tokens to be unlocked at TGE (Token Generation Event).
     */
    uint256 public immutable tgeUnlockPercent;
    /**
     * @dev The timestamp after which tokens begin to vest.
     */
    uint256 public cliffTimestamp;
    /**
     * @dev The percentage of tokens to be unlocked per vesting period.
     */
    uint256 public immutable vestingUnlockPercentPerPeriod;
    /**
     * @dev The duration of each vesting period in seconds.
     */
    uint256 public immutable vestingPeriodDuration;

    /**
     * @dev Modifier that restricts function access to only beneficiaries of the vesting contract.
     * This modifier checks if the specified account is a beneficiary by verifying that the account has
     * a non-zero allocation of tokens for vesting. If the account does not have an allocation, the function
     * call is reverted with an error message. This ensures that only accounts with vested tokens can access
     * certain functions, such as claiming vested tokens.
     *
     * @param _account The address of the account to check for beneficiary status.
     */
    modifier onlyBeneficiary(address _account) {
        require(
            vestingBeneficiaries[_account].amount > 0,
            "MPROVesting: Account is not a beneficiary"
        );
        _;
    }

    event SetTgeUnlockTimestamp(uint256 _timestamp);
    event RegisterBeneficiaries(address[] _beneficiaries, uint256[] _amounts);
    event Claim(address _beneficiary, uint256 _amount);
    event EmergencyWithdraw(uint256 _amount);

    /**
     * @dev Constructor for the MPROVesting contract. Initializes the contract with necessary parameters
     * for token vesting. Sets the token address, Token Generation Event (TGE) unlock timestamp and percent,
     * cliff delay, vesting percent per period, vesting period duration, and the contract owner.
     *
     * The TGE unlock timestamp defines when the initial unlock of tokens occurs, and the TGE unlock percent
     * specifies the percentage of tokens unlocked at TGE. The cliff delay sets a period after TGE during which
     * no tokens are vested. The vesting unlock percent per period and the vesting period duration define the
     * rate and frequency at which tokens are vested after the cliff period.
     *
     * Ownership of the contract is transferred to `_newOwner` to allow management of vesting parameters and
     * beneficiaries.
     *
     * @param _tgeUnlockTimestamp The timestamp for the initial unlock of tokens (TGE).
     * @param _tgeUnlockPercent The percentage of total tokens to be unlocked at TGE.
     * @param _cliffDelay The delay after TGE during which no tokens are vested.
     * @param _vestingUnlockPercentPerPeriod The percentage of tokens to be vested per vesting period.
     * @param _vestingPeriodDuration The duration of each vesting period in seconds.
     * @param _newOwner The address that will be granted ownership of the contract.
     */
    constructor(
        uint256 _tgeUnlockTimestamp,
        uint256 _tgeUnlockPercent,
        uint256 _cliffDelay,
        uint256 _vestingUnlockPercentPerPeriod,
        uint256 _vestingPeriodDuration,
        address _newOwner
    ) {
        require(
            _vestingUnlockPercentPerPeriod <= UNLOCK_PERCENT_DIVIDER,
            "Vesting: Invalid period unlock percent"
        );
        require(
            _tgeUnlockPercent <= UNLOCK_PERCENT_DIVIDER,
            "Vesting: Invalid tge unlock percent"
        );
        tgeUnlockTimestampDeadline = block.timestamp + 30 days;
        tgeUnlockTimestamp = _tgeUnlockTimestamp;
        tgeUnlockPercent = _tgeUnlockPercent;
        cliffTimestamp = tgeUnlockTimestamp + _cliffDelay;
        vestingUnlockPercentPerPeriod = _vestingUnlockPercentPerPeriod;
        vestingPeriodDuration = _vestingPeriodDuration;
        _transferOwnership(_newOwner);
    }

    /**
     * @dev Sets the TGE (Token Generation Event) unlock timestamp. This function allows the contract owner
     * to set the timestamp indicating when tokens begin to unlock for beneficiaries. It enforces that the new
     * timestamp is greater than the current time and less than a predefined deadline. Adjusts the `cliffTimestamp`
     * accordingly to maintain the delay period. Emits a `SetTgeUnlockTimestamp` event upon successful update.
     *
     * @param _timestamp The new TGE unlock timestamp.
     */
    function setTgeUnlockTimestamp(uint256 _timestamp) external onlyOwner {
        require(
            _timestamp > block.timestamp,
            "Vesting: TGE unlock time cannot be lower than current time"
        );
        require(
            _timestamp <= tgeUnlockTimestampDeadline,
            "Vesting: TGE unlock time must be less than tgeUnlockTimestampDeadline"
        );
        require(
            tgeUnlockTimestamp > block.timestamp,
            "Vesting: TGE unlock time already passed"
        );

        cliffTimestamp = _timestamp + (cliffTimestamp - tgeUnlockTimestamp);
        tgeUnlockTimestamp = _timestamp;
        emit SetTgeUnlockTimestamp(_timestamp);
    }

    /**
     * @dev Sets the vesting token address. This function can only be called by the contract owner. It enforces
     * that the token address is non-zero and that the token has not already been set. Emits a `SetVestingToken`
     * event upon successful update.
     *
     * @param _token The address of the ERC20 token to be vested.
     */
    function setVestingToken(address _token) external onlyOwner {
        require(_token != address(0), "Vesting: Invalid vesting token");
        require(token == address(0), "Vesting: Token already set");
        token = _token;
    }

    /**
     * @dev Registers multiple beneficiaries for vesting. Each beneficiary is associated with a specific
     * amount of tokens. This function can only be called by the contract owner. It validates the input arrays
     * for proper length and non-zero addresses. Updates the `vestingBeneficiaries` mapping with the provided
     * data. Emits `RegisterBeneficiaries` event upon successful registration.
     *
     * @param _beneficiaries Array of beneficiary addresses.
     * @param _amounts Array of token amounts corresponding to each beneficiary.
     */
    function registerBeneficiaries(
        address[] memory _beneficiaries,
        uint256[] memory _amounts
    ) external virtual onlyOwner {
        require(
            _beneficiaries.length == _amounts.length,
            "Vesting: Invalid input lengths"
        );
        // Use in memory _beneficiaries for lenght check
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            if (_beneficiaries[i] == address(0)) {
                revert("Vesting: Invalid beneficiary");
            }
            VestingBeneficiary memory beneficiary = vestingBeneficiaries[
                _beneficiaries[i]
            ];
            // Allow owner to reduce the amount of tokens for a beneficiary by registering beneficiary with a lower amount
            if (beneficiary.amount == 0) {
                vestingBeneficiaries[_beneficiaries[i]] = VestingBeneficiary(
                    _amounts[i],
                    0
                );
            }
        }
        emit RegisterBeneficiaries(_beneficiaries, _amounts);
    }

    /**
     * @dev Returns the claimable balance of tokens for the caller. This function calculates the balance by
     * subtracting the already claimed tokens from the total allocated amount for the caller. It can only be
     * called by a beneficiary of the vesting contract.
     *
     * @return The amount of tokens that the caller can claim.
     */
    function claimBalance()
        public
        view
        virtual
        onlyBeneficiary(_msgSender())
        returns (uint256)
    {
        return
            vestingBeneficiaries[_msgSender()].amount -
            vestingBeneficiaries[_msgSender()].claimed;
    }

    /**
     * @dev Returns the amount of tokens already claimed by the caller. This function is accessible only to
     * beneficiaries of the contract and provides an easy way to track the amount of tokens they have already
     * withdrawn from their allocated amount.
     *
     * @return The amount of tokens already claimed by the caller.
     */
    function claimedAllocation()
        public
        view
        virtual
        onlyBeneficiary(_msgSender())
        returns (uint256)
    {
        return vestingBeneficiaries[_msgSender()].claimed;
    }

    /**
     * @dev Calculates the amount of tokens that a beneficiary is eligible to claim at the current time.
     * This function considers the TGE unlock timestamp, the cliff period, and the vesting schedule to compute
     * the claimable amount. It returns zero if the current time is before the TGE unlock timestamp, and calculates
     * the tokens available based on the vesting schedule otherwise.
     *
     * @return The amount of tokens the beneficiary is currently eligible to claim.
     */
    function enableForRelease()
        public
        view
        onlyBeneficiary(_msgSender())
        returns (uint256)
    {
        VestingBeneficiary memory beneficiary = vestingBeneficiaries[
            _msgSender()
        ];
        uint256 totalTokens = beneficiary.amount;
        uint256 claimableTgaTokens = totalTokens.mul(tgeUnlockPercent).div(
            UNLOCK_PERCENT_DIVIDER
        );
        if (
            block.timestamp >= tgeUnlockTimestamp &&
            block.timestamp < cliffTimestamp
        ) {
            return claimableTgaTokens.sub(beneficiary.claimed);
        } else if (block.timestamp >= cliffTimestamp) {
            uint256 vestingCircles = block.timestamp.sub(cliffTimestamp).div(
                vestingPeriodDuration
            );
            uint256 percentFromVesting = vestingUnlockPercentPerPeriod.add(
                vestingCircles.mul(vestingUnlockPercentPerPeriod)
            );

            uint256 vestingTokens = totalTokens.mul(percentFromVesting).div(
                UNLOCK_PERCENT_DIVIDER
            );
            uint256 totalLinearTokens = claimableTgaTokens.add(vestingTokens);
            if (totalLinearTokens > totalTokens) {
                totalLinearTokens = totalTokens;
            }
            return totalLinearTokens.sub(beneficiary.claimed);
        } else {
            return 0;
        }
    }

    function nextReleaseTimestamp() public view returns (uint256) {
        if (block.timestamp < tgeUnlockTimestamp) {
            return tgeUnlockTimestamp;
        } else if (block.timestamp < cliffTimestamp) {
            return cliffTimestamp;
        } else {
            uint256 vestingCircle = 1;
            vestingCircle += block.timestamp.sub(cliffTimestamp).div(
                vestingPeriodDuration
            );
            return cliffTimestamp.add(vestingCircle.mul(vestingPeriodDuration));
        }
    }

    function nextReleaseAllocation()
        public
        view
        onlyBeneficiary(_msgSender())
        returns (uint256)
    {
        VestingBeneficiary memory beneficiary = vestingBeneficiaries[
            _msgSender()
        ];
        uint256 totalTokens = beneficiary.amount;
        uint256 claimableTgaTokens = totalTokens.mul(tgeUnlockPercent).div(
            UNLOCK_PERCENT_DIVIDER
        );
        if (block.timestamp < tgeUnlockTimestamp) {
            return claimableTgaTokens;
        } else {
            uint256 vestingCircle = 1;
            if (block.timestamp > cliffTimestamp)
                vestingCircle += block.timestamp.sub(cliffTimestamp).div(
                    vestingPeriodDuration
                );

            uint256 vestingTokens = totalTokens
                .mul(vestingUnlockPercentPerPeriod)
                .div(UNLOCK_PERCENT_DIVIDER);

            if (
                vestingCircle.mul(vestingTokens) >=
                totalTokens - claimableTgaTokens
            ) {
                return 0;
            }

            return vestingTokens;
        }
    }

    /**
     * @dev Allows a beneficiary to claim their vested tokens. This function checks if the current time is past
     * the TGE unlock timestamp and if there are tokens available for release. Updates the claimed amount in the
     * `vestingBeneficiaries` mapping and transfers the eligible tokens to the caller. Emits a `Claim` event upon
     * successful transfer of tokens.
     */
    function claim() external virtual onlyBeneficiary(_msgSender()) {
        require(
            block.timestamp >= tgeUnlockTimestamp,
            "Vesting: Not yet unlocked"
        );
        uint256 tokensEnableForRelease = enableForRelease();
        require(tokensEnableForRelease > 0, "Vesting: No tokens to release");

        vestingBeneficiaries[_msgSender()].claimed += tokensEnableForRelease;
        SafeERC20.safeTransfer(
            IERC20(token),
            _msgSender(),
            tokensEnableForRelease
        );
        emit Claim(_msgSender(), tokensEnableForRelease);
    }

    function emergencyVestingTokenWithdraw() external onlyOwner {
        uint256 _amount = IERC20(token).balanceOf(address(this));
        SafeERC20.safeTransfer(IERC20(token), _msgSender(), _amount);
        emit EmergencyWithdraw(_amount);
    }
}
