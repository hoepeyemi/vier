// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal interface for FlareContractRegistry.
/// @dev The registry is deployed at the same address across Flare networks:
///      0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019.
interface IFlareContractRegistry {
    function getContractAddressByName(string calldata name) external view returns (address);
    function getContractAddressByHash(bytes32 nameHash) external view returns (address);
}