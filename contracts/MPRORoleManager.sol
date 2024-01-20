// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/AccessControl.sol";

// Dopisywanie do blocklist
// Dopisywanie do whitelist
// Grant i revoke role przez ownera

contract MPRORoleManager is AccessControl {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant LISTER_ROLE = keccak256("LISTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    /**
     * @dev Modifier to ensure that the provided address is not blocklisted.
     *
     * This modifier is used to validate that the `_account` address passed as an argument is not
     * blocklisted within the contract. Addresses that are blocklisted may have certain restrictions
     * or limitations imposed on them by the contract, and this modifier helps prevent blocklisted
     * addresses from participating in specific operations.
     *
     * If the `_account` address is blocklisted, the contract will revert with the message "Account is blocklisted."
     * If the address is not blocklisted, the modified function or operation is executed as intended.
     */
    modifier notBlocklisted(address _account) {
        require(!blocklisted[_account], "Account is blocklisted");
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
     * If the `_account` address is the zero address, the contract will revert with the error code "CB0."
     * If the address is valid (not zero), the modified function or operation is executed.
     */
    modifier notZeroAddress(address _account) {
        require(_account != address(0), "CB0");
        _;
    }

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
     * @dev Constructor function to initialize the contract with an initial owner.
     *
     * This constructor is called when the contract is deployed and initializes the contract with
     * an initial owner role. The owner role typically grants the highest level of control and
     * authority within the contract.
     *
     * The constructor takes one parameter:
     * - `_owner`: The address of the initial owner who will have the `OWNER_ROLE`.
     *
     * When the contract is deployed, this function sets up the `OWNER_ROLE` and assigns it to the
     * specified `_owner` address, granting them full control over the contract's functions.
     *
     * @param _owner The address of the initial owner who will have the `OWNER_ROLE`.
     */

    constructor(address _owner) {
        _setupRole(OWNER_ROLE, _owner);
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
        onlyRole(OWNER_ROLE)
        notBlocklisted(_account)
        notZeroAddress(_account)
    {
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
    ) public override onlyRole(OWNER_ROLE) notZeroAddress(_account) {
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
            isOwner(_account) ||
            isLister(_account) ||
            isPauser(_account) ||
            isDistributor(_account)
        ) {
            revert("account has a role and cannot be blocklisted");
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

    function isPauser(address _account) public view returns (bool) {
        return hasRole(PAUSER_ROLE, _account);
    }

    function isOwner(address _account) public view returns (bool) {
        return hasRole(OWNER_ROLE, _account);
    }

    function isDistributor(address _account) public view returns (bool) {
        return hasRole(DISTRIBUTOR_ROLE, _account);
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

    function isWhitelisted(address _account) external view returns (bool) {
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
    ) public view {
        require(
            !isBlocklisted(_from) &&
                !isBlocklisted(_to) &&
                !isBlocklisted(_msgSender),
            "Action on blocklisted account"
        );
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

    function approveAllowed(address _spender, address _msgSender) public view {
        require(
            !isBlocklisted(_spender) && !isBlocklisted(_msgSender),
            "Action on blocklisted account"
        );
    }
}
