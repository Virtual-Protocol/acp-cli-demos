// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NexPricingRegistry is AccessControl {
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");

    error ZeroAddress();
    error InvalidPrice();

    IERC20 public usdc;
    IERC20 public nex;
    address public treasury;
    uint256 public videoPrice;
    uint256 public discountedVideoPrice;
    uint256 public infographicPrice;
    uint256 public nexThreshold;
    uint64 public configVersion;

    event ConfigurationUpdated(
        uint64 indexed version,
        address indexed usdc,
        address indexed nex,
        address treasury,
        uint256 videoPrice,
        uint256 discountedVideoPrice,
        uint256 infographicPrice,
        uint256 nexThreshold
    );

    constructor(address admin, address configManager) {
        if (admin == address(0) || configManager == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CONFIG_ROLE, configManager);
    }

    function configure(
        IERC20 usdc_,
        IERC20 nex_,
        address treasury_,
        uint256 videoPrice_,
        uint256 discountedVideoPrice_,
        uint256 infographicPrice_,
        uint256 nexThreshold_
    ) external onlyRole(CONFIG_ROLE) {
        if (address(usdc_) == address(0) || address(nex_) == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        if (
            videoPrice_ == 0 || discountedVideoPrice_ == 0 || infographicPrice_ == 0
                || discountedVideoPrice_ > videoPrice_ || nexThreshold_ == 0
        ) revert InvalidPrice();

        usdc = usdc_;
        nex = nex_;
        treasury = treasury_;
        videoPrice = videoPrice_;
        discountedVideoPrice = discountedVideoPrice_;
        infographicPrice = infographicPrice_;
        nexThreshold = nexThreshold_;
        unchecked {
            configVersion += 1;
        }

        emit ConfigurationUpdated(
            configVersion,
            address(usdc_),
            address(nex_),
            treasury_,
            videoPrice_,
            discountedVideoPrice_,
            infographicPrice_,
            nexThreshold_
        );
    }

    function isNexEligible(address account) public view returns (bool) {
        return nex.balanceOf(account) >= nexThreshold;
    }

    function quoteVideo(address account) external view returns (uint256 amount, bool eligible, uint64 version) {
        eligible = isNexEligible(account);
        amount = eligible ? discountedVideoPrice : videoPrice;
        version = configVersion;
    }

    function quoteInfographic() external view returns (uint256 amount, uint64 version) {
        return (infographicPrice, configVersion);
    }
}
