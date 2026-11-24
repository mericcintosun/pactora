// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {QuorumPool, IERC3009Token} from "../src/QuorumPool.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256);
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// Deploys QuorumPool bound to tUSD8 on Aevum testnet (chain 44005).
/// The key comes from the PRIVATE_KEY env var, never from argv.
///   PRIVATE_KEY=$FARM_EVM_PRIVATE_KEY forge script script/Deploy.s.sol \
///     --rpc-url https://rpc-test.qday.info --broadcast --legacy
contract Deploy {
    Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    address constant TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;

    event Deployed(address pool, address token);

    function run() external returns (QuorumPool pool) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address token = vm.envOr("TUSD8_ADDRESS", TUSD8);
        vm.startBroadcast(pk);
        pool = new QuorumPool(IERC3009Token(token));
        vm.stopBroadcast();
        emit Deployed(address(pool), token);
    }
}
