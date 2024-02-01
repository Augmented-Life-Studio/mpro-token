// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract JAKPUMPKIN is ERC20 {
    using SafeMath for uint256;

    constructor() ERC20("JAKPUMPKIN", "JKP") {
        _mint(msg.sender, 1190 * (10 ** uint256(decimals())));
    }

    function transfer(
        address to,
        uint256 amount
    ) public override returns (bool) {
        return super.transfer(to, _partialBurn(amount));
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        return
            super.transferFrom(
                from,
                to,
                _partialBurnTransferFrom(from, amount)
            );
    }

    function _partialBurn(uint256 amount) internal returns (uint256) {
        uint256 burnAmount = amount.div(10);

        if (burnAmount > 0) {
            _burn(msg.sender, burnAmount);
        }

        return amount.sub(burnAmount);
    }

    function _partialBurnTransferFrom(
        address _originalSender,
        uint256 amount
    ) internal returns (uint256) {
        uint256 burnAmount = amount.div(10);

        if (burnAmount > 0) {
            _burn(_originalSender, burnAmount);
        }

        return amount.sub(burnAmount);
    }
}
