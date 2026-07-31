// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IFDCVerifier - Flare Data Connector TEE attestation verifier interface
/// @notice Verifies that a decision payload was produced inside a genuine Flare Confidential Compute (FCC) TEE
/// @dev In production this is a Flare-deployed contract. Use MockFDCVerifier on Coston2 for demos.
///      See: https://dev.flare.network/fdc/overview
interface IFDCVerifier {
    /// @notice Verify that a payload was signed by a TEE identified by teeId
    /// @param teeId  The TEE machine identity â€” keccak256 of the Docker image hash running in the confidential VM.
    ///               In Flare FCC this is the MRENCLAVE / reproducible image digest, registered at FCE deploy time.
    /// @param payload ABI-encoded decision data produced inside the TEE
    ///                (uint256 tokenId, uint8 strategy, uint256 confidence, string reasoning, uint256 nonce, uint256 timestamp)
    /// @param signature Signature over keccak256(abi.encodePacked(teeId, payload)) from the TEE identity key.
    ///                  Injected by Flare FCC infrastructure; the agent wallet key is used in demo mode.
    /// @return valid True if the attestation is genuine and the TEE is registered with Flare FCC
    function verifyAttestation(
        bytes32 teeId,
        bytes calldata payload,
        bytes calldata signature
    ) external view returns (bool valid);

    /// @notice Check whether a TEE machine is currently registered and active on Flare FCC
    /// @param teeId The TEE machine identity
    /// @return registered True if the TEE is registered
    function isTEERegistered(bytes32 teeId) external view returns (bool registered);
}
