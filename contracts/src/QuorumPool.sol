// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Minimal slice of an EIP-3009 + EIP-712 token (tUSD8 on Aevum testnet).
interface IERC3009Token {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title QuorumPool
/// @notice All-or-nothing pre-orders without escrow. Each buyer signs a tUSD8
/// receiveWithAuthorization whose recipient is this contract, whose amount is the
/// pool price and whose validBefore is the pool deadline. Once enough buyers have
/// signed, anyone can call settle(): every authorization is redeemed in one
/// transaction and the total goes to the seller. If any single redemption fails the
/// whole settle reverts. If the threshold is never met, nothing ever moves and the
/// signatures simply expire at the deadline.
contract QuorumPool {
    // keccak256("ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;

    uint256 public constant MAX_ENTRIES = 256;
    uint256 private constant HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    struct Pool {
        address seller;
        uint64 deadline;
        uint32 minOrders;
        uint32 maxOrders;
        bool settled;
        uint256 price;
        string title;
    }

    struct Auth {
        uint256 validAfter;
        bytes32 r;
        bytes32 s;
        uint8 v;
        uint32 round;
        bool active;
        bool seen;
    }

    IERC3009Token public immutable token;
    uint256 public poolCount;

    mapping(uint256 => Pool) public pools;
    mapping(uint256 => uint256) public activeCount;
    mapping(uint256 => address[]) private _entrants;
    mapping(uint256 => mapping(address => Auth)) private _auths;

    event PoolCreated(uint256 indexed poolId, address indexed seller, uint256 price, uint32 minOrders, uint64 deadline, string title);
    event Pledged(uint256 indexed poolId, address indexed buyer, bytes32 nonce, uint256 activeCount);
    event PledgeWithdrawn(uint256 indexed poolId, address indexed buyer, uint256 activeCount);
    event PledgeDropped(uint256 indexed poolId, address indexed buyer, uint256 activeCount);
    event Settled(uint256 indexed poolId, address indexed seller, uint256 orders, uint256 total);

    error UnknownPool();
    error PoolClosed();
    error BadParams();
    error AlreadyPledged();
    error NotPledged();
    error PoolFull();
    error BadSignature();
    error NonceUsed();
    error NotAllowed();
    error BelowThreshold();
    error TransferFailed();

    constructor(IERC3009Token token_) {
        token = token_;
    }

    // ------------------------------------------------------------------ sellers

    function createPool(string calldata title, uint256 price, uint32 minOrders, uint32 maxOrders, uint64 deadline)
        external
        returns (uint256 poolId)
    {
        if (price == 0 || minOrders == 0 || maxOrders < minOrders || maxOrders > MAX_ENTRIES / 2) revert BadParams();
        if (deadline <= block.timestamp) revert BadParams();
        poolId = ++poolCount;
        pools[poolId] = Pool({
            seller: msg.sender,
            deadline: deadline,
            minOrders: minOrders,
            maxOrders: maxOrders,
            settled: false,
            price: price,
            title: title
        });
        emit PoolCreated(poolId, msg.sender, price, minOrders, deadline, title);
    }

    /// @notice Seller escape hatch: remove a pledge whose buyer emptied their wallet,
    /// so one bad authorization cannot block settle for everyone else.
    function dropPledge(uint256 poolId, address buyer) external {
        Pool storage p = _openPool(poolId);
        if (msg.sender != p.seller) revert NotAllowed();
        _deactivate(poolId, buyer);
        emit PledgeDropped(poolId, buyer, activeCount[poolId]);
    }

    // ------------------------------------------------------------------- buyers

    /// @notice The EIP-3009 nonce a buyer must sign for this pool. Bound to this
    /// contract, the pool and the buyer, plus a round that bumps after a withdrawal.
    function nonceFor(uint256 poolId, address buyer) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), poolId, buyer, _auths[poolId][buyer].round));
    }

    /// @notice Register a signed authorization. Usually submitted by the relayer so
    /// the buyer pays no gas. The signature is checked here against tUSD8's domain.
    function pledge(uint256 poolId, address buyer, uint256 validAfter, uint8 v, bytes32 r, bytes32 s) external {
        Pool storage p = _openPool(poolId);
        Auth storage a = _auths[poolId][buyer];
        if (a.active) revert AlreadyPledged();
        if (activeCount[poolId] >= p.maxOrders) revert PoolFull();

        bytes32 nonce = nonceFor(poolId, buyer);
        if (token.authorizationState(buyer, nonce)) revert NonceUsed();

        bytes32 structHash = keccak256(
            abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, buyer, address(this), p.price, validAfter, uint256(p.deadline), nonce)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        if (uint256(s) > HALF_N || (v != 27 && v != 28)) revert BadSignature();
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || signer != buyer) revert BadSignature();

        if (!a.seen) {
            if (_entrants[poolId].length >= MAX_ENTRIES) revert PoolFull();
            _entrants[poolId].push(buyer);
            a.seen = true;
        }
        a.validAfter = validAfter;
        a.v = v;
        a.r = r;
        a.s = s;
        a.active = true;
        uint256 count = ++activeCount[poolId];
        emit Pledged(poolId, buyer, nonce, count);
    }

    /// @notice Withdraw a pledge. Callable by the buyer, or by anyone (the relayer)
    /// once the buyer has cancelled the authorization on the token itself via
    /// cancelAuthorization. Either way the buyer needs no gas.
    function withdrawPledge(uint256 poolId, address buyer) external {
        _openPool(poolId);
        if (msg.sender != buyer && !token.authorizationState(buyer, nonceFor(poolId, buyer))) revert NotAllowed();
        _deactivate(poolId, buyer);
        emit PledgeWithdrawn(poolId, buyer, activeCount[poolId]);
    }

    // ------------------------------------------------------------------- settle

    /// @notice Redeem every active authorization and pay the seller, atomically.
    function settle(uint256 poolId) external {
        Pool storage p = _openPool(poolId);
        uint256 orders = activeCount[poolId];
        if (orders < p.minOrders) revert BelowThreshold();
        p.settled = true; // effects before interactions

        address[] storage entrants = _entrants[poolId];
        uint256 total;
        for (uint256 i = 0; i < entrants.length; i++) {
            address buyer = entrants[i];
            Auth storage a = _auths[poolId][buyer];
            if (!a.active) continue;
            token.receiveWithAuthorization(
                buyer, address(this), p.price, a.validAfter, p.deadline, nonceFor(poolId, buyer), a.v, a.r, a.s
            );
            total += p.price;
        }
        if (!token.transfer(p.seller, total)) revert TransferFailed();
        emit Settled(poolId, p.seller, orders, total);
    }

    // -------------------------------------------------------------------- views

    function entrantsOf(uint256 poolId) external view returns (address[] memory) {
        return _entrants[poolId];
    }

    function isPledged(uint256 poolId, address buyer) external view returns (bool) {
        return _auths[poolId][buyer].active;
    }

    // ----------------------------------------------------------------- internal

    function _openPool(uint256 poolId) private view returns (Pool storage p) {
        p = pools[poolId];
        if (p.seller == address(0)) revert UnknownPool();
        if (p.settled || block.timestamp >= p.deadline) revert PoolClosed();
    }

    function _deactivate(uint256 poolId, address buyer) private {
        Auth storage a = _auths[poolId][buyer];
        if (!a.active) revert NotPledged();
        a.active = false;
        a.round += 1;
        activeCount[poolId] -= 1;
    }
}
