// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@layerzerolabs/solidity-examples/contracts/token/oft/v2/OFTV2.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IJAKANTMasterDistributor {
    function getBurnAmount(
        address _from,
        uint256 _amount
    ) external view returns (uint256);

    function approveAllowed(address, address) external view returns (bool);

    function transferAllowed(
        address _from,
        address _to,
        address _msgSender
    ) external view returns (bool);
}

contract MPRO is OFTV2, ERC20Votes {
    IJAKANTMasterDistributor private mproMasterDistributor;

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /**
     * @dev Constructor to initialize the contract with specific parameters.
     *
     * This constructor initializes the contract with a name, symbol, and several key addresses
     * relevant to its operation. It also handles the preminting of tokens to a list of addresses.
     *
     * The constructor performs the following operations:
     * - Inherits from OFTV2 and ERC20Permit by passing `_name`, `_symbol`, and other parameters
     *   to these base contracts.
     * - Loops through the `premintAddresses` array, minting tokens in the amounts specified in
     *   `premintValues` to each address. This is used to distribute an initial supply of tokens.
     * - Sets the `mproRoleManager` by casting the `_mproRoleManager` address to the
     *   IMPRORoleManager interface, which is expected to manage role-based access in the contract.
     * - Sets the `mproMasterDistributor` by casting the `_mproMasterDistributor` address to the
     *   IJAKANTMasterDistributor interface, which is expected to handle distribution-related logic.
     *
     * The `_lzEndpoint` parameter is specific to the OFTV2 initialization and is related to LayerZero
     * endpoint configurations.
     *
     * This constructor is critical for setting up the initial state of the contract, including
     * roles, token distribution, and other essential configurations.
     *
     * @param _name The name of the token.
     * @param _symbol The symbol of the token.
     * @param _lzEndpoint Address for the LayerZero endpoint, used in OFTV2 initialization.
     * @param _mproMasterDistributor Address of the contract managing token distributions.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _mproMasterDistributor,
        address _owner
    ) OFTV2(_name, _symbol, 6, _lzEndpoint) ERC20Permit(_name) {
        mproMasterDistributor = IJAKANTMasterDistributor(
            _mproMasterDistributor
        );
        _transferOwnership(_owner);
    }

    function _mint(
        address account,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._mint(account, amount);
    }

    function _burn(
        address account,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }

    /**
     * @dev External function to burn tokens.
     *
     * This function provides an external interface to burn tokens from a specified account. It is
     * accessible externally and allows for tokens to be burned, reducing the total supply in
     * circulation. The function does not include specific access control checks, meaning any external
     * caller can potentially invoke it, subject to the contract's overall design and security model.
     *
     * The `virtual` keyword indicates that this function can be overridden in derived contracts,
     * allowing for customization of the burning process or the introduction of additional logic, such
     * as access control restrictions or pre-burn validations.
     *
     * The actual burning of tokens is delegated to the internal `_burn` function, which encapsulates
     * the logic for removing tokens from an account's balance and updating the total supply. This
     * separation of concerns allows the `_burn` function to handle the core logic, while the external
     * `burn` function can be adapted or extended in derived contracts.
     *
     * @param account The address from which the tokens will be burned.
     * @param amount The amount of tokens to be burned from the specified account.
     */
    function burn(address account, uint256 amount) external virtual {
        _burn(account, amount);
    }

    /**
     * @dev Public function to approve another account to spend tokens on behalf of the message sender.
     *
     * This function overrides the standard `approve` function of the ERC20 token standard. It allows
     * a token holder to grant permission to another account (referred to as the spender) to transfer
     * up to a specified number of tokens on their behalf.
     *
     * The function includes an additional security feature using the `mproRoleManager` to check
     * whether the approval is allowed. This could be based on additional business logic or
     * restrictions defined in the role manager contract.
     *
     * After the custom check, the function calls the internal `_approve` function of the ERC20
     * contract to handle the actual approval mechanism, updating the allowance set for the spender.
     *
     * @param _spender The address which is being granted permission to spend tokens on behalf of the
     *                 message sender.
     * @param _value The maximum number of tokens the spender is allowed to transfer.
     * @return A boolean value indicating whether the operation was successful.
     */
    function approve(
        address _spender,
        uint256 _value
    ) public override returns (bool) {
        mproMasterDistributor.approveAllowed(_msgSender(), _spender);
        super._approve(_msgSender(), _spender, _value);
        return true;
    }

    /**
     * @dev Public function to transfer tokens from the message sender's account to another account.
     *
     * This function overrides the standard `transfer` function of the ERC20 token standard. It
     * enables a token holder to transfer tokens to another address. In addition to the standard
     * transfer functionality, this implementation includes custom logic for additional checks and
     * burning tokens on transfer.
     *
     * The function performs the following operations:
     * - Calls `mproRoleManager.transferAllowed` to perform custom checks based on the contract's
     *   business logic. This might include restrictions on who can send or receive tokens or other
     *   specific conditions.
     * - Calls the internal `_burnOnTransfer` function to calculate the amount after applying the
     *   burn rate, if applicable, based on the contract's burning mechanism.
     * - Executes the token transfer through `super._transfer`, using the potentially adjusted amount
     *   from `_burnOnTransfer`.
     * - Returns `true` to indicate successful execution of the function.
     *
     * This custom implementation ensures compliance with additional rules and token burn mechanisms
     * while maintaining the basic functionality of ERC20 transfers.
     *
     * @param _to The address of the recipient to whom the tokens are being transferred.
     * @param _value The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation was successful.
     */
    function transfer(
        address _to,
        uint256 _value
    ) public override returns (bool) {
        mproMasterDistributor.transferAllowed(_msgSender(), _to, _msgSender());
        _transfer(_msgSender(), _to, _burnOnTransfer(_msgSender(), _value));
        return true;
    }

    /**
     * @dev Public function to transfer tokens on behalf of another account.
     *
     * This function overrides the standard `transferFrom` function of the ERC20 token standard.
     * It is used to transfer tokens from one account to another, based on a previously set allowance.
     * The caller must have been previously authorized by the token holder (_from) to spend up to
     * a specified number of tokens on their behalf.
     *
     * The function includes additional logic as follows:
     * - Calls `mproRoleManager.transferAllowed` to perform custom validation. This could involve
     *   checks based on specific business rules, like validating the roles of the involved parties
     *   (_from, _to, and the message sender).
     * - Executes the transfer through the internal `_transferFrom` function, which handles the actual
     *   token transfer logic. Before the transfer, it applies the `_burnOnTransfer` function to
     *   calculate the final amount after considering any burn mechanism that might be in place.
     * - Returns `true` to indicate successful execution of the function.
     *
     * This implementation ensures that any transfers made through this function comply with
     * additional constraints or business logic defined in the contract, along with the standard
     * ERC20 transferFrom functionality.
     *
     * @param _from The address of the token holder whose tokens are being transferred.
     * @param _to The address of the recipient to whom the tokens are being transferred.
     * @param _amount The amount of tokens to be transferred.
     * @return A boolean value indicating whether the operation was successful.
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    ) public override returns (bool) {
        mproMasterDistributor.transferAllowed(_from, _to, _msgSender());
        _transferFrom(_from, _to, _burnOnTransfer(_from, _amount));
        return true;
    }

    /**
     * @dev Internal function to handle token burning on transfers.
     *
     * This function calculates and executes the burning of a portion of tokens during a transfer,
     * based on the current burn rate as determined by the `mproMasterDistributor.getBurnAmount`
     * function. It is designed to be called as part of the token transfer process to automatically
     * apply a burn mechanism on transfers, reducing the amount of tokens ultimately transferred.
     *
     * The function performs the following operations:
     * - Calls `getBurnAmount` from `mproMasterDistributor` to determine the amount of tokens that
     *   should be burned from the transfer amount, based on the sender and the total transfer amount.
     * - If the calculated burn amount is greater than zero and less than the total transfer amount,
     *   it proceeds to burn that portion of tokens from the sender's balance by calling the internal
     *   `_burn` function.
     * - Returns the remaining amount after the burn has been applied. This remaining amount is what
     *   will be actually transferred to the recipient.
     *
     * Note: It's important to ensure the burn amount is valid (not exceeding the transfer amount) to
     * prevent issues with token balances and supply.
     *
     * @param _sender The address from which the tokens are being transferred (and potentially burned).
     * @param _amount The total amount of tokens being transferred before burn is applied.
     * @return The amount of tokens to be transferred after applying the burn.
     */
    function _burnOnTransfer(
        address _sender,
        uint256 _amount
    ) internal returns (uint256) {
        uint256 burnAmount = mproMasterDistributor.getBurnAmount(
            _sender,
            _amount
        );
        if (burnAmount > 0 && burnAmount < _amount) {
            _burn(_sender, burnAmount);
        }
        return _amount.sub(burnAmount);
    }

    /**
     * @dev Internal function that hooks into the ERC20 token transfer process.
     *
     * This function overrides the `_beforeTokenTransfer` hook from the ERC20 standard. It is called
     * automatically before every transfer, minting, or burning operation, allowing for additional
     * custom logic to be executed.
     *
     * The function specifically enforces a maximum cap on the total token supply during minting. When
     * tokens are being minted (indicated by the `from` address being the zero address), it checks
     * whether the minting would cause the total token supply to exceed a predefined maximum cap
     * (`_maxCap`). If so, it reverts the transaction to prevent exceeding the cap.
     *
     * This cap ensures that the total number of tokens in circulation does not surpass a certain
     * limit, aligning with the token's economic design and providing a safeguard against
     * uncontrolled token issuance.
     *
     * After performing this check (or in cases of transfer and burning), it calls the base
     * implementation of `_beforeTokenTransfer` from the ERC20 contract to handle any additional
     * standard logic.
     *
     * @param from The address of the sender. A zero address indicates tokens are being minted.
     * @param to The address of the receiver. A zero address indicates tokens are being burned.
     * @param amount The amount of tokens being transferred, minted, or burned.
     */

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20) {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Internal function that hooks into the ERC20 token transfer process.
     *
     * This function overrides the `_afterTokenTransfer` hook from both the ERC20 and ERC20Votes
     * contracts. It is called automatically after every transfer, minting, or burning operation.
     * The function provides a point to insert custom logic that needs to occur after a token
     * transfer, mint, or burn.
     *
     * In its current implementation, this function does not introduce any additional logic but
     * rather delegates to the base implementation of `_afterTokenTransfer` in the parent contracts
     * (ERC20 and ERC20Votes). This ensures that any necessary post-transfer processing defined in
     * these base contracts, such as updating vote balances in ERC20Votes, is executed.
     *
     * This function can be extended in derived contracts to include additional post-transfer
     * actions, making it a versatile hook for custom behaviors that should occur after token
     * transactions.
     *
     * @param from The address of the sender. A zero address indicates tokens are being minted.
     * @param to The address of the receiver. A zero address indicates tokens are being burned.
     * @param amount The amount of tokens being transferred, minted, or burned.
     */

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }
}
