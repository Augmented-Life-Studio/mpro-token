// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract MPROStake {
    struct Staker {
        uint256 staked;
        uint256 lastUpdatedAt;
        uint256 balanceToClaim;
        uint256 claimedBalance;
        uint256 reward;
    }
    // Stakers
    mapping(address => Staker) public staker;

    function transferStake(address _stakeAddress) external {
        // require NextStake(_stakeAddress).moveToStake(msg.sender) to not be reverted
        (
            bool _success,
            string memory _message,
            uint256 _stakeAmount
        ) = NextStake(_stakeAddress).moveToStake(msg.sender);
        console.log("Success: %s", _success, _message, _stakeAmount);
        if (_success) {
            staker[msg.sender].staked += _stakeAmount;
            staker[msg.sender].lastUpdatedAt = block.timestamp;
        } else {
            revert(_message);
        }
    }
}

interface NextStake {
    function moveToStake(
        address _stakerAddress
    ) external returns (bool, string memory, uint256);
}
