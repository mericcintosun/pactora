// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {QuorumPool, IERC3009Token} from "../src/QuorumPool.sol";
import {MockTUSD8} from "./MockTUSD8.sol";

/// Minimal cheatcode surface, declared locally because forge-std is not installed.
interface Vm {
    function sign(uint256 privateKey, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external pure returns (address);
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData, address emitter) external;
}

contract QuorumPoolTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    uint256 constant PRICE = 2_000_000; // 2 tUSD8 at 6 decimals
    uint256 constant BUYER_PK = 0xA11CE;
    address constant SELLER = address(0x5E11E7);
    address constant STRANGER = address(0xBAD);

    // Mirrors QuorumPool.Settled so expectEmit can match it.
    event Settled(uint256 indexed poolId, address indexed seller, uint256 orders, uint256 total);

    MockTUSD8 token;
    QuorumPool pool;
    uint64 deadline;

    function setUp() public {
        token = new MockTUSD8();
        pool = new QuorumPool(IERC3009Token(address(token)));
        deadline = uint64(block.timestamp + 1 days);
    }

    // ------------------------------------------------------------------ helpers

    function _eq(uint256 a, uint256 b, string memory what) internal pure {
        require(a == b, what);
    }

    function _open(uint32 minOrders, uint32 maxOrders, uint256 price) internal returns (uint256 id) {
        vm.prank(SELLER);
        id = pool.createPool("Ethiopia Guji natural, 250 g bag", price, minOrders, maxOrders, deadline);
    }

    function _sign(uint256 pk, uint256 id, uint256 price) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        address buyer = vm.addr(pk);
        bytes32 structHash = keccak256(
            abi.encode(
                token.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(),
                buyer,
                address(pool),
                price,
                uint256(0),
                uint256(deadline),
                pool.nonceFor(id, buyer)
            )
        );
        return vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
    }

    /// Funds the buyer with exactly one order and registers their signed authorization.
    function _pledge(uint256 pk, uint256 id, uint256 price) internal returns (address buyer) {
        buyer = vm.addr(pk);
        token.mint(buyer, price);
        (uint8 v, bytes32 r, bytes32 s) = _sign(pk, id, price);
        pool.pledge(id, buyer, 0, v, r, s);
    }

    function _pledgeMany(uint256 id, uint256 count, uint256 price) internal {
        for (uint256 i = 0; i < count; i++) {
            _pledge(BUYER_PK + i, id, price);
        }
    }

    function _err(string memory reason) internal pure returns (bytes memory) {
        return abi.encodeWithSignature("Error(string)", reason);
    }

    // -------------------------------------------------------------------- tests

    function test_typehashMatchesEip3009() public view {
        require(pool.RECEIVE_WITH_AUTHORIZATION_TYPEHASH() == token.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(), "typehash");
    }

    /// A pool with min 5 and zero pledges cannot settle: nothing moves below the threshold.
    function test_settleRevertsBelowThreshold() public {
        uint256 poolId = pool.createPool("Ethiopia Guji natural, 250 g bag", 2_000_000, 5, 12, uint64(block.timestamp + 1 days));
        vm.expectRevert(QuorumPool.BelowThreshold.selector);
        pool.settle(poolId);
    }

    /// The wow path: five signed buyers, one settle, seller gets 5 x price, pool keeps nothing.
    function test_settleHappyPath() public {
        uint256 id = _open(5, 12, PRICE);
        _pledgeMany(id, 5, PRICE);
        _eq(pool.activeCount(id), 5, "active count");

        vm.expectEmit(true, true, false, true, address(pool));
        emit Settled(id, SELLER, 5, 5 * PRICE);
        pool.settle(id);

        _eq(token.balanceOf(SELLER), 5 * PRICE, "seller total");
        _eq(token.balanceOf(address(pool)), 0, "pool keeps nothing");
        for (uint256 i = 0; i < 5; i++) {
            _eq(token.balanceOf(vm.addr(BUYER_PK + i)), 0, "buyer paid once");
        }
        vm.expectRevert(QuorumPool.PoolClosed.selector);
        pool.settle(id);
    }

    function test_settleAfterDeadlineReverts() public {
        uint256 id = _open(5, 12, PRICE);
        _pledgeMany(id, 5, PRICE);
        vm.warp(uint256(deadline));
        vm.expectRevert(QuorumPool.PoolClosed.selector);
        pool.settle(id);
        _eq(token.balanceOf(vm.addr(BUYER_PK)), PRICE, "balance untouched");
    }

    /// A buyer cancels on the token directly: settle reverts, then anyone may withdraw the pledge.
    function test_cancelledAuthorizationBlocksSettleThenWithdrawWorks() public {
        uint256 id = _open(5, 12, PRICE);
        _pledgeMany(id, 5, PRICE);

        address buyer = vm.addr(BUYER_PK);
        bytes32 nonce = pool.nonceFor(id, buyer);
        bytes32 structHash = keccak256(abi.encode(token.CANCEL_AUTHORIZATION_TYPEHASH(), buyer, nonce));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(BUYER_PK, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
        token.cancelAuthorization(buyer, nonce, v, r, s);

        vm.expectRevert(_err("authorization is used or canceled"));
        pool.settle(id);

        // The relayer (this contract, not the buyer) may now withdraw on the buyer's behalf.
        pool.withdrawPledge(id, buyer);
        _eq(pool.activeCount(id), 4, "withdrawn");
        require(!pool.isPledged(id, buyer), "still pledged");
    }

    function test_withdrawByStrangerWithoutCancelReverts() public {
        uint256 id = _open(5, 12, PRICE);
        address buyer = _pledge(BUYER_PK, id, PRICE);
        vm.prank(STRANGER);
        vm.expectRevert(QuorumPool.NotAllowed.selector);
        pool.withdrawPledge(id, buyer);
    }

    /// Only the `to` of a receiveWithAuthorization (the pool) can redeem it.
    function test_frontRunnerCannotRedeem() public {
        uint256 id = _open(5, 12, PRICE);
        address buyer = _pledge(BUYER_PK, id, PRICE);
        (uint8 v, bytes32 r, bytes32 s) = _sign(BUYER_PK, id, PRICE);
        bytes32 nonce = pool.nonceFor(id, buyer);

        vm.prank(STRANGER);
        vm.expectRevert(_err("caller must be the payee"));
        token.receiveWithAuthorization(buyer, address(pool), PRICE, 0, deadline, nonce, v, r, s);
        _eq(token.balanceOf(buyer), PRICE, "balance untouched");
    }

    /// A buyer who empties their wallet reverts the whole settle until the seller drops them.
    function test_emptyWalletRevertsUntilSellerDrops() public {
        uint256 id = _open(5, 12, PRICE);
        _pledgeMany(id, 6, PRICE);

        address quitter = vm.addr(BUYER_PK);
        vm.prank(quitter);
        token.transfer(STRANGER, PRICE);

        vm.expectRevert(_err("transfer amount exceeds balance"));
        pool.settle(id);
        _eq(token.balanceOf(vm.addr(BUYER_PK + 1)), PRICE, "nobody half charged");

        vm.prank(SELLER);
        pool.dropPledge(id, quitter);
        pool.settle(id);
        _eq(token.balanceOf(SELLER), 5 * PRICE, "seller paid by the other five");
    }

    function test_dropPledgeByStrangerReverts() public {
        uint256 id = _open(5, 12, PRICE);
        address buyer = _pledge(BUYER_PK, id, PRICE);
        vm.prank(STRANGER);
        vm.expectRevert(QuorumPool.NotAllowed.selector);
        pool.dropPledge(id, buyer);
    }

    function test_badSignatureReverts() public {
        uint256 id = _open(5, 12, PRICE);
        address buyer = vm.addr(BUYER_PK);
        // Signed by a different key than the buyer it claims to be.
        (uint8 v, bytes32 r, bytes32 s) = _sign(BUYER_PK + 99, id, PRICE);
        vm.expectRevert(QuorumPool.BadSignature.selector);
        pool.pledge(id, buyer, 0, v, r, s);
    }

    function test_duplicatePledgeReverts() public {
        uint256 id = _open(5, 12, PRICE);
        address buyer = _pledge(BUYER_PK, id, PRICE);
        (uint8 v, bytes32 r, bytes32 s) = _sign(BUYER_PK, id, PRICE);
        vm.expectRevert(QuorumPool.AlreadyPledged.selector);
        pool.pledge(id, buyer, 0, v, r, s);
    }

    /// For any order count and price in range, settle moves exactly orders x price to the seller.
    function testFuzz_settleTotalEqualsPriceTimesOrders(uint8 orders, uint96 price) public {
        uint32 n = uint32(1 + (uint256(orders) % 24)); // 1..24 buyers keeps the run fast
        uint256 p = 1 + (uint256(price) % 1e24); // never zero, far below overflow
        uint256 id = _open(n, n, p);
        _pledgeMany(id, n, p);

        pool.settle(id);

        _eq(token.balanceOf(SELLER), uint256(n) * p, "seller total");
        _eq(token.balanceOf(address(pool)), 0, "pool balance");
    }
}
