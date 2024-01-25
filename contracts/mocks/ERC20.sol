// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WhoaToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        address _receiver
    ) ERC20(_name, _symbol) {
        _mint(_receiver, _initialSupply);
    }
}
