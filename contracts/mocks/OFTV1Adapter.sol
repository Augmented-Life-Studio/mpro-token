// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@layerzerolabs/solidity-examples/contracts/token/oft/V1/ProxyOFT.sol";

contract OFTV1Adapter is ProxyOFT {
    constructor(
        address _token, // a deployed, already existing ERC20 token address
        address _layerZeroEndpoint, // local endpoint address
        address _owner // token owner used as a delegate in LayerZero Endpoint
    ) ProxyOFT(_layerZeroEndpoint, _token) {
        _transferOwnership(_owner);
    }
}
