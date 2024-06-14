// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OFTPlainToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    ) ERC20(_name, _symbol) {
        _mint(_owner, 1000000000000000000000000);
    }

    function mint(address account, uint256 amount) public {
        require(
            amount <= 1000000000000000000000000,
            "Maximum mint amount exceeded - max 1,000,000 OFT"
        );
        _mint(account, amount);
    }
}
