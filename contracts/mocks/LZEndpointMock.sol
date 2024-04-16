// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
pragma abicoder v2;

import "@layerzerolabs/test-devtools-evm-hardhat/contracts/mocks/EndpointV2Mock.sol";

/*
like a real LayerZero endpoint but can be mocked, which handle message transmission, verification, and receipt.
- blocking: LayerZero provides ordered delivery of messages from a given sender to a destination chain.
- non-reentrancy: endpoint has a non-reentrancy guard for both the send() and receive(), respectively.
- adapter parameters: allows UAs to add arbitrary transaction params in the send() function, like airdrop on destination chain.
unlike a real LayerZero endpoint, it is
- no messaging library versioning
- send() will short circuit to lzReceive()
- no user application configuration
*/
contract LZMock is EndpointV2Mock {
    constructor(uint32 _eid) EndpointV2Mock(_eid) {}
}
