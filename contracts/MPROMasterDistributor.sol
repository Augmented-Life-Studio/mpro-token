// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

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
contract MPROMasterDistributor is Context, AccessControl, Ownable {
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

    bytes32 public constant MPRO_MASTER_DISTRIBUTOR_ROLE =
        keccak256("MPRO_MASTER_DISTRIBUTOR_ROLE");
    bytes32 public constant DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE =
        keccak256("DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE");
    bytes32 public constant DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER =
        keccak256("DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER");
    bytes32 public constant LISTER_ROLE = keccak256("LISTER_ROLE");

    IMPROToken private mproToken;

    mapping(bytes32 => bool) private assignedRoles;

    /**
     * @dev Internal mapping to manage blocklisted addresses.
     *
     * This mapping associates addresses (keys) with boolean values to maintain a list of addresses
     * that are considered "blocklisted" within the contract's logic. If an address is included in
     * this mapping with a `true` value, it indicates that the address is blocklisted and may be
     * subject to certain restrictions or limitations imposed by the contract.
     *
     * The mapping is typically used in access control mechanisms and other parts of the contract's
     * logic to determine the behavior or privileges associated with addresses based on their
     * blocklist status.
     */
    mapping(address => bool) internal blocklisted;

    /**
     * @dev Internal mapping to manage whitelisted addresses.
     *
     * This mapping associates addresses (keys) with boolean values to maintain a list of addresses
     * that are considered "whitelisted" within the contract's logic. If an address is included in
     * this mapping with a `true` value, it indicates that the address is whitelisted and may have
     * special privileges or exemptions within the contract.
     *
     * The mapping is typically used in access control mechanisms and other parts of the contract's
     * logic to determine the behavior or privileges associated with addresses based on their
     * whitelist status.
     */
    mapping(address => bool) internal whitelisted;

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
    uint256 public distributionStartTimestamp;

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
    uint256 private constant initialDaylyDistribution = 250_000 * 10 ** 18;

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
    DistributionReduction[] private distributionReductions;

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

    event Distributed(address indexed _to, uint256 amount);
    event SetDistribiutionStartTime(uint256 _startTime);
    event AddDistributionReduction(
        uint256 _redutionTimestamp,
        uint256 _reductionAmount
    );
    event SetMPROToken(address _mproTokenAddress);
    event SetBurnRate(uint256 _burnRate);
    event SetDistributorTimeAdministratorRoleManager(
        address _roleManagerAddress
    );
    event SetDistributorTimeAdministratorRole(address _roleManagerAddress);

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
            _reductionTimestamp >
                lastReduction.reductionTimestamp + SECONDS_PER_DAY,
            "MPROMasterDistributor: New reduction start time cannot be lower than last redution timestamp + 1 day"
        );
        require(
            _reductionTimestamp >= lastReduction.reductionTimestamp + 183 days,
            "MPROMasterDistributor: New redution start time cannot be lower than 183 days after last redution timestamp"
        );
        require(
            _reductionAmount >= lastReduction.daylyDistribution.div(2),
            "MPROMasterDistributor: New reduction amount cannot be greater than half of the last reduction amount"
        );
        _;
    }

    /**
     * @dev Modifier to ensure that the provided address is not blocklisted.
     *
     * This modifier is used to validate that the `_account` address passed as an argument is not
     * blocklisted within the contract. Addresses that are blocklisted may have certain restrictions
     * or limitations imposed on them by the contract, and this modifier helps prevent blocklisted
     * addresses from participating in specific operations.
     *
     * If the `_account` address is blocklisted, the contract will revert with the message "Action on blocklisted account"
     * If the address is not blocklisted, the modified function or operation is executed as intended.
     */
    modifier notBlocklisted(address _account) {
        require(!blocklisted[_account], "Action on blocklisted account");
        _;
    }

    /**
     * @dev Modifier to ensure that the provided address is not the zero address.
     *
     * This modifier is used to validate that the `_account` address passed as an argument is not
     * equal to the zero address (`address(0)`). Preventing the zero address from being used in
     * certain contexts can help avoid unexpected behavior, as the zero address often has special
     * significance.
     *
     * If the `_account` address is the zero address, the contract will revert with the error code "Action on address zero"
     * If the address is valid (not zero), the modified function or operation is executed.
     */
    modifier notZeroAddress(address _account) {
        require(_account != address(0), "Action on address zero");
        _;
    }

    /**
     * @dev Constructor for initializing the contract with specific parameters.
     *
     * This constructor is responsible for setting up the initial state of the contract, including
     * the assignment of the owner role and configuring the role management contract. It also initializes
     * the timestamps for the start and deadline of the distribution period.
     *
     * @param _owner The address that will be granted the owner role. This address will have
     *               administrative control over certain functions of the contract, typically including
     *               key management and operational parameters.
     */
    constructor(address _owner) {
        // Set the distribution start timestamp to 14 days from the current block time.
        // This delay allows for a preparation period before the distribution begins.
        distributionStartTimestamp = block.timestamp + 14 days;
        // Set the deadline for the distribution period to 30 days from the current block time.
        // This sets a finite period for the distribution process, ensuring a clear end date.
        distributionStartTimestampDeadLine = block.timestamp + 30 days;
        // Assign the OWNER_ROLE to the provided owner address. This role typically includes
        // elevated privileges and is crucial for contract administration and oversight.
        _transferOwnership(_owner);
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
            if (daysElapsed >= daysElapsedToReduction) {
                // Days in current period
                uint256 daysInCurrentPeriod = daysElapsed -
                    daysElapsedToReduction;
                totalDistribution +=
                    distributionReduction.daylyDistribution +
                    (daysInCurrentPeriod *
                        distributionReduction.daylyDistribution);
                // Update daysElapsed for previous period
                daysElapsed = daysElapsedToReduction;
            }
        }
        // Remaining days are in the first period
        totalDistribution +=
            initialDaylyDistribution +
            (daysElapsed * initialDaylyDistribution);

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
            "MPROMasterDistributor: Minting is not enabled yet"
        );
        require(
            _amount <= getAvailableForDistributionTokenQuantity(),
            "MPROMasterDistributor: Minting limit exceeded"
        );
        distributedTokens += _amount;
        mproToken.mint(_to, _amount);

        emit Distributed(_to, _amount);
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
    function setDistributionStartTime(uint256 _startTime) external onlyOwner {
        require(
            _startTime > block.timestamp,
            "MPROMasterDistributor: Distribution start time cannot be lower than current time"
        );
        require(
            _startTime <= distributionStartTimestampDeadLine,
            "MPROMasterDistributor: Distribution start time must be less than distributionStartTimeDeadline"
        );

        distributionStartTimestamp = _startTime;

        emit SetDistribiutionStartTime(_startTime);
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
        onlyRole(DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE)
        reductionEnabled(_redutionTimestamp, _reductionAmount)
    {
        distributionReductions.push(
            DistributionReduction(_redutionTimestamp, _reductionAmount)
        );

        emit AddDistributionReduction(_redutionTimestamp, _reductionAmount);
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
    function setMPROToken(address _mproTokenAddress) external onlyOwner {
        mproToken = IMPROToken(_mproTokenAddress);
        emit SetMPROToken(_mproTokenAddress);
    }

    /**
     * @dev Calculates the amount to be burned based on the burn rate.
     *
     * This function calculates the amount of tokens that should be burned from a given transaction
     * amount, based on the current burn rate. The burn rate is applied unless the sender's address
     * is whitelisted, in which case no tokens are burned.
     *
     * The function performs the following operations:
     * - It checks if the sender (`_from`) is whitelisted using the `mproRoleManager.isWhitelisted`
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
        if (isWhitelisted(_from)) {
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
     * @param _burnRate The new burn rate to be set, scaled by a factor of 100. For example, to set a
     *                 burn rate of 1%, `_burnFee` should be 10.
     */
    function setBurnRate(uint256 _burnRate) external onlyOwner {
        require(
            _burnRate <= 1000,
            "MPROMasterDistributor: Burn rate cannot be greater than or equal to 10%"
        );
        burnRate = _burnRate;
        emit SetBurnRate(_burnRate);
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
    ) external onlyOwner {
        _grantRole(
            DISTRIBUTIONS_TIME_ADMINISTRATOR_ROLE_MANAGER,
            _roleManagerAddress
        );
        emit SetDistributorTimeAdministratorRoleManager(_roleManagerAddress);
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
        emit SetDistributorTimeAdministratorRole(_roleManagerAddress);
    }

    /**
     * @dev Public function to grant a specific role to an account.
     *
     * This function allows an address with the `OWNER_ROLE` to grant a specific role to the `_account`
     * address. Roles define different sets of permissions or responsibilities within the contract,
     * and granting a role to an account assigns those associated privileges.
     *
     * The function takes two parameters:
     * - `role`: The bytes32 identifier of the role to be granted.
     * - `_account`: The address to which the role is to be granted.
     *
     * Access to this function is restricted to addresses with the `OWNER_ROLE`, ensuring that only
     * contract owners or administrators can grant roles.
     *
     * Before granting the role, the function performs the following checks:
     * - Ensures that the `_account` address is not blocklisted, preventing blocklisted accounts
     *   from receiving roles.
     * - Verifies that the `_account` address is not the zero address (`address(0)`) to prevent
     *   accidental modifications of the zero address, which may have special significance.
     *
     * @param role The bytes32 identifier of the role to be granted.
     * @param _account The address to which the role is to be granted.
     *
     * Requirements:
     * - The `_account` address must not be blocklisted, and it must not be the zero address (`address(0)`).
     *   This ensures that roles are granted to valid, non-blocklisted addresses.
     */

    function grantRole(
        bytes32 role,
        address _account
    )
        public
        virtual
        override
        onlyOwner
        notBlocklisted(_account)
        notZeroAddress(_account)
    {
        if (assignedRoles[role]) {
            revert("Role already granted to another account");
        }
        assignedRoles[role] = true;
        _grantRole(role, _account);
    }

    /**
     * @dev Public function to revoke a specific role from an account.
     *
     * This function allows an address with the `OWNER_ROLE` to revoke a specific role from the
     * `_account` address. Roles define different sets of permissions or responsibilities within the
     * contract, and revoking a role from an account effectively removes those associated privileges.
     *
     * The function takes two parameters:
     * - `role`: The bytes32 identifier of the role to be revoked.
     * - `_account`: The address from which the role is to be revoked.
     *
     * Access to this function is restricted to addresses with the `OWNER_ROLE`, ensuring that only
     * contract owners or administrators can revoke roles.
     *
     * Before revoking the role, the function checks that the `_account` address is not the zero
     * address (`address(0)`) to prevent accidental modifications of the zero address, which may
     * have special significance.
     *
     * @param role The bytes32 identifier of the role to be revoked.
     * @param _account The address from which the role is to be revoked.
     *
     * Requirements:
     * - The `_account` address must not be the zero address (`address(0)`).
     *   This prevents accidentally modifying the zero address, which may have special significance.
     */

    function revokeRole(
        bytes32 role,
        address _account
    ) public override onlyOwner notZeroAddress(_account) {
        require(hasRole(role, _account), "Account does not have role");
        assignedRoles[role] = false;
        _revokeRole(role, _account);
    }

    /**
     * @dev External function to blocklist or unblocklist an account.
     *
     * This function allows an address with the `LISTER_ROLE` to either blocklist or remove an account
     * from the contract's blocklist. Blocklisting an account may restrict it from performing certain
     * operations or participating in specific aspects of the contract, as defined by the contract's
     * logic.
     *
     * The function takes two parameters:
     * - `_account`: The address to be either blocklisted or unblocklisted.
     * - `_blocklist`: A boolean indicating whether to blocklist (`true`) or unblocklist (`false`)
     *   the account.
     *
     * Before modifying the blocklist status, the function checks if the specified `_account` address
     * holds any other roles within the contract (owner, lister, pauser, distributor). If the account
     * has any of these roles, the function reverts to prevent the blocklisting of accounts with
     * roles.
     *
     * Access to this function is restricted to addresses with the `LISTER_ROLE`, ensuring that only
     * authorized entities can modify the blocklist.
     *
     * @param _account The address to be blocklisted or unblocklisted.
     * @param _blocklist A boolean indicating whether to blocklist or unblocklist the account.
     *
     * Requirements:
     * - The `_account` address must not be the zero address (`address(0)`).
     *   This prevents accidentally modifying the zero address, which may have special significance.
     * - The `_account` address must not have any other roles (owner, lister, pauser, distributor).
     *   Accounts with these roles cannot be blocklisted.
     */

    function blocklist(
        address _account,
        bool _blocklist
    ) external onlyRole(LISTER_ROLE) notZeroAddress(_account) {
        if (
            this.owner() == _account ||
            isLister(_account) ||
            isDistributor(_account)
        ) {
            revert("Account has a role and cannot be blocklisted");
        }
        blocklisted[_account] = _blocklist;
    }

    /**
     * @dev External function to whitelist or unwhitelist an account.
     *
     * This function allows an address with the `LISTER_ROLE` to either whitelist or remove an account
     * from the contract's whitelist. Whitelisting typically grants certain privileges or exemptions
     * to the whitelisted account, while removing an account from the whitelist revokes these
     * privileges.
     *
     * The function takes two parameters:
     * - `_account`: The address to be either whitelisted or removed from the whitelist.
     * - `_whitelist`: A boolean indicating whether to whitelist (`true`) or unwhitelist (`false`)
     *   the account.
     *
     * The function sets the whitelisting status of the specified account by updating the `whitelisted`
     * mapping accordingly.
     *
     * Access to this function is restricted to addresses with the `LISTER_ROLE`, ensuring that only
     * authorized entities can modify the whitelist.
     *
     * @param _account The address to be whitelisted or unwhitelisted.
     * @param _whitelist A boolean indicating whether to whitelist or unwhitelist the account.
     *
     * Requirements:
     * - The `_account` address must not be the zero address (`address(0)`).
     *   This prevents accidentally modifying the zero address, which may have special significance.
     */

    function whitelist(
        address _account,
        bool _whitelist
    ) external onlyRole(LISTER_ROLE) notZeroAddress(_account) {
        whitelisted[_account] = _whitelist;
    }

    function isLister(address _account) public view returns (bool) {
        return hasRole(LISTER_ROLE, _account);
    }

    function isDistributor(address _address) public view returns (bool) {
        return hasRole(MPRO_MASTER_DISTRIBUTOR_ROLE, _address);
    }

    /**
     * @dev Public view function to check if an account is blocklisted.
     *
     * This function allows anyone to determine if a specific account is included in the contract's
     * blocklist. An account that is blocklisted may be restricted from performing certain operations
     * or participating in specific aspects of the contract, as defined by the contract's logic.
     *
     * The function checks the `blocklisted` mapping to see if the provided `_account` address is
     * marked as blocklisted, returning a boolean value indicating the blocklist status.
     *
     * Being a `view` function, it only reads the blocklist status from the contract's state and
     * does not modify the contract. This function is typically used in access control mechanisms
     * where actions are conditional based on whether an account is blocklisted.
     *
     * @param _account The address to be checked for blocklist status.
     * @return `true` if the account is blocklisted, `false` otherwise.
     */

    function isBlocklisted(address _account) public view returns (bool) {
        return blocklisted[_account];
    }

    /**
     * @dev External view function to check if an account is whitelisted.
     *
     * This function is accessible externally and is used to determine if a specific account is
     * included in the whitelist of the contract. Whitelisted accounts often have certain privileges
     * or are exempt from various restrictions that apply to other users.
     *
     * The function's logic is as follows:
     * - If the provided `_account` address is the zero address (`address(0)`), the function
     *   returns `true`. This implies a default allowance or special treatment for the zero address
     *   in certain contexts.
     * - For any other address, it checks the `whitelisted` mapping to see if the address is
     *   marked as whitelisted, returning a boolean value that indicates the status.
     *
     * Being a `view` function, it does not modify the state of the contract but simply reads and
     * returns the whitelisting status. It is typically used in access control checks, where
     * different actions or permissions are granted based on the user's whitelist status.
     *
     * @param _account The address to be checked for its whitelisted status.
     * @return `true` if the account is whitelisted, `false` otherwise.
     */

    function isWhitelisted(address _account) private view returns (bool) {
        if (_account == address(0)) {
            return true;
        }
        return whitelisted[_account];
    }

    function mintAllowed(address _minter) external view returns (bool) {
        require(_minter == address(this), "Distributor only");
        return true;
    }

    /**
     * @dev Public view function to check if a token transfer is allowed.
     *
     * This function is used to enforce restrictions on token transfers based on blocklist criteria.
     * It checks whether any of the involved parties in a token transfer (the sender, receiver, and
     * the caller of the function) are on a blocklist. If any of these addresses are blocklisted, the
     * function reverts the transaction, preventing the transfer.
     *
     * Being a `view` function, it does not modify the state of the blockchain but reads from it.
     * This function can be integrated into the token transfer process to add an additional layer of
     * security and compliance, ensuring that tokens cannot be transferred by or to blocklisted
     * addresses.
     *
     * @param _from The address attempting to send tokens.
     * @param _to The address intended to receive the tokens.
     * @param _msgSender The address initiating the transfer request.
     *
     * Requirements:
     * - None of the involved addresses (_from, _to, and _msgSender) can be on the blocklist.
     *   If any are blocklisted, the function reverts with an error message.
     */

    function transferAllowed(
        address _from,
        address _to,
        address _msgSender
    ) external view returns (bool) {
        require(
            !isBlocklisted(_from) &&
                !isBlocklisted(_to) &&
                !isBlocklisted(_msgSender),
            "Action on blocklisted account"
        );

        return true;
    }

    /**
     * @dev Public view function to check if token approval is allowed.
     *
     * This function is used to enforce restrictions on token approvals based on blocklist criteria.
     * It checks whether the spender or the caller of the function (message sender) are on a
     * blocklist. If either of these addresses are blocklisted, the function reverts the transaction,
     * preventing the approval operation.
     *
     * This check is crucial in scenarios where blocklisted addresses should not be permitted to
     * interact with the token, including being approved to spend tokens on behalf of others. By
     * incorporating this function into the approval process, the contract adds an additional layer
     * of security and regulatory compliance.
     *
     * Being a `view` function, `approveAllowed` does not alter the state of the blockchain but
     * reads from it to ensure compliance with the blocklist rules before any approval is granted.
     *
     * @param _spender The address being granted permission to spend tokens.
     * @param _msgSender The address initiating the approval request.
     *
     * Requirements:
     * - Neither the spender (_spender) nor the initiator of the approval (_msgSender) can be
     *   on the blocklist. If any of them are blocklisted, the function reverts with an error message.
     */

    function approveAllowed(
        address _spender,
        address _msgSender
    ) external view returns (bool) {
        require(
            !isBlocklisted(_spender) && !isBlocklisted(_msgSender),
            "Action on blocklisted account"
        );

        return true;
    }

    function getDistributionReductions()
        external
        view
        returns (DistributionReduction[] memory)
    {
        return distributionReductions;
    }
}
