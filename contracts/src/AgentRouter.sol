// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./InvoiceNFT.sol";
import "./YieldVault.sol";
import "./interfaces/IFDCVerifier.sol";

// Minimal interface for the TEE audit log on PrivacyRegistry
interface IPrivacyRegistryAudit {
    function logTEEStrategyChange(bytes32 teeId, uint256 tokenId, uint8 strategy, uint256 confidence) external;
}

/// @title VierAgent - Executes AI agent decisions on-chain
/// @notice Routes agent actions to appropriate contracts.
///         When teeAttestationMode is enabled, strategy changes must be accompanied by a
///         Flare FCC (Confidential Compute) attestation verified via the FDC contract.
/// @dev Part of vier Protocol - Agent FCE calls executeStrategyWithAttestation() from inside a TEE.
contract AgentRouter is Ownable, Pausable {
    // ============ Structs ============

    struct AgentDecision {
        uint256 tokenId;
        YieldVault.Strategy recommendedStrategy;
        string reasoning;
        uint256 confidence; // 0-100
        uint256 timestamp;
        bool executed;
    }

    struct AgentConfig {
        uint256 minConfidence; // Minimum confidence to auto-execute
        uint256 maxGasPrice; // Maximum gas price for execution
        bool autoExecute; // Whether to auto-execute decisions
        bool active; // Is agent active
    }

    // ============ State ============

    InvoiceNFT public invoiceNFT;
    YieldVault public yieldVault;

    // Authorized agent addresses (used in legacy / non-TEE mode)
    mapping(address => bool) public authorizedAgents;

    // Decision history
    mapping(uint256 => AgentDecision[]) public decisionHistory;
    uint256 public totalDecisions;

    // Agent configuration
    AgentConfig public config;

    // Last analysis timestamp per invoice
    mapping(uint256 => uint256) public lastAnalysis;

    // Rate limiting: minimum seconds between decisions for same invoice
    uint256 public decisionCooldown = 5 minutes;

    // ---- Flare Confidential Compute (FCC) Integration ----

    /// @notice Flare Data Connector verifier contract address
    ///         Set to MockFDCVerifier on Coston2 testnet; real FDC verifier on Flare mainnet
    address public fdcVerifier;

    /// @notice PrivacyRegistry address for immutable TEE audit trail
    address public privacyRegistry;

    /// @notice When true, executeStrategyWithAttestation() requires a valid FDC-verified TEE signature
    bool public teeAttestationMode;

    /// @notice Anti-replay: tracks consumed (teeId, nonce) pairs
    mapping(bytes32 => mapping(uint256 => bool)) public usedNonces;

    /// @notice Maximum age of a TEE-attested payload (prevents stale submissions)
    uint256 public teePayloadMaxAge = 5 minutes;

    // ============ Events ============

    event AgentAuthorized(address indexed agent);
    event AgentDeauthorized(address indexed agent);

    event DecisionRecorded(uint256 indexed tokenId, YieldVault.Strategy strategy, uint256 confidence, string reasoning);

    event DecisionExecuted(uint256 indexed tokenId, YieldVault.Strategy strategy, address indexed executor);

    event AnalysisRequested(uint256 indexed tokenId, address indexed requester);

    event ConfigUpdated(uint256 minConfidence, uint256 maxGasPrice, bool autoExecute);

    /// @notice Emitted when a strategy change is executed via a TEE-attested payload
    event TEEAttestationVerified(
        bytes32 indexed teeId,
        uint256 indexed tokenId,
        YieldVault.Strategy strategy,
        uint256 confidence,
        uint256 nonce
    );

    event FDCVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event PrivacyRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event TEEAttestationModeToggled(bool enabled);

    // ============ Modifiers ============

    modifier onlyAuthorizedAgent() {
        require(authorizedAgents[msg.sender], "Not authorized agent");
        _;
    }

    // ============ Constructor ============

    constructor(address _invoiceNFT, address _yieldVault) Ownable(msg.sender) {
        invoiceNFT = InvoiceNFT(_invoiceNFT);
        yieldVault = YieldVault(_yieldVault);

        config = AgentConfig({minConfidence: 70, maxGasPrice: 100 gwei, autoExecute: true, active: true});

        // Owner is first authorized agent
        authorizedAgents[msg.sender] = true;
    }

    // ============ Admin Functions ============

    function authorizeAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = true;
        emit AgentAuthorized(agent);
    }

    function deauthorizeAgent(address agent) external onlyOwner {
        authorizedAgents[agent] = false;
        emit AgentDeauthorized(agent);
    }

    function updateConfig(uint256 minConfidence, uint256 maxGasPrice, bool autoExecute) external onlyOwner {
        require(minConfidence <= 100, "Invalid confidence");
        config.minConfidence = minConfidence;
        config.maxGasPrice = maxGasPrice;
        config.autoExecute = autoExecute;

        emit ConfigUpdated(minConfidence, maxGasPrice, autoExecute);
    }

    function setActive(bool active) external onlyOwner {
        config.active = active;
    }

    function setDecisionCooldown(uint256 cooldownSeconds) external onlyOwner {
        decisionCooldown = cooldownSeconds;
    }

    // ---- Flare FCC Admin Functions ----

    /// @notice Set the Flare Data Connector verifier address
    /// @param _fdcVerifier Address of MockFDCVerifier (testnet) or real FDC verifier (mainnet)
    function setFDCVerifier(address _fdcVerifier) external onlyOwner {
        address old = fdcVerifier;
        fdcVerifier = _fdcVerifier;
        emit FDCVerifierUpdated(old, _fdcVerifier);
    }

    /// @notice Set the PrivacyRegistry address for TEE audit logging
    function setPrivacyRegistry(address _privacyRegistry) external onlyOwner {
        address old = privacyRegistry;
        privacyRegistry = _privacyRegistry;
        emit PrivacyRegistryUpdated(old, _privacyRegistry);
    }

    /// @notice Enable or disable TEE attestation mode
    /// @param enabled When true, executeStrategyWithAttestation requires FDC verification
    function setTEEAttestationMode(bool enabled) external onlyOwner {
        teeAttestationMode = enabled;
        emit TEEAttestationModeToggled(enabled);
    }

    /// @notice Update the maximum allowed age of a TEE payload
    function setTEEPayloadMaxAge(uint256 maxAgeSeconds) external onlyOwner {
        teePayloadMaxAge = maxAgeSeconds;
    }

    /// @notice Pause the agent router - blocks all decision recording and execution
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the agent router
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Agent Functions ============

    /// @notice Record an agent decision (legacy, non-attested path)
    /// @dev Blocked when teeAttestationMode is true â€” use executeStrategyWithAttestation instead.
    /// @param tokenId The invoice token ID
    /// @param strategy Recommended strategy
    /// @param confidence Confidence level (0-100)
    /// @param reasoning Human-readable reasoning
    function recordDecision(
        uint256 tokenId,
        YieldVault.Strategy strategy,
        uint256 confidence,
        string calldata reasoning
    ) external onlyAuthorizedAgent whenNotPaused returns (uint256 decisionIndex) {
        require(!teeAttestationMode, "AgentRouter: TEE mode active; use executeStrategyWithAttestation");
        require(config.active, "Agent not active");
        require(confidence <= 100, "Invalid confidence");
        require(block.timestamp >= lastAnalysis[tokenId] + decisionCooldown, "Decision cooldown not elapsed");

        AgentDecision memory decision = AgentDecision({
            tokenId: tokenId,
            recommendedStrategy: strategy,
            reasoning: reasoning,
            confidence: confidence,
            timestamp: block.timestamp,
            executed: false
        });

        decisionHistory[tokenId].push(decision);
        decisionIndex = decisionHistory[tokenId].length - 1;
        totalDecisions++;
        lastAnalysis[tokenId] = block.timestamp;

        emit DecisionRecorded(tokenId, strategy, confidence, reasoning);

        // Auto-execute if conditions met
        if (config.autoExecute && confidence >= config.minConfidence && tx.gasprice <= config.maxGasPrice) {
            _executeDecision(tokenId, decisionIndex);
        }
    }

    /// @notice Execute a recorded decision
    /// @param tokenId The invoice token ID
    /// @param decisionIndex Index in decision history
    function executeDecision(uint256 tokenId, uint256 decisionIndex) external whenNotPaused {
        require(config.active, "Agent not active");
        _executeDecision(tokenId, decisionIndex);
    }

    /// @notice Batch record and execute decisions (legacy, non-attested path)
    /// @dev Blocked when teeAttestationMode is true.
    function batchRecordAndExecute(
        uint256[] calldata tokenIds,
        YieldVault.Strategy[] calldata strategies,
        uint256[] calldata confidences,
        string[] calldata reasonings
    ) external onlyAuthorizedAgent whenNotPaused {
        require(!teeAttestationMode, "AgentRouter: TEE mode active; use executeStrategyWithAttestation");
        require(config.active, "Agent not active");
        require(
            tokenIds.length == strategies.length && tokenIds.length == confidences.length
                && tokenIds.length == reasonings.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 decisionIndex = _recordDecisionInternal(tokenIds[i], strategies[i], confidences[i], reasonings[i]);

            if (confidences[i] >= config.minConfidence) {
                _executeDecision(tokenIds[i], decisionIndex);
            }
        }
    }

    /// @notice Execute a yield strategy change using a Flare FCC TEE attestation
    /// @dev This is the primary execution path when running inside a Flare Compute Extension (FCE).
    ///      The FCE agent signs the decision payload with its TEE identity key. This contract
    ///      verifies the signature via the Flare Data Connector (FDC) before executing.
    ///
    ///      Payload ABI encoding: abi.encode(uint256 tokenId, uint8 strategy, uint256 confidence,
    ///                                        string reasoning, uint256 nonce, uint256 timestamp)
    ///
    /// @param teeId     TEE machine identity â€” keccak256(abi.encodePacked(imageHash, chainId))
    /// @param payload   ABI-encoded decision data produced inside the TEE
    /// @param signature ECDSA signature over keccak256(abi.encodePacked(teeId, payload))
    function executeStrategyWithAttestation(
        bytes32 teeId,
        bytes calldata payload,
        bytes calldata signature
    ) external whenNotPaused returns (uint256 decisionIndex) {
        require(teeAttestationMode, "AgentRouter: TEE mode not active; call setTEEAttestationMode(true)");
        require(config.active, "Agent not active");
        require(fdcVerifier != address(0), "AgentRouter: FDC verifier not configured");

        // Verify the FDC attestation â€” ensures payload came from a genuine registered TEE
        require(
            IFDCVerifier(fdcVerifier).verifyAttestation(teeId, payload, signature),
            "AgentRouter: invalid TEE attestation"
        );

        // Decode the TEE payload
        (
            uint256 tokenId,
            uint8 strategyRaw,
            uint256 confidence,
            string memory reasoning,
            uint256 nonce,
            uint256 timestamp
        ) = abi.decode(payload, (uint256, uint8, uint256, string, uint256, uint256));

        // Anti-replay: each (teeId, nonce) pair can only be used once
        require(!usedNonces[teeId][nonce], "AgentRouter: nonce already used");
        usedNonces[teeId][nonce] = true;

        // Freshness check: reject stale payloads
        require(
            block.timestamp <= timestamp + teePayloadMaxAge,
            "AgentRouter: TEE payload expired"
        );
        require(timestamp <= block.timestamp + 60, "AgentRouter: payload timestamp in future");

        require(confidence <= 100, "AgentRouter: invalid confidence");
        // Explicit bounds check â€” Solidity 0.8 panics (Panic 0x21) on invalid enum casts;
        // a descriptive revert is more legible on block explorers.
        require(
            strategyRaw <= uint8(YieldVault.Strategy.Aggressive),
            "AgentRouter: strategy value out of range"
        );

        YieldVault.Strategy strategy = YieldVault.Strategy(strategyRaw);

        // Record the decision (same cooldown applies)
        require(block.timestamp >= lastAnalysis[tokenId] + decisionCooldown, "Decision cooldown not elapsed");

        AgentDecision memory decision = AgentDecision({
            tokenId: tokenId,
            recommendedStrategy: strategy,
            reasoning: reasoning,
            confidence: confidence,
            timestamp: block.timestamp,
            executed: false
        });

        decisionHistory[tokenId].push(decision);
        decisionIndex = decisionHistory[tokenId].length - 1;
        totalDecisions++;
        lastAnalysis[tokenId] = block.timestamp;

        emit DecisionRecorded(tokenId, strategy, confidence, reasoning);
        emit TEEAttestationVerified(teeId, tokenId, strategy, confidence, nonce);

        // Auto-execute: TEE-attested decisions execute immediately (bypasses gas-price check)
        _executeDecision(tokenId, decisionIndex);

        // Log to PrivacyRegistry for immutable TEE audit trail
        if (privacyRegistry != address(0)) {
            try IPrivacyRegistryAudit(privacyRegistry).logTEEStrategyChange(
                teeId, tokenId, strategyRaw, confidence
            ) {} catch {}
        }
    }

    /// @notice Request analysis for an invoice
    function requestAnalysis(uint256 tokenId) external {
        emit AnalysisRequested(tokenId, msg.sender);
    }

    // ============ Internal Functions ============

    function _executeDecision(uint256 tokenId, uint256 decisionIndex) internal {
        AgentDecision storage decision = decisionHistory[tokenId][decisionIndex];
        require(!decision.executed, "Already executed");

        YieldVault.Deposit memory deposit = yieldVault.getDeposit(tokenId);

        if (deposit.active) {
            // Execute strategy change via YieldVault
            yieldVault.executeAgentAction(tokenId, decision.recommendedStrategy, decision.reasoning);
        }

        decision.executed = true;
        emit DecisionExecuted(tokenId, decision.recommendedStrategy, msg.sender);
    }

    function _recordDecisionInternal(
        uint256 tokenId,
        YieldVault.Strategy strategy,
        uint256 confidence,
        string calldata reasoning
    ) internal returns (uint256 decisionIndex) {
        require(confidence <= 100, "Invalid confidence");
        // Check cooldown to prevent spam (also catches duplicates in same batch since timestamp updates)
        require(block.timestamp >= lastAnalysis[tokenId] + decisionCooldown, "Decision cooldown not elapsed");

        AgentDecision memory decision = AgentDecision({
            tokenId: tokenId,
            recommendedStrategy: strategy,
            reasoning: reasoning,
            confidence: confidence,
            timestamp: block.timestamp,
            executed: false
        });

        decisionHistory[tokenId].push(decision);
        decisionIndex = decisionHistory[tokenId].length - 1;
        totalDecisions++;
        lastAnalysis[tokenId] = block.timestamp;

        emit DecisionRecorded(tokenId, strategy, confidence, reasoning);
    }

    // ============ View Functions ============

    function getDecisionHistory(uint256 tokenId) external view returns (AgentDecision[] memory) {
        return decisionHistory[tokenId];
    }

    function getLatestDecision(uint256 tokenId) external view returns (AgentDecision memory) {
        uint256 length = decisionHistory[tokenId].length;
        require(length > 0, "No decisions");
        return decisionHistory[tokenId][length - 1];
    }

    function getDecisionCount(uint256 tokenId) external view returns (uint256) {
        return decisionHistory[tokenId].length;
    }

    function isAgentAuthorized(address agent) external view returns (bool) {
        return authorizedAgents[agent];
    }

    function getConfig() external view returns (AgentConfig memory) {
        return config;
    }

    function needsAnalysis(uint256 tokenId, uint256 maxAge) external view returns (bool) {
        return block.timestamp - lastAnalysis[tokenId] > maxAge;
    }
}
