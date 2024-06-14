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

    function _mint(
        address account,
        uint256 amount
    ) internal virtual override(ERC20) {
        super._mint(account, amount);
    }
}
