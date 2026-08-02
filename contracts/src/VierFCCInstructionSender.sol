// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ITeeExtensionRegistry} from "./fcc/interfaces/ITeeExtensionRegistry.sol";
import {ITeeMachineRegistry} from "./fcc/interfaces/ITeeMachineRegistry.sol";

/// @title VierFCCInstructionSender
/// @notice Official Flare FCC-compatible on-chain entry point for vier TEE instructions.
/// @dev This follows the Flare FCC scaffold pattern: callers send instructions through
///      TeeExtensionRegistry; extension-tee/ext-proxy handle routing, attestation, and results.
contract VierFCCInstructionSender {
    bytes32 public constant OP_TYPE_VIER = bytes32("VIER");
    bytes32 public constant OP_COMMAND_ATTEST_MINT = bytes32("ATTEST_MINT");
    bytes32 public constant OP_COMMAND_ANALYZE_STRATEGY = bytes32("ANALYZE_STRATEGY");

    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    ITeeMachineRegistry public immutable TEE_MACHINE_REGISTRY;

    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000;
    uint256 private _extensionId;

    event ExtensionIdSet(uint256 indexed extensionId);
    event VierInstructionSent(
        address indexed sender,
        uint256 indexed extensionId,
        bytes32 indexed opCommand,
        address teeId,
        bytes32 messageHash,
        uint256 fee
    );

    constructor(ITeeExtensionRegistry teeExtensionRegistry, ITeeMachineRegistry teeMachineRegistry) {
        require(address(teeExtensionRegistry) != address(0), "TeeExtensionRegistry cannot be zero");
        require(address(teeMachineRegistry) != address(0), "TeeMachineRegistry cannot be zero");
        require(address(teeExtensionRegistry).code.length > 0, "TeeExtensionRegistry has no code");
        require(address(teeMachineRegistry).code.length > 0, "TeeMachineRegistry has no code");
        TEE_EXTENSION_REGISTRY = teeExtensionRegistry;
        TEE_MACHINE_REGISTRY = teeMachineRegistry;
    }

    /// @notice Cache the extension ID assigned by TeeExtensionRegistry.
    /// @dev Mirrors the official FCC scaffold. Must be called after registering this sender.
    function setExtensionId() external {
        require(_extensionId == 0, "Extension ID already set");
        uint256 nextId = TEE_EXTENSION_REGISTRY.nextPublicExtensionId();
        for (uint256 i = FIRST_PUBLIC_EXTENSION_ID; i < nextId; i++) {
            if (TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                emit ExtensionIdSet(i);
                return;
            }
        }
        revert("Extension ID not found");
    }

    function getExtensionId() external view returns (uint256) {
        return _getExtensionId();
    }

    /// @notice Send encrypted invoice mint material to the vier FCC extension.
    /// @param message Encoded request consumed by the extension-tee handler.
    function sendEncryptedMintInstruction(bytes calldata message) external payable {
        _sendInstruction(OP_COMMAND_ATTEST_MINT, message);
    }

    /// @notice Send an invoice strategy-analysis request to the vier FCC extension.
    /// @param message Encoded request consumed by the extension-tee handler.
    function sendStrategyAnalysisInstruction(bytes calldata message) external payable {
        _sendInstruction(OP_COMMAND_ANALYZE_STRATEGY, message);
    }

    function _sendInstruction(bytes32 opCommand, bytes calldata message) internal {
        uint256 extensionId = _getExtensionId();
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(extensionId, 1);
        require(teeIds.length == 1, "TEE machine unavailable");

        address[] memory cosigners = new address[](0);
        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_VIER,
            opCommand: opCommand,
            message: message,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
        emit VierInstructionSent(msg.sender, extensionId, opCommand, teeIds[0], keccak256(message), msg.value);
    }

    function _getExtensionId() internal view returns (uint256) {
        require(_extensionId != 0, "Extension ID is not set");
        return _extensionId;
    }
}