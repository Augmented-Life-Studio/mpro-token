// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract XJAKANT is ERC20, Ownable {
    using SafeMath for uint256;

    constructor() ERC20("XJAKANT", "XJKT") {
        _mint(_msgSender(), 200000000 * (10 ** uint256(decimals())));
    }

    event AddToWhitelist(address indexed account);
    event RemoveFromWhitelist(address indexed account);
    event AddressTreasury(address indexed account);

    address public recipientFee;

    mapping(address => bool) public Whitelist;

    function addToWhitelist(address account) public onlyOwner {
        Whitelist[account] = true;
        emit AddToWhitelist(account);
    }

    function removeFromWhitelist(address account) public onlyOwner {
        Whitelist[account] = false;
        emit RemoveFromWhitelist(account);
    }

    function addressTreasury(address account) public onlyOwner {
        recipientFee = account;
        emit AddressTreasury(account);
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        if (Whitelist[_msgSender()] == false) {
            uint256 transferFee = amount.mul(9).div(1000);
            uint transferAmount = amount.sub(transferFee);
            _transfer(_msgSender(), recipient, transferAmount);
            _transfer(_msgSender(), recipientFee, transferFee);
        } else {
            _transfer(_msgSender(), recipient, amount);
        }
        return true;
    }
}
