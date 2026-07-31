// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../interfaces/IFDCVerifier.sol";

/// @title MockFDCVerifier - Testnet / hackathon-demo FDC verifier for vier on Flare Coston2
/// @notice Simulates Flare Confidential Compute attestation by verifying ECDSA signatures
///         from registered TEE signing addresses. In production, the real Flare FDC verifier
///         checks that the payload came from a genuine attested TEE (MRENCLAVE match).
/// @dev Deploy on Coston2, then:
///        1. Call registerTEE(teeId, agentWalletAddress) â€” makes the agent wallet act as the TEE signer
///        2. Point AgentRouter.setFDCVerifier(thisAddress)
///      The agent computes teeId = keccak256(abi.encodePacked(imageHash, chainId)) and signs
///      keccak256(abi.encodePacked(teeId, payload)) with its private key.
contract MockFDCVerifier is IFDCVerifier {
    address public owner;

    /// @notice Maps teeId -> whether it is registered
    mapping(bytes32 => bool) public registeredTEEs;
    /// @notice Maps teeId -> the Ethereum address authorised to sign on behalf of that TEE
    mapping(bytes32 => address) public teeSigners;

    event TEERegistered(bytes32 indexed teeId, address indexed signer);
    event TEEDeregistered(bytes32 indexed teeId);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "MockFDCVerifier: not owner");
        _;
    }

    // ============ Admin ============

    /// @notice Register a TEE identity with the address that will sign its decision payloads
    /// @param teeId   keccak256(abi.encodePacked(imageHash, chainId)) â€” computed by the agent
    /// @param signer  Agent wallet address (in demo) or real TEE identity address (in production)
    function registerTEE(bytes32 teeId, address signer) external onlyOwner {
        require(signer != address(0), "MockFDCVerifier: zero signer");
        registeredTEEs[teeId] = true;
        teeSigners[teeId] = signer;
        emit TEERegistered(teeId, signer);
    }

    function deregisterTEE(bytes32 teeId) external onlyOwner {
        registeredTEEs[teeId] = false;
        teeSigners[teeId] = address(0);
        emit TEEDeregistered(teeId);
    }

    // ============ IFDCVerifier ============

    /// @inheritdoc IFDCVerifier
    function verifyAttestation(
        bytes32 teeId,
        bytes calldata payload,
        bytes calldata signature
    ) external view returns (bool) {
        if (!registeredTEEs[teeId]) return false;

        address expected = teeSigners[teeId];
        if (expected == address(0)) return false;

        // The agent signs keccak256(abi.encodePacked(teeId, payload))
        bytes32 msgHash = keccak256(abi.encodePacked(teeId, payload));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));

        return _recover(ethHash, signature) == expected;
    }

    /// @inheritdoc IFDCVerifier
    function isTEERegistered(bytes32 teeId) external view returns (bool) {
        return registeredTEEs[teeId];
    }

    // ============ Internal ============

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "MockFDCVerifier: invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "MockFDCVerifier: invalid v");
        return ecrecover(hash, v, r, s);
    }
}
