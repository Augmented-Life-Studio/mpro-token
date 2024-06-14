// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";

contract OFTV2 is OFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _owner
    ) OFT(_name, _symbol, _lzEndpoint, _owner) {
        _transferOwnership(_owner);
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
