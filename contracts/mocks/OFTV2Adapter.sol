// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTAdapter.sol";

contract OFTV2Adapter is OFTAdapter {
    constructor(
        address _token, // a deployed, already existing ERC20 token address
        address _layerZeroEndpoint, // local endpoint address
        address _owner // token owner used as a delegate in LayerZero Endpoint
    ) OFTAdapter(_token, _layerZeroEndpoint, _owner) {
        _transferOwnership(_owner);
    }
}
