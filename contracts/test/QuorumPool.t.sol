// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {QuorumPool, IERC3009Token} from "../src/QuorumPool.sol";

/// Minimal cheatcode surface, declared locally because forge-std is not installed.
interface Vm {
    function expectRevert(bytes4 revertData) external;
}

/// Tiny stand-in for tUSD8. settle() must revert before it ever reaches the token,
/// so every redemption path here just refuses.
contract MockToken is IERC3009Token {
    function DOMAIN_SEPARATOR() external pure returns (bytes32) {
        return bytes32(0);
    }

    function authorizationState(address, bytes32) external pure returns (bool) {
        return false;
    }

    function receiveWithAuthorization(address, address, uint256, uint256, uint256, bytes32, uint8, bytes32, bytes32)
        external
        pure
    {
        revert("mock: not redeemable");
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

contract QuorumPoolTest {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    QuorumPool pool;

    function setUp() public {
        pool = new QuorumPool(new MockToken());
    }

    /// A pool with min 5 and zero pledges cannot settle: nothing moves below the threshold.
    function test_settleRevertsBelowThreshold() public {
        uint256 poolId = pool.createPool("Ethiopia Guji natural, 250 g bag", 2_000_000, 5, 12, uint64(block.timestamp + 1 days));
        vm.expectRevert(QuorumPool.BelowThreshold.selector);
        pool.settle(poolId);
    }
}
