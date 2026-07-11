// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CypherTempreEscrow — returnable per-ring CPHY locks
/// @notice The RETURNABLE counterpart to keyless burn addresses. A burn to a
///         hash-derived address is permanent (proof-of-burn); a lock here is
///         reversible — the depositor can `unlock` and recover their CPHY. The
///         agent's oracle reads `lockedOf(ringHash)` (a view call, read-only)
///         and weights the ring while the lock stands; on unlock the weight
///         falls. This gives reversible on-chain weighting WITHOUT the agent
///         ever holding a private key: custody stays with the depositor.
///
/// @dev    NOT DEPLOYED by the skill. Deploy with YOUR keys after review by
///         counsel — this contract custodies real value. The CPHY token is
///         immutable and pinned at construction; only that token is accepted.
///         Checks-effects-interactions ordering guards against reentrancy.

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract CypherTempreEscrow {
    /// The one and only accepted token: CPHY on Base. Set once, immutable.
    IERC20 public immutable CPHY;

    /// ringHash => depositor => amount locked
    mapping(bytes32 => mapping(address => uint256)) public locked;
    /// ringHash => total locked across all depositors (what the oracle reads)
    mapping(bytes32 => uint256) public totalLocked;

    event Locked(bytes32 indexed ringHash, address indexed depositor, uint256 amount);
    event Unlocked(bytes32 indexed ringHash, address indexed depositor, uint256 amount);

    constructor(address cphyToken) {
        require(cphyToken != address(0), "token=0");
        CPHY = IERC20(cphyToken);
    }

    /// @notice Lock CPHY against a ring hash to weight that memory reversibly.
    /// @dev    Requires prior approve() of this contract on the CPHY token.
    function lock(bytes32 ringHash, uint256 amount) external {
        require(amount > 0, "amount=0");
        locked[ringHash][msg.sender] += amount;   // effects before interaction
        totalLocked[ringHash] += amount;
        emit Locked(ringHash, msg.sender, amount);
        require(CPHY.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
    }

    /// @notice Recover previously locked CPHY; the ring's weight falls with it.
    function unlock(bytes32 ringHash, uint256 amount) external {
        uint256 bal = locked[ringHash][msg.sender];
        require(amount > 0 && amount <= bal, "amount>locked");
        locked[ringHash][msg.sender] = bal - amount;   // effects first
        totalLocked[ringHash] -= amount;
        emit Unlocked(ringHash, msg.sender, amount);
        require(CPHY.transfer(msg.sender, amount), "transfer failed");
    }

    /// @notice The view the agent's oracle calls (read-only, no gas from agent).
    function lockedOf(bytes32 ringHash) external view returns (uint256) {
        return totalLocked[ringHash];
    }
}
