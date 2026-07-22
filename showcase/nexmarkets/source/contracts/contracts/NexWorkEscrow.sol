// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract NexWorkEscrow is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint64 public constant MIN_AUTO_RELEASE_REVIEW = 48 hours;

    enum Status {
        None,
        Funded,
        InProgress,
        Delivered,
        Revision,
        Approved,
        Released,
        Disputed,
        Refunded,
        Cancelled
    }

    struct Escrow {
        address founder;
        address worker;
        uint128 amount;
        uint64 fundedAt;
        uint64 deliveredAt;
        uint64 reviewDeadline;
        uint32 revisionCount;
        bool autoRelease;
        Status status;
    }

    struct ListingReserve {
        address founder;
        uint128 amountPerPlace;
        uint128 remaining;
        uint32 places;
        uint32 allocated;
        bool closed;
    }

    IERC20 public immutable usdc;
    address public feeTreasury;
    uint16 public platformFeeBps;
    mapping(bytes32 => Escrow) public escrows;
    mapping(bytes32 => ListingReserve) public listingReserves;

    error ZeroAddress();
    error InvalidAmount();
    error AlreadyExists();
    error UnknownEscrow();
    error InvalidStatus();
    error NotFounder();
    error NotWorker();
    error ReviewWindowOpen();
    error ReviewWindowTooShort();
    error FeeTooHigh();
    error ListingClosed();
    error ListingFullyAllocated();

    event EscrowFunded(bytes32 indexed workroomId, address indexed founder, address indexed worker, uint256 amount, bool autoRelease);
    event WorkStarted(bytes32 indexed workroomId);
    event DeliverySubmitted(bytes32 indexed workroomId, bytes32 indexed deliveryHash, uint64 reviewDeadline);
    event RevisionRequested(bytes32 indexed workroomId, bytes32 indexed requestHash, uint32 revisionCount);
    event DeliveryApproved(bytes32 indexed workroomId);
    event PaymentReleased(bytes32 indexed workroomId, uint256 workerAmount, uint256 feeAmount);
    event DisputeOpened(bytes32 indexed workroomId, bytes32 indexed reasonHash);
    event DisputeResolved(bytes32 indexed workroomId, uint256 founderAmount, uint256 workerAmount, uint256 feeAmount);
    event EscrowRefunded(bytes32 indexed workroomId, uint256 amount);
    event ListingFunded(bytes32 indexed listingId, address indexed founder, uint256 amountPerPlace, uint32 places, uint256 totalAmount);
    event ListingAllocated(bytes32 indexed listingId, bytes32 indexed workroomId, address indexed worker, uint256 amount, uint256 remaining);
    event ListingRefunded(bytes32 indexed listingId, address indexed founder, uint256 amount);

    constructor(
        address admin,
        address operator,
        address resolver,
        IERC20 usdc_,
        address feeTreasury_,
        uint16 platformFeeBps_
    ) {
        if (
            admin == address(0) || operator == address(0) || resolver == address(0)
                || address(usdc_) == address(0) || feeTreasury_ == address(0)
        ) revert ZeroAddress();
        if (platformFeeBps_ > 1000) revert FeeTooHigh();
        usdc = usdc_;
        feeTreasury = feeTreasury_;
        platformFeeBps = platformFeeBps_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(RESOLVER_ROLE, resolver);
        _grantRole(PAUSER_ROLE, admin);
    }

    function fund(bytes32 workroomId, address worker, uint256 amount, bool autoRelease)
        external
        nonReentrant
        whenNotPaused
    {
        if (worker == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > type(uint128).max) revert InvalidAmount();
        if (escrows[workroomId].status != Status.None) revert AlreadyExists();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        escrows[workroomId] = Escrow({
            founder: msg.sender,
            worker: worker,
            amount: uint128(amount),
            fundedAt: uint64(block.timestamp),
            deliveredAt: 0,
            reviewDeadline: 0,
            revisionCount: 0,
            autoRelease: autoRelease,
            status: Status.Funded
        });
        emit EscrowFunded(workroomId, msg.sender, worker, amount, autoRelease);
    }

    function fundListing(bytes32 listingId, uint256 amountPerPlace, uint32 places)
        external
        nonReentrant
        whenNotPaused
    {
        if (amountPerPlace == 0 || places == 0) revert InvalidAmount();
        uint256 totalAmount = amountPerPlace * places;
        if (amountPerPlace > type(uint128).max || totalAmount > type(uint128).max) revert InvalidAmount();
        if (listingReserves[listingId].founder != address(0)) revert AlreadyExists();
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);
        listingReserves[listingId] = ListingReserve({
            founder: msg.sender,
            amountPerPlace: uint128(amountPerPlace),
            remaining: uint128(totalAmount),
            places: places,
            allocated: 0,
            closed: false
        });
        emit ListingFunded(listingId, msg.sender, amountPerPlace, places, totalAmount);
    }

    function assignFromListing(bytes32 listingId, bytes32 workroomId, address worker, bool autoRelease)
        external
        whenNotPaused
    {
        if (worker == address(0)) revert ZeroAddress();
        ListingReserve storage reserve = listingReserves[listingId];
        if (reserve.founder == address(0)) revert UnknownEscrow();
        if (msg.sender != reserve.founder) revert NotFounder();
        if (reserve.closed) revert ListingClosed();
        if (reserve.allocated >= reserve.places || reserve.remaining < reserve.amountPerPlace) {
            revert ListingFullyAllocated();
        }
        if (escrows[workroomId].status != Status.None) revert AlreadyExists();
        uint128 amount = reserve.amountPerPlace;
        reserve.remaining -= amount;
        unchecked {
            reserve.allocated += 1;
        }
        if (reserve.allocated == reserve.places) reserve.closed = true;
        escrows[workroomId] = Escrow({
            founder: reserve.founder,
            worker: worker,
            amount: amount,
            fundedAt: uint64(block.timestamp),
            deliveredAt: 0,
            reviewDeadline: 0,
            revisionCount: 0,
            autoRelease: autoRelease,
            status: Status.InProgress
        });
        emit ListingAllocated(listingId, workroomId, worker, amount, reserve.remaining);
        emit EscrowFunded(workroomId, reserve.founder, worker, amount, autoRelease);
        emit WorkStarted(workroomId);
    }

    function refundListing(bytes32 listingId) external nonReentrant {
        ListingReserve storage reserve = listingReserves[listingId];
        if (reserve.founder == address(0)) revert UnknownEscrow();
        if (msg.sender != reserve.founder) revert NotFounder();
        uint256 amount = reserve.remaining;
        if (amount == 0) revert InvalidAmount();
        reserve.remaining = 0;
        reserve.closed = true;
        usdc.safeTransfer(reserve.founder, amount);
        emit ListingRefunded(listingId, reserve.founder, amount);
    }

    function start(bytes32 workroomId) external onlyRole(OPERATOR_ROLE) {
        Escrow storage escrow = _escrow(workroomId);
        if (escrow.status != Status.Funded) revert InvalidStatus();
        escrow.status = Status.InProgress;
        emit WorkStarted(workroomId);
    }

    function submitDelivery(bytes32 workroomId, bytes32 deliveryHash, uint64 reviewSeconds)
        external
        whenNotPaused
    {
        Escrow storage escrow = _escrow(workroomId);
        if (msg.sender != escrow.worker && !hasRole(OPERATOR_ROLE, msg.sender)) revert NotWorker();
        if (escrow.status != Status.InProgress && escrow.status != Status.Revision) revert InvalidStatus();
        if (escrow.autoRelease && reviewSeconds < MIN_AUTO_RELEASE_REVIEW) revert ReviewWindowTooShort();
        escrow.status = Status.Delivered;
        escrow.deliveredAt = uint64(block.timestamp);
        escrow.reviewDeadline = uint64(block.timestamp) + reviewSeconds;
        emit DeliverySubmitted(workroomId, deliveryHash, escrow.reviewDeadline);
    }

    function requestRevision(bytes32 workroomId, bytes32 requestHash) external {
        Escrow storage escrow = _escrow(workroomId);
        if (msg.sender != escrow.founder) revert NotFounder();
        if (escrow.status != Status.Delivered) revert InvalidStatus();
        escrow.status = Status.Revision;
        unchecked {
            escrow.revisionCount += 1;
        }
        emit RevisionRequested(workroomId, requestHash, escrow.revisionCount);
    }

    function approve(bytes32 workroomId) external {
        Escrow storage escrow = _escrow(workroomId);
        if (msg.sender != escrow.founder) revert NotFounder();
        if (escrow.status != Status.Delivered) revert InvalidStatus();
        escrow.status = Status.Approved;
        emit DeliveryApproved(workroomId);
    }

    function release(bytes32 workroomId) external nonReentrant {
        Escrow storage escrow = _escrow(workroomId);
        bool isOperator = hasRole(OPERATOR_ROLE, msg.sender);
        bool founderApproved = escrow.status == Status.Approved && (msg.sender == escrow.founder || isOperator);
        bool autoReleaseReady = escrow.autoRelease && escrow.status == Status.Delivered
            && block.timestamp >= escrow.reviewDeadline;
        if (!founderApproved && !autoReleaseReady) {
            if (escrow.status == Status.Delivered && block.timestamp < escrow.reviewDeadline) {
                revert ReviewWindowOpen();
            }
            revert InvalidStatus();
        }
        escrow.status = Status.Released;
        (uint256 workerAmount, uint256 feeAmount) = _split(escrow.amount);
        usdc.safeTransfer(escrow.worker, workerAmount);
        if (feeAmount > 0) usdc.safeTransfer(feeTreasury, feeAmount);
        emit PaymentReleased(workroomId, workerAmount, feeAmount);
    }

    function openDispute(bytes32 workroomId, bytes32 reasonHash) external {
        Escrow storage escrow = _escrow(workroomId);
        if (msg.sender != escrow.founder && msg.sender != escrow.worker) revert InvalidStatus();
        if (
            escrow.status != Status.Delivered && escrow.status != Status.Revision
                && escrow.status != Status.InProgress
        ) revert InvalidStatus();
        escrow.status = Status.Disputed;
        emit DisputeOpened(workroomId, reasonHash);
    }

    function resolveDispute(bytes32 workroomId, uint256 founderAmount, uint256 workerGrossAmount)
        external
        onlyRole(RESOLVER_ROLE)
        nonReentrant
    {
        Escrow storage escrow = _escrow(workroomId);
        if (escrow.status != Status.Disputed) revert InvalidStatus();
        if (founderAmount + workerGrossAmount != escrow.amount) revert InvalidAmount();
        escrow.status = Status.Released;
        uint256 feeAmount = (workerGrossAmount * platformFeeBps) / 10_000;
        uint256 workerAmount = workerGrossAmount - feeAmount;
        if (founderAmount > 0) usdc.safeTransfer(escrow.founder, founderAmount);
        if (workerAmount > 0) usdc.safeTransfer(escrow.worker, workerAmount);
        if (feeAmount > 0) usdc.safeTransfer(feeTreasury, feeAmount);
        emit DisputeResolved(workroomId, founderAmount, workerAmount, feeAmount);
    }

    function refundBeforeStart(bytes32 workroomId) external nonReentrant {
        Escrow storage escrow = _escrow(workroomId);
        if (msg.sender != escrow.founder && !hasRole(OPERATOR_ROLE, msg.sender)) revert NotFounder();
        if (escrow.status != Status.Funded) revert InvalidStatus();
        escrow.status = Status.Refunded;
        usdc.safeTransfer(escrow.founder, escrow.amount);
        emit EscrowRefunded(workroomId, escrow.amount);
    }

    function setFee(address treasury, uint16 feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury == address(0)) revert ZeroAddress();
        if (feeBps > 1000) revert FeeTooHigh();
        feeTreasury = treasury;
        platformFeeBps = feeBps;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _escrow(bytes32 id) internal view returns (Escrow storage escrow) {
        escrow = escrows[id];
        if (escrow.status == Status.None) revert UnknownEscrow();
    }

    function _split(uint256 gross) internal view returns (uint256 workerAmount, uint256 feeAmount) {
        feeAmount = (gross * platformFeeBps) / 10_000;
        workerAmount = gross - feeAmount;
    }
}
