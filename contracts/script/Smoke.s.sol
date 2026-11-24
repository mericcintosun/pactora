// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {QuorumPool} from "../src/QuorumPool.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256);
    function envAddress(string calldata name) external view returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// One safe on-chain interaction: open a small pre-order pool (no tokens move).
///   DEPLOYED_CONTRACT=0x... PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Smoke.s.sol \
///     --rpc-url https://rpc-test.qday.info --broadcast --legacy
contract Smoke {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function run() external returns (uint256 poolId) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        QuorumPool pool = QuorumPool(vm.envAddress("DEPLOYED_CONTRACT"));
        vm.startBroadcast(pk);
        // 2 tUSD8 at 6 decimals, min 5 orders, max 12, closes in 24 hours.
        poolId = pool.createPool("Smoke test: Guji natural 250 g", 2_000_000, 5, 12, uint64(block.timestamp + 1 days));
        vm.stopBroadcast();
    }
}
