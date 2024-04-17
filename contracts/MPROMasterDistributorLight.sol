// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title MPRO Master Distributor Contract Light
 * @dev The MPROMasterDistributor contract manages distributions logic.
 * It is responsible for managing rules as burn rate, blocklist, and whitelist.
 * configurations. This contract utilizes the AccessControl feature for role-based access control.
 *
 * This contract extends the Context and AccessControl contracts to leverage their functionality.
 * Role-based access control allows specific roles to perform authorized actions within the contract,
 * ensuring proper governance and security.
 */
contract MPROMasterDistributor is Context, AccessControl, Ownable {
    using SafeMath for uint256;

    bytes32 public constant LISTER_ROLE = keccak256("LISTER_ROLE");

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

    event SetBurnRate(uint256 _burnRate);

    /**
     * @dev Modifier to ensure that the provided address is not blocklisted.
     *
     * This modifier is used to validate that the `_account` address passed as an argument is not
     * blocklisted within the contract. Addresses that are blocklisted may have certain restrictions
     * or limitations imposed on them by the contract, and this modifier helps prevent blocklisted
     * addresses from participating in specific operations.
     *
     * If the `_account` address is blocklisted, the contract will revert with the message "MPROMasterDistributor: Action on blocklisted account"
     * If the address is not blocklisted, the modified function or operation is executed as intended.
     */
    modifier notBlocklisted(address _account) {
        require(
            !blocklisted[_account],
            "MPROMasterDistributor: Action on blocklisted account"
        );
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
        require(
            _account != address(0),
            "MPROMasterDistributor: Action on address zero"
        );
        _;
    }

    /**
     * @dev Modifier that ensures a role has not already been assigned to an account. This modifier checks
     * the status of a role in the `assignedRoles` mapping. If the role has already been granted (i.e., the
     * corresponding value in the mapping is `true`), the function call is reverted with an error message.
     * This is used to prevent roles from being granted to more than one account, ensuring unique assignment
     * of responsibilities or permissions within the contract.
     *
     * @param _role The bytes32 identifier of the role to check.
     */
    modifier notGranted(bytes32 _role) {
        require(
            !assignedRoles[_role],
            "MPROMasterDistributor: Role already granted to another account"
        );
        _;
    }

    /**
     * @dev Modifier that checks if a role has not been marked as burned. A role is considered burned if
     * it has been explicitly revoked and cannot be reassigned. This is typically done by assigning the role
     * to the zero address. The modifier uses the `hasRole` function to check the status of the role.
     * If the role is found to be assigned to the zero address, indicating that it has been burned, the
     * function call is reverted with an error message. This prevents operations on roles that are meant to
     * be permanently inactive or revoked.
     *
     * @param _role The bytes32 identifier of the role to check.
     */
    modifier notBurned(bytes32 _role) {
        require(
            !hasRole(_role, address(0)),
            "MPROMasterDistributor: Role is already burned"
        );
        _;
    }

    /**
     * @dev Constructor for the contract. Initializes the contract by setting the distribution start timestamp,
     * the distribution deadline, and assigning the OWNER_ROLE to the provided owner address. The distribution
     * start timestamp is set to 14 days from the current block time, providing a preparation period before the
     * distribution begins. The distribution deadline is set to 30 days from the current block time, creating a
     * finite period for the distribution process. The OWNER_ROLE is crucial for contract administration and
     * oversight, allowing the owner to manage the contract's key operations.
     *
     * @param _owner The address that will be assigned the OWNER_ROLE, granting administrative control over the contract.
     */
    constructor(address _owner) {
        // Assign the OWNER_ROLE to the provided owner address. This role typically includes
        // elevated privileges and is crucial for contract administration and oversight.
        _transferOwnership(_owner);
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
     * @dev Public function to grant a specific role to an account.
     *
     * This function allows the contract owner to grant a specific role to the `_account` address. Roles
     * are used to define permissions and responsibilities within the contract, and granting a role confers
     * those associated privileges to the specified account.
     *
     * The function takes two parameters:
     * - `_role`: The bytes32 identifier of the role to be granted.
     * - `_account`: The address to which the role is to be granted.
     *
     * As a safeguard, the function enforces several preconditions before granting the role:
     * - Ensures that the `_account` address is not blocklisted, maintaining the security and integrity
     *   of the contract by preventing potentially malicious entities from gaining privileged access.
     * - Checks that the `_account` address is not the zero address (`address(0)`), avoiding unintentional
     *   role assignments to an address that may have special significance or represent "no address".
     * - Verifies that the role has not already been burned, ensuring that only active, valid roles are
     *   assignable.
     * - Confirms that the role has not already been granted, upholding the principle of unique role assignments.
     *
     * This function can only be called by the contract owner, ensuring that role management is kept under
     * tight control and preventing unauthorized role assignments.
     *
     * @param _role The bytes32 identifier of the role to be granted.
     * @param _account The address to which the role is to be granted.
     *
     * Requirements:
     * - The contract caller must be the contract owner.
     * - The `_account` must not be blocklisted or the zero address.
     * - The `_role` must not be burned or already granted.
     */
    function grantRole(
        bytes32 _role,
        address _account
    )
        public
        virtual
        override
        onlyOwner
        notBlocklisted(_account)
        notZeroAddress(_account)
        notBurned(_role)
        notGranted(_role)
    {
        assignedRoles[_role] = true;
        _grantRole(_role, _account);
    }

    /**
     * @dev Public function to revoke a specific role from an account.
     *
     * This function allows the contract owner to remove a previously granted role from the `_account` address.
     * Roles are crucial for defining permissions and responsibilities within the contract, and revoking a role
     * removes those associated privileges from the specified account.
     *
     * The function takes two parameters:
     * - `_role`: The bytes32 identifier of the role to be revoked.
     * - `_account`: The address from which the role is to be removed.
     *
     * Before revoking the role, the function performs the following checks:
     * - Verifies that the `_account` address is not the zero address (`address(0)`) to prevent accidental
     *   modifications of the zero address, which may have special significance.
     * - Ensures that the `_account` currently has the role to be revoked, providing a safeguard against
     *   unnecessary or mistaken revocations.
     *
     * Access to this function is restricted to addresses with the `OWNER_ROLE`, ensuring that only contract
     * owners or administrators can revoke roles. Upon successful revocation of the role, the function updates
     * the `assignedRoles` mapping and calls the internal `_revokeRole` function.
     *
     * @param _role The bytes32 identifier of the role to be revoked.
     * @param _account The address from which the role is to be removed.
     *
     * Requirements:
     * - The `_account` address must not be the zero address (`address(0)`).
     * - The `_account` must currently have the role that is being revoked.
     */
    function revokeRole(
        bytes32 _role,
        address _account
    ) public override onlyOwner notZeroAddress(_account) {
        require(
            hasRole(_role, _account),
            "MPROMasterDistributor: Account does not have role"
        );
        assignedRoles[_role] = false;
        _revokeRole(_role, _account);
    }

    /**
     * @dev Public function for an account to renounce a specific role it possesses.
     *
     * This function allows an account to voluntarily renounce a role it holds, effectively removing the
     * associated permissions and responsibilities. It's a self-initiated action, meaning an account can
     * only renounce roles that it possesses for itself, enhancing the security by preventing external
     * entities from forcibly removing roles.
     *
     * The function takes two parameters:
     * - `_role`: The bytes32 identifier of the role to be renounced.
     * - `_account`: The address of the account renouncing the role. To ensure security and prevent
     *   unintended renunciations, the function checks that `_account` is the same as `_msgSender()`.
     *
     * Before allowing the role to be renounced, the function performs the following check:
     * - Verifies that the `_account` address is not the zero address (`address(0)`) to prevent
     *   accidental modifications of the zero address, which may have special significance.
     *
     * Upon successfully renouncing the role, the function updates the `assignedRoles` mapping and
     * calls the internal `_revokeRole` function to formally remove the role.
     *
     * @param _role The bytes32 identifier of the role to be renounced.
     * @param _account The address of the account renouncing the role.
     *
     * Requirements:
     * - The `_account` address must not be the zero address (`address(0)`).
     * - The `_account` must be the same as `_msgSender()`, ensuring that accounts can only renounce
     *   roles for themselves.
     */
    function renounceRole(
        bytes32 _role,
        address _account
    ) public override notZeroAddress(_account) {
        require(
            _account == _msgSender(),
            "AccessControl: can only renounce roles for self"
        );
        require(
            hasRole(_role, _account),
            "MPROMasterDistributor: Account does not have role"
        );
        assignedRoles[_role] = false;
        _revokeRole(_role, _account);
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
        if (this.owner() == _account || isLister(_account)) {
            revert(
                "MPROMasterDistributor: Account has a role and cannot be blocklisted"
            );
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

    /**
     * @dev Public view function to check if an account has the LISTER_ROLE.
     *
     * This function provides a convenient way to verify if a specific account has been granted the LISTER_ROLE
     * within the contract. The LISTER_ROLE is typically associated with permissions to list items or manage
     * lists within the contract's ecosystem.
     *
     * The function takes a single parameter:
     * - `_account`: The address of the account to check for the LISTER_ROLE.
     *
     * It returns a boolean value indicating whether the specified account has the LISTER_ROLE. This can be
     * particularly useful for front-end interfaces or other contract interactions that require a quick check
     * of an account's roles or permissions.
     *
     * @param _account The address of the account to check for the LISTER_ROLE.
     * @return A boolean value indicating whether the specified account has the LISTER_ROLE.
     */
    function isLister(address _account) public view returns (bool) {
        return hasRole(LISTER_ROLE, _account);
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
            "MPROMasterDistributor: Action on blocklisted account"
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
            "MPROMasterDistributor: Action on blocklisted account"
        );

        return true;
    }
}
