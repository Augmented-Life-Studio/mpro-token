//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "hardhat/console.sol";

contract Router {
    function WETH() external pure returns (address) {
        return address(0);
    }

    function getAmountsOut(
        uint amountIn,
        address[] memory path
    ) external pure returns (uint[] memory amounts) {
        require(path.length >= 2, "V2Liblary: INVALID_PATH");
        amounts = new uint[](path.length);
        amounts[0] = amountIn; // Amount of USDT
        amounts[path.length - 1] = 1000; // Amount of your token
        amounts[path.length - 1] = amountIn / 1000;
        return amounts;
    }
}
