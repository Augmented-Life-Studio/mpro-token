// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IMPRORoleManager {
    function isWhitelisted(address account) external view returns (bool);
}

interface IMPROToken is IERC20 {
    function mint(address account, uint256 amount) external;
}

/**
 * @title MPRO Master Distributor Contract
 * @dev The MPROMasterDistributor contract manages token distribution and related operations.
 * It is responsible for distributing tokens to eligible recipients based on specified rules and
 * configurations. This contract utilizes the AccessControl feature for role-based access control.
 *
 * This contract extends the Context and AccessControl contracts to leverage their functionality.
 * Role-based access control allows specific roles to perform authorized actions within the contract,
 * ensuring proper governance and security.
 */
contract MPROMasterDistributor is Context, AccessControl {
    using SafeMath for uint256;

    /**
     * @dev Struct representing a distribution reduction configuration.
     *
     * This struct defines a configuration for reducing the daily token distribution over time. It
     * consists of two fields:
     * - `reductionTimestamp`: The timestamp at which the reduction in distribution should take effect.
     * - `daylyDistribution`: The daily distribution amount of tokens after the reduction.
     *
     * Instances of this struct are typically used in an array to specify different reduction
     * configurations over time. The reduction timestamp marks when the daily distribution amount
     * should change.
     */
    struct DistributionReduction {
        uint256 reductionTimestamp;
        uint256 daylyDistribution;
    }

    /**
     * @dev Constant representing the number of seconds in a day.
     *
     * This constant defines the number of seconds in a day, which is used for time calculations
     * within the contract. It is set to the standard value of 86,400 seconds per day.
     */
    uint256 constant SECONDS_PER_DAY = 86400;

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant MPRO_MASTER_DISTRIBUTOR_ROLE =
        keccak256("MPRO_MASTER_DISTRIBUTOR_ROLE");
    bytes32 public constant DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE =
        keccak256("DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE");
    bytes32 public constant DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER =
        keccak256("DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER");

    IMPRORoleManager private roleManagerContract;
    IMPROToken private mproToken;

    /**
     * @dev Timestamp indicating when token distribution starts.
     *
     * This private state variable stores the Unix timestamp (in seconds) that marks the beginning
     * of the token distribution period. The value is set during the contract initialization and
     * can be updated by specific functions within the contract, depending on the contract's logic.
     *
     * The distributionStartTimestamp is used in various functions to determine whether the
     * distribution period has begun. This allows for conditional logic based on the time, such as
     * enabling token distributions only after this timestamp is reached.
     *
     * Being a private variable, it can only be accessed and modified by functions within this
     * contract, providing a controlled and secure way to manage the start of the distribution phase.
     */
    uint256 private distributionStartTimestamp;

    /**
     * @dev Private immutable variable representing the deadline for the distribution start timestamp.
     *
     * This variable is used to store an immutable timestamp that defines the deadline for the
     * distribution start timestamp within the contract. It is typically set during contract
     * initialization and remains constant throughout the contract's lifetime.
     *
     * The distribution start timestamp deadline indicates the latest permissible timestamp for
     * starting the distribution of tokens. After this deadline, distribution start timestamps
     * beyond this value will not be accepted.
     */
    uint256 private immutable distributionStartTimestampDeadLine;

    /**
     * @dev Private variable to keep track of the total tokens distributed.
     *
     * This variable is used to maintain a count of the total tokens that have been distributed
     * within the contract. It starts at zero and is updated whenever tokens are distributed to
     * recipients.
     *
     * It serves as a record of the cumulative tokens distributed and is often used to enforce
     * distribution limits or to check the available tokens for distribution.
     */
    uint256 private distributedTokens = 0;

    /**
     * @dev Private constant representing the initial daily distribution of tokens.
     *
     * This constant defines the initial daily distribution of tokens within the contract. It
     * represents a fixed amount of tokens that are distributed daily as part of a distribution
     * mechanism.
     *
     * The value is expressed in the contract's token decimals, and it remains constant throughout
     * the contract's lifetime.
     */
    uint256 private constant initialDaylyDistribution = 250_000 * 10 ** 8;

    /**
     * @dev Public array to store distribution reduction configurations.
     *
     * This dynamic array stores instances of the `DistributionReduction` struct, representing
     * configurations for reducing the daily token distribution over time. Each element of the array
     * specifies a different reduction configuration, and the array can grow as more configurations
     * are added.
     *
     * These configurations determine when and how the daily distribution amount of tokens changes
     * over time, allowing for flexibility in managing token distribution within the contract.
     */
    DistributionReduction[] public distributionReductions;

    /**
     * @dev Public variable representing the burn rate for tokens.
     *
     * This variable determines the burn rate for tokens within the contract, expressed as a
     * percentage. A burn rate of 1000 corresponds to 10%, where a portion of tokens is burned
     * during certain operations. A burn rate of 10000 would represent 100%.
     *
     * The value of this variable can be adjusted to control the rate at which tokens are burned
     * during specific actions, impacting the total token supply over time.
     */
    uint256 public burnRate = 1000; // 10000 = 100%

    /**
     * @dev Modifier to check and enable distribution reduction configurations.
     *
     * This modifier is used to validate and enable distribution reduction configurations. It checks
     * that the provided `_reductionTimestamp` and `_reductionAmount` meet certain criteria to ensure
     * that reductions are allowed. The criteria include:
     *
     * - `_reductionTimestamp` must be greater than the timestamp of the last reduction.
     * - `_reductionTimestamp` must be greater than or equal to the current timestamp plus 30 days.
     * - `_reductionAmount` must be greater than or equal to half of the previous daily distribution.
     *
     * If all criteria are met, the modifier allows the decorated function or operation to proceed.
     * Otherwise, it reverts with specific error messages.
     */
    modifier reductionEnabled(
        uint256 _reductionTimestamp,
        uint256 _reductionAmount
    ) {
        DistributionReduction memory lastReduction;

        if (distributionReductions.length > 0) {
            lastReduction = distributionReductions[
                distributionReductions.length - 1
            ];
        } else {
            lastReduction = DistributionReduction(
                distributionStartTimestamp,
                initialDaylyDistribution
            );
        }

        require(
            _reductionTimestamp > lastReduction.reductionTimestamp,
            "newReductionTimestamp must be greater than previousDistributionTimestamp"
        );
        require(
            _reductionTimestamp >= block.timestamp + 30 days,
            "firstDistributionReductionTimestamp must be greater than current time + 30 days"
        );
        require(
            _reductionAmount >= lastReduction.daylyDistribution.div(2),
            "newReductionAmount must be greater than or equal to half of previousDistributionAmount"
        );
        _;
    }

    /**
     * @dev Constructor for the contract.
     *
     * Initializes the contract by setting up the distribution start times and assigning the OWNER_ROLE
     * to the provided owner address. The distribution timestamps are set relative to the current
     * block timestamp at the time of contract deployment.
     *
     * - `distributionStartTimestamp` is set to 14 days after the contract deployment.
     * - `distributionStartTimestampDeadLine` is set to 30 days after the contract deployment.
     * This setup creates a window during which distributions can start, determined by these two timestamps.
     *
     * The OWNER_ROLE is a critical role that will likely have high-level permissions and capabilities
     * within the contract, so it should be assigned carefully.
     *
     * @param _owner The address that will be granted the OWNER_ROLE, typically the address deploying
     *               the contract or a designated administrator.
     */
    constructor(address _owner) {
        distributionStartTimestamp = block.timestamp + 14 days;
        distributionStartTimestampDeadLine = block.timestamp + 30 days;
        _grantRole(OWNER_ROLE, _owner);
    }

    /**
     * @dev Calculates the total token distribution since the start of the distribution period.
     *
     * This function computes the cumulative amount of tokens distributed since the
     * `distributionStartTimestamp`. The distribution amount may vary over different time periods,
     * as defined by the entries in the `distributionReductions` array. Each entry in this array
     * specifies a reduction in the daily distribution rate starting from a particular timestamp.
     *
     * The calculation is performed as follows:
     * - If the current block timestamp is before `distributionStartTimestamp`, the function returns 0,
     *   indicating that the distribution period has not yet started.
     * - It calculates the total number of days elapsed since `distributionStartTimestamp`.
     * - For each entry in `distributionReductions`, it determines the number of days within the
     *   respective period and accumulates the total distribution based on the daily distribution rate
     *   for that period.
     * - The function finally accounts for the remaining days using the `initialDaylyDistribution` rate.
     *
     * Note: The function assumes that `distributionReductions` are sorted in descending order of their
     * timestamps, and the `daylyDistribution` values represent the reduced distribution rates
     * applicable after each respective timestamp.
     *
     * @return totalDistribution The total amount of tokens distributed since the start of the
     *         distribution period up to the current time.
     */
    function getAllTokenDistribution() public view returns (uint256) {
        if (block.timestamp < distributionStartTimestamp) {
            return 0;
        }

        uint256 totalDistribution = 0;
        // Time periods since last distribution
        uint256 timeElapsed = block.timestamp - distributionStartTimestamp;
        uint256 daysElapsed = timeElapsed / SECONDS_PER_DAY;

        for (
            uint256 index = 0;
            index < distributionReductions.length;
            index++
        ) {
            DistributionReduction
                memory distributionReduction = distributionReductions[index];
            uint daysElapsedToReduction = (block.timestamp -
                distributionReduction.reductionTimestamp) / SECONDS_PER_DAY;
            if (daysElapsed > daysElapsedToReduction) {
                // Days in current period
                uint256 daysInCurrentPeriod = daysElapsed -
                    daysElapsedToReduction;
                totalDistribution +=
                    daysInCurrentPeriod *
                    distributionReduction.daylyDistribution;
                // Update daysElapsed for previous period
                daysElapsed = daysElapsedToReduction;
            }
        }
        // Remaining days are in the first period
        totalDistribution += daysElapsed * initialDaylyDistribution;

        return totalDistribution;
    }

    /**
     * @dev Calculates the quantity of tokens currently available for distribution.
     *
     * This function determines the amount of tokens that are available to be distributed at the
     * current moment. It calculates this by subtracting the already distributed tokens
     * (`distributedTokens`) from the total amount of tokens that have been allocated for distribution
     * up to the current time (`getAllTokenDistribution`).
     *
     * The function is marked as private and can only be called within the contract itself. This
     * encapsulation ensures that the logic for calculating the available tokens for distribution
     * is controlled and not exposed externally.
     *
     * @return The quantity of tokens that are available for distribution.
     */
    function getAvailableForDistributionTokenQuantity()
        private
        view
        returns (uint256)
    {
        return getAllTokenDistribution().sub(distributedTokens);
    }

    /**
     * @dev Distributes a specified amount of tokens to a given address.
     *
     * This function allows tokens to be minted and distributed to a specified address.
     * It can only be called by an account with the MPRO_MASTER_DISTRIBUTOR_ROLE.
     * The function performs several checks before proceeding with the distribution:
     * - It ensures that the amount to be distributed is greater than 0.
     * - It verifies that the current timestamp is greater than or equal to the distributionStartTimestamp,
     *   ensuring that the distribution period has started.
     * - It checks that the total amount of tokens to be distributed (including the current distribution)
     *   does not exceed the quantity available for distribution as determined by
     *   getAvailableForDistributionTokenQuantity.
     *
     * If all checks pass, the function increments the distributedTokens state variable by the amount
     * to be distributed and calls the mint function on the mproToken contract to mint the tokens
     * to the specified address.
     *
     * @param _to The address to which the tokens will be distributed.
     * @param _amount The amount of tokens to be distributed.
     */
    function distribute(
        address _to,
        uint256 _amount
    ) public onlyRole(MPRO_MASTER_DISTRIBUTOR_ROLE) {
        require(_amount > 0, "amount must be greater than 0");
        require(
            block.timestamp >= distributionStartTimestamp,
            "distribution has not started yet"
        );
        require(
            distributedTokens + _amount <=
                getAvailableForDistributionTokenQuantity(),
            "distributedTokens + _amount must be less than available for distribution token quantity"
        );
        distributedTokens += _amount;
        mproToken.mint(_to, _amount);
    }

    /**
     * @dev Distributes tokens to multiple addresses in bulk.
     *
     * This function allows for the bulk distribution of tokens to a list of addresses, each receiving
     * a specified amount. It is designed to efficiently handle multiple distributions in a single transaction.
     * The function can only be invoked by an account with the MPRO_MASTER_DISTRIBUTOR_ROLE.
     *
     * The function performs the following checks and operations:
     * - It ensures that the length of the `_to` address array matches the length of the `_amount` array,
     *   ensuring each address has a corresponding amount to be distributed.
     * - It then iterates over these arrays, calling the `distribute` function for each address-amount pair.
     *   The `distribute` function is responsible for the actual minting and transferring of tokens,
     *   as well as performing necessary checks such as ensuring the distribution period has started and
     *   that the total distributed amount does not exceed the available quantity.
     *
     * Note: This function relies on the `distribute` function for individual distributions and inherits
     * its checks and limitations. Each distribution in the loop is treated as a separate transaction in
     * terms of checks and effects.
     *
     * @param _to An array of addresses to which tokens will be distributed.
     * @param _amount An array of token amounts to be distributed to the respective addresses.
     */
    function distributeBulk(
        address[] memory _to,
        uint256[] memory _amount
    ) public onlyRole(MPRO_MASTER_DISTRIBUTOR_ROLE) {
        require(
            _to.length == _amount.length,
            "to and amount arrays must have the same length"
        );
        for (uint256 i = 0; i < _to.length; i++) {
            distribute(_to[i], _amount[i]);
        }
    }

    /**
     * @dev Sets the start time for token distribution.
     *
     * This external function allows an account with the OWNER_ROLE to set the start time for the
     * token distribution. It includes checks to ensure that the new start time is valid and within
     * the allowed range.
     *
     * The function performs the following validations:
     * - The proposed start time (`_startTime`) must be in the future, i.e., greater than the current
     *   block timestamp. This ensures that the distribution cannot be set to start in the past.
     * - The `_startTime` must also be less than or equal to `distributionStartTimestampDeadLine`,
     *   which is a predefined deadline for when distribution can start. This ensures that the
     *   distribution starts within the planned timeframe.
     *
     * If these conditions are met, the function updates `distributionStartTimestamp` with the new
     * start time, effectively scheduling the start of the token distribution process.
     *
     * @param _startTime The proposed start time for token distribution, specified as a timestamp.
     */
    function setDistributionStartTime(
        uint256 _startTime
    ) external onlyRole(OWNER_ROLE) {
        // Check if the startTime is greater than current time
        require(
            _startTime > block.timestamp,
            "startTime must be greater than current time"
        );
        require(
            _startTime <= distributionStartTimestampDeadLine,
            "startTime must be less than distributionStartTimeDeadline"
        );

        distributionStartTimestamp = _startTime;
    }

    /**
     * @dev Adds a new distribution reduction to the contract.
     *
     * This external function allows an account with the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE to add a
     * new distribution reduction. A distribution reduction is a record that signifies a change in the
     * distribution amount of tokens from a specific timestamp.
     *
     * The function includes a modifier `reductionEnabled` which likely contains logic to validate the
     * input parameters `_redutionTimestamp` and `_reductionAmount`. It ensures that the reduction
     * parameters meet certain criteria before allowing the addition of the new reduction.
     *
     * Once validated, the function appends a new `DistributionReduction` struct to the
     * `distributionReductions` array. This struct includes the timestamp from which the reduction
     * should take effect (`_redutionTimestamp`) and the new amount to be distributed from that
     * timestamp (`_reductionAmount`).
     *
     * @param _redutionTimestamp The timestamp from which the new distribution amount should apply.
     * @param _reductionAmount The new amount to be distributed from the specified timestamp.
     */
    function addDistributionReduction(
        uint256 _redutionTimestamp,
        uint256 _reductionAmount
    )
        external
        reductionEnabled(_redutionTimestamp, _reductionAmount)
        onlyRole(DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE)
    {
        distributionReductions.push(
            DistributionReduction(_redutionTimestamp, _reductionAmount)
        );
    }

    /**
     * @dev Sets the address of the MPRO token contract.
     *
     * This external function allows an account with the OWNER_ROLE to set or update the address of
     * the MPRO token contract. The function updates the `mproToken` state variable, which is expected
     * to be of type IMPROToken, an interface for the MPRO token.
     *
     * It is crucial to ensure that the provided `_mproTokenAddress` is correct and trustworthy, as
     * setting an incorrect or malicious address could have significant implications on the contract's
     * functionality and security. The function can only be executed by an account that has been
     * granted the OWNER_ROLE, ensuring that only authorized users can change the token address.
     *
     * @param _mproTokenAddress The address of the new MPRO token contract to be set. This address
     *                          should point to a contract that conforms to the IMPROToken interface.
     */
    function setMPROToken(
        address _mproTokenAddress
    ) external onlyRole(OWNER_ROLE) {
        mproToken = IMPROToken(_mproTokenAddress);
    }

    /**
     * @dev Calculates the amount to be burned based on the burn rate.
     *
     * This function calculates the amount of tokens that should be burned from a given transaction
     * amount, based on the current burn rate. The burn rate is applied unless the sender's address
     * is whitelisted, in which case no tokens are burned.
     *
     * The function performs the following operations:
     * - It checks if the sender (`_from`) is whitelisted using the `roleManagerContract.isWhitelisted`
     *   function. If the sender is whitelisted, the function returns 0, indicating no burn is applied.
     * - If the sender is not whitelisted, the function calculates the burn amount by applying the
     *   burn rate to the transaction amount (`_amount`). The burn rate is represented as a percentage
     *   scaled by a factor of 10000 (e.g., a burn rate of 10% is represented as 1000). The calculated
     *   burn amount is then returned.
     *
     * This mechanism allows for a dynamic burn policy where certain addresses can be exempted from
     * burning, potentially for promotional or operational purposes.
     *
     * @param _from The address from which the tokens are being transferred.
     * @param _amount The amount of tokens being transferred, from which the burn amount will be calculated.
     * @return The calculated amount of tokens to be burned.
     */
    function getBurnAmount(
        address _from,
        uint256 _amount
    ) external view returns (uint256) {
        // If the sender is whitelisted, no burn fee is applied
        if (roleManagerContract.isWhitelisted(_from)) {
            return 0;
        }
        return _amount.mul(burnRate).div(10000);
    }

    /**
     * @dev Sets the burn rate for the contract.
     *
     * This external function allows an account with the OWNER_ROLE to set the burn rate,
     * which is the percentage of the tokens that will be burned during certain operations.
     * The burn rate is expressed as a percentage with a precision of up to three decimal places.
     * For example, a burn rate of 1000 represents a 10% burn rate (1000 / 100 = 10%).
     *
     * A constraint is enforced to ensure that the burn rate does not exceed 10% (represented as 1000
     * in the contract). This safeguard prevents setting an excessively high burn rate that could
     * adversely impact the token economy or operations of the contract.
     *
     * It's critical to input the correct value for the burn rate as it directly affects the token
     * dynamics. Only authorized accounts with the OWNER_ROLE can perform this operation, ensuring
     * that the burn rate is controlled and updated responsibly.
     *
     * @param _burnFee The new burn rate to be set, scaled by a factor of 100. For example, to set a
     *                 burn rate of 1%, `_burnFee` should be 10.
     */
    function setBurnRate(uint256 _burnFee) external onlyRole(OWNER_ROLE) {
        require(_burnFee <= 1000, "burnFee must be less than or equal to 10%");
        burnRate = _burnFee;
    }

    /**
     * @dev Assigns the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER role to a specified address.
     *
     * This function is designed to manage role-based access control specifically for the
     * DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER. It allows an account with the OWNER_ROLE to
     * assign the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER role to a new address. This role is
     * likely to be associated with permissions to manage distribution timing and related parameters
     * in the contract.
     *
     * The OWNER_ROLE is required to execute this function, ensuring that only an authorized user can
     * change the role manager for distribution time administration. This helps maintain the security
     * and integrity of the role management system in the contract.
     *
     * @param _roleManagerAddress The address to which the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER
     *                            role will be granted. This address will then have the capabilities
     *                            associated with this role.
     */
    function setDistributorTimeAdministratorRoleManager(
        address _roleManagerAddress
    ) external onlyRole(OWNER_ROLE) {
        _grantRole(
            DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER,
            _roleManagerAddress
        );
    }

    /**
     * @dev Grants the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE to a specified address.
     *
     * This function enables an account with the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER role
     * to assign the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE to another address. The
     * DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE is likely associated with permissions to manage various
     * aspects of distribution timing within the contract.
     *
     * The function is protected by the `onlyRole` modifier, ensuring that only an account that has
     * been assigned the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER role can grant the
     * DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE. This access control mechanism helps maintain the
     * integrity and security of role assignments in the contract, allowing for controlled delegation
     * of responsibilities.
     *
     * @param _roleManagerAddress The address to which the DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE
     *                            will be granted. This address will be empowered with the
     *                            capabilities associated with managing distribution timing.
     */

    function setDistributorTimeAdministratorRole(
        address _roleManagerAddress
    ) external onlyRole(DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER) {
        _grantRole(DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE, _roleManagerAddress);
    }
}
