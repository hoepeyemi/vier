// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal interface for Flare FCC TeeExtensionRegistry.
/// @dev Matches the official FCC scaffold shape used by InstructionSender contracts.
interface ITeeExtensionRegistry {
    struct TeeInstructionParams {
        bytes32 opType;
        bytes32 opCommand;
        bytes message;
        address[] cosigners;
        uint256 cosignersThreshold;
        address claimBackAddress;
    }

    function sendInstructions(address[] calldata teeIds, TeeInstructionParams calldata params) external payable;
    function nextPublicExtensionId() external view returns (uint256);
    function getTeeExtensionInstructionsSender(uint256 extensionId) external view returns (address);
}