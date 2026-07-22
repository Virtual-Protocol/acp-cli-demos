// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {NexPricingRegistry} from "./NexPricingRegistry.sol";

contract NexProductionPayments is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum Kind {
        Video,
        Infographic
    }
    enum Status {
        None,
        Paid,
        Settled,
        Refunded
    }

    struct Payment {
        address payer;
        uint128 amount;
        uint64 paidAt;
        uint64 configVersion;
        Kind kind;
        Status status;
    }

    NexPricingRegistry public immutable registry;
    mapping(bytes32 => Payment) public payments;

    error ZeroAddress();
    error AlreadyExists();
    error UnknownPayment();
    error InvalidStatus();
    error InvalidAmount();
    error StaleQuote();
    error PriceChanged(uint256 expected, uint256 actual);

    event ProductionPaid(
        bytes32 indexed productionId,
        address indexed payer,
        Kind kind,
        uint256 amount,
        bool nexEligible,
        uint64 configVersion
    );
    event ProductionSettled(bytes32 indexed productionId, uint256 amount, address indexed treasury);
    event ProductionRefunded(bytes32 indexed productionId, uint256 amount, address indexed payer, bytes32 reasonHash);

    constructor(address admin, address operator, NexPricingRegistry registry_) {
        if (admin == address(0) || operator == address(0) || address(registry_) == address(0)) {
            revert ZeroAddress();
        }
        registry = registry_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(PAUSER_ROLE, admin);
    }

    function pay(bytes32 productionId, Kind kind, uint256 expectedAmount, uint64 expectedConfigVersion)
        external
        nonReentrant
        whenNotPaused
    {
        if (payments[productionId].status != Status.None) revert AlreadyExists();

        uint256 amount;
        bool eligible;
        uint64 version;
        if (kind == Kind.Video) {
            (amount, eligible, version) = registry.quoteVideo(msg.sender);
        } else {
            (amount, version) = registry.quoteInfographic();
        }
        if (version != expectedConfigVersion) revert StaleQuote();
        if (amount != expectedAmount) revert PriceChanged(expectedAmount, amount);
        if (amount > type(uint128).max) revert InvalidAmount();

        IERC20 token = registry.usdc();
        token.safeTransferFrom(msg.sender, address(this), amount);

        payments[productionId] = Payment({
            payer: msg.sender,
            amount: uint128(amount),
            paidAt: uint64(block.timestamp),
            configVersion: version,
            kind: kind,
            status: Status.Paid
        });
        emit ProductionPaid(productionId, msg.sender, kind, amount, eligible, version);
    }

    function settle(bytes32 productionId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Payment storage payment = payments[productionId];
        if (payment.status == Status.None) revert UnknownPayment();
        if (payment.status != Status.Paid) revert InvalidStatus();
        payment.status = Status.Settled;
        address treasury = registry.treasury();
        registry.usdc().safeTransfer(treasury, payment.amount);
        emit ProductionSettled(productionId, payment.amount, treasury);
    }

    function refund(bytes32 productionId, bytes32 reasonHash)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        Payment storage payment = payments[productionId];
        if (payment.status == Status.None) revert UnknownPayment();
        if (payment.status != Status.Paid) revert InvalidStatus();
        payment.status = Status.Refunded;
        registry.usdc().safeTransfer(payment.payer, payment.amount);
        emit ProductionRefunded(productionId, payment.amount, payment.payer, reasonHash);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
