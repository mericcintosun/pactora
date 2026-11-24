// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Test stand-in for tUSD8 that behaves like an EIP-3009 token (USDC FiatTokenV2 style):
/// EIP-712 domain { name: "tUSD8", version: "2" }, receiveWithAuthorization that only the
/// payee can call, time window checks, signer recovery, single-use nonces, cancelAuthorization.
/// It does not inherit IERC3009Token on purpose: the public getters below satisfy the same
/// ABI, and the pool is handed `IERC3009Token(address(mock))`.
contract MockTUSD8 {
    string public constant name = "tUSD8";
    string public constant version = "2";
    uint8 public constant decimals = 6;

    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");

    bytes32 public immutable DOMAIN_SEPARATOR;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                address(this)
            )
        );
    }

    function mint(address to, uint256 value) external {
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

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
    ) public virtual {
        require(to == msg.sender, "caller must be the payee");
        require(block.timestamp > validAfter, "authorization is not yet valid");
        require(block.timestamp < validBefore, "authorization is expired");
        require(!authorizationState[from][nonce], "authorization is used or canceled");

        bytes32 structHash =
            keccak256(abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce));
        require(_recover(structHash, v, r, s) == from, "invalid signature");

        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    function cancelAuthorization(address authorizer, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external {
        require(!authorizationState[authorizer][nonce], "authorization is used or canceled");
        bytes32 structHash = keccak256(abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce));
        require(_recover(structHash, v, r, s) == authorizer, "invalid signature");
        authorizationState[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }

    function _recover(bytes32 structHash, uint8 v, bytes32 r, bytes32 s) private view returns (address signer) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "invalid signature");
    }

    function _transfer(address from, address to, uint256 value) internal virtual {
        require(balanceOf[from] >= value, "transfer amount exceeds balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}

interface ISettle {
    function settle(uint256 poolId) external;
}

/// Hostile variant for the reentrancy test: on the first redemption it calls back into
/// QuorumPool.settle for the same pool before doing the real transfer.
contract ReentrantTUSD8 is MockTUSD8 {
    ISettle public target;
    uint256 public targetPool;
    bool public armed;

    function arm(ISettle target_, uint256 poolId) external {
        target = target_;
        targetPool = poolId;
        armed = true;
    }

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
    ) public override {
        if (armed) {
            armed = false;
            target.settle(targetPool);
        }
        super.receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);
    }
}

/// Fee-on-transfer variant for the measured-delta test: every transfer burns 1 percent,
/// so the pool receives less than the signed value of each authorization.
contract FeeOnTransferTUSD8 is MockTUSD8 {
    function _transfer(address from, address to, uint256 value) internal override {
        require(balanceOf[from] >= value, "transfer amount exceeds balance");
        uint256 fee = value / 100;
        balanceOf[from] -= value;
        balanceOf[to] += value - fee;
        emit Transfer(from, to, value - fee);
    }
}
