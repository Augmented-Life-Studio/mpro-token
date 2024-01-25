// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MPROVesting is Context, Ownable {
    using SafeMath for uint256;

    uint256 public constant UNLOCK_PERCENT_DIVIDER = 10000;
    struct VestingBeneficiary {
        uint256 amount;
        uint256 claimed;
    }

    address public immutable token;

    mapping(address => VestingBeneficiary) private vestingBeneficiaries;
    uint256 private immutable tgeUnlockTimestampDeadline;
    uint256 public immutable tgeUnlockTimestamp;
    uint256 public immutable tgeUnlockPercent;

    uint256 public immutable cliffTimestamp;

    uint256 public immutable vestingUnlockPercentPerPeriod;
    uint256 public immutable vestingPeriodDuration;

    modifier onlyBeneficiary(address _account) {
        require(
            vestingBeneficiaries[_account].amount > 0,
            "MPROVesting: Account is not a beneficiary"
        );
        _;
    }

    constructor(
        address _token,
        uint256 _tgeUnlockTimestamp,
        uint256 _tgeUnlockPercent,
        uint256 _cliffDelay,
        uint256 _vestingUnlockPercentPerPeriod,
        uint256 _vestingPeriodDuration,
        address _newOwner
    ) {
        token = _token;
        tgeUnlockTimestampDeadline = _tgeUnlockTimestamp + 30 days;
        tgeUnlockTimestamp = _tgeUnlockTimestamp;
        tgeUnlockPercent = _tgeUnlockPercent;
        cliffTimestamp = tgeUnlockTimestamp + _cliffDelay;
        vestingUnlockPercentPerPeriod = _vestingUnlockPercentPerPeriod;
        vestingPeriodDuration = _vestingPeriodDuration;
        _transferOwnership(_newOwner);
    }

    /**
     * @dev The contract should be able to receive Eth.
     */
    receive() external payable virtual {}

    function registerBeneficiaries(
        address[] memory _beneficiaries,
        uint256[] memory _amounts
    ) external virtual onlyOwner {
        require(
            _beneficiaries.length == _amounts.length,
            "Vesting: Invalid input lengths"
        );
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            if (_beneficiaries[i] == address(0)) {
                revert("Vesting: Invalid beneficiary");
            }
            if (vestingBeneficiaries[_beneficiaries[i]].amount > 0) {
                vestingBeneficiaries[_beneficiaries[i]].amount = _amounts[i];
            } else {
                vestingBeneficiaries[_beneficiaries[i]] = VestingBeneficiary(
                    _amounts[i],
                    0
                );
            }
        }
    }

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function claimBalance()
        public
        view
        virtual
        onlyBeneficiary(_msgSender())
        returns (uint256)
    {
        return
            vestingBeneficiaries[_msgSender()].amount -
            vestingBeneficiaries[_msgSender()].claimed;
    }

    function claimed()
        public
        view
        virtual
        onlyBeneficiary(_msgSender())
        returns (uint256)
    {
        return vestingBeneficiaries[_msgSender()].claimed;
    }

    function enableForRelease(
        address _beneficiary
    ) public view returns (uint256) {
        VestingBeneficiary memory beneficiary = vestingBeneficiaries[
            _beneficiary
        ];
        if (block.timestamp < tgeUnlockTimestamp) {
            return 0;
        }
        uint256 totalTokens = beneficiary.amount;
        uint256 claimableTgaTokens = totalTokens.mul(tgeUnlockPercent).div(
            UNLOCK_PERCENT_DIVIDER
        );
        if (
            block.timestamp >= tgeUnlockTimestamp &&
            block.timestamp < cliffTimestamp
        ) {
            return claimableTgaTokens - beneficiary.claimed;
        } else if (block.timestamp >= cliffTimestamp) {
            uint256 vestingCircles = block.timestamp.sub(cliffTimestamp).div(
                vestingPeriodDuration
            );
            uint256 percentFromVesting = vestingUnlockPercentPerPeriod.add(
                vestingCircles.mul(vestingUnlockPercentPerPeriod)
            );

            uint256 vestingTokens = totalTokens.mul(percentFromVesting).div(
                UNLOCK_PERCENT_DIVIDER
            );
            uint256 totalLinearTokens = claimableTgaTokens.add(vestingTokens);
            if (totalLinearTokens > totalTokens) {
                totalLinearTokens = totalTokens;
            }
            return totalLinearTokens.sub(beneficiary.claimed);
        } else {
            return 0;
        }
    }

    /**
     * @dev Claim tokens for the beneficiary.
     */
    function claim() external virtual onlyBeneficiary(_msgSender()) {
        require(
            block.timestamp >= tgeUnlockTimestamp,
            "Vesting: Not yet unlocked"
        );
        uint256 tokensEnableForRelease = enableForRelease(_msgSender());
        require(tokensEnableForRelease > 0, "Vesting: No tokens to release");

        vestingBeneficiaries[_msgSender()].claimed += tokensEnableForRelease;
        SafeERC20.safeTransfer(
            IERC20(token),
            _msgSender(),
            tokensEnableForRelease
        );
    }
}
