// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title VierPrivacy - Cryptographic commitments and Merkle proofs for invoice privacy
/// @notice Enables privacy-preserving verification of invoice data
/// @dev Part of vier Protocol - Uses hash commitments and Merkle trees for selective disclosure
contract PrivacyRegistry is Ownable {
    // ============ Structs ============

    struct Commitment {
        bytes32 commitment; // hash(data + salt)
        address owner; // Who created this commitment
        uint256 timestamp; // When created
        bool revealed; // Has been revealed
        bytes32 revealedHash; // Hash of revealed data (for verification)
    }

    /// @notice Immutable audit record of a TEE-attested strategy change
    /// @dev Written by AgentRouter after successful FDC attestation verification.
    ///      Proves that a strategy decision was made inside a verifiable Flare FCC TEE,
    ///      without exposing the raw invoice data that drove the decision.
    struct TEEAuditEntry {
        bytes32 teeId;       // TEE machine identity (keccak256 of FCE image hash + chainId)
        uint256 tokenId;     // Invoice token ID
        uint8   strategy;    // Chosen strategy enum value
        uint256 confidence;  // AI confidence 0-100
        uint256 timestamp;   // Block timestamp of execution
        address router;      // AgentRouter that submitted the entry
    }

    // ============ State ============

    // Commitment ID => Commitment data
    mapping(bytes32 => Commitment) public commitments;

    // Verified invoices Merkle root
    bytes32 public verifiedInvoicesRoot;

    // Set of verified invoice hashes
    mapping(bytes32 => bool) public verifiedInvoices;
    bytes32[] public verifiedInvoicesList;

    // Authorized verifiers (can add to verified set)
    mapping(address => bool) public verifiers;

    // ---- Flare FCC TEE Audit Trail ----

    /// @notice Ordered log of all TEE-attested strategy changes (append-only)
    TEEAuditEntry[] public teeAuditLog;

    /// @notice Addresses authorised to append to the TEE audit log (AgentRouter contracts)
    mapping(address => bool) public authorizedRouters;

    // ============ Events ============

    event CommitmentRegistered(bytes32 indexed commitmentId, address indexed owner, bytes32 commitment);

    event CommitmentRevealed(bytes32 indexed commitmentId, bytes32 revealedHash);

    event InvoiceVerified(bytes32 indexed invoiceHash, address indexed verifier);

    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot, uint256 invoiceCount);

    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    /// @notice Emitted for every TEE-attested strategy change logged to the audit trail
    event TEEStrategyChangeLogged(
        bytes32 indexed teeId,
        uint256 indexed tokenId,
        uint8 strategy,
        uint256 confidence,
        uint256 timestamp,
        address indexed router
    );

    event RouterAuthorized(address indexed router);
    event RouterDeauthorized(address indexed router);

    // ============ Modifiers ============

    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not verifier");
        _;
    }

    modifier onlyAuthorizedRouter() {
        require(authorizedRouters[msg.sender], "PrivacyRegistry: not authorized router");
        _;
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        verifiers[msg.sender] = true;
    }

    // ============ Admin Functions ============

    function addVerifier(address verifier) external onlyOwner {
        verifiers[verifier] = true;
        emit VerifierAdded(verifier);
    }

    function removeVerifier(address verifier) external onlyOwner {
        verifiers[verifier] = false;
        emit VerifierRemoved(verifier);
    }

    /// @notice Authorise an AgentRouter to append TEE audit entries
    function addAuthorizedRouter(address router) external onlyOwner {
        authorizedRouters[router] = true;
        emit RouterAuthorized(router);
    }

    function removeAuthorizedRouter(address router) external onlyOwner {
        authorizedRouters[router] = false;
        emit RouterDeauthorized(router);
    }

    // ============ Commitment Functions ============

    /// @notice Register a new commitment
    /// @param commitment The hash commitment (keccak256(data + salt))
    /// @return commitmentId Unique ID for this commitment
    function registerCommitment(bytes32 commitment) external returns (bytes32 commitmentId) {
        require(commitment != bytes32(0), "Invalid commitment");

        commitmentId = keccak256(abi.encodePacked(commitment, msg.sender, block.timestamp));

        require(commitments[commitmentId].commitment == bytes32(0), "Already exists");

        commitments[commitmentId] = Commitment({
            commitment: commitment,
            owner: msg.sender,
            timestamp: block.timestamp,
            revealed: false,
            revealedHash: bytes32(0)
        });

        emit CommitmentRegistered(commitmentId, msg.sender, commitment);
    }

    /// @notice Reveal a commitment by providing the original data and salt
    /// @param commitmentId The commitment to reveal
    /// @param data The original data
    /// @param salt The salt used in the commitment
    /// @return valid Whether the reveal matches the commitment
    function revealCommitment(bytes32 commitmentId, bytes calldata data, bytes32 salt) external returns (bool valid) {
        Commitment storage c = commitments[commitmentId];
        require(c.commitment != bytes32(0), "Commitment not found");
        require(!c.revealed, "Already revealed");
        require(c.owner == msg.sender, "Not owner");

        bytes32 computed = keccak256(abi.encodePacked(data, salt));
        valid = (computed == c.commitment);

        if (valid) {
            c.revealed = true;
            c.revealedHash = keccak256(data);
            emit CommitmentRevealed(commitmentId, c.revealedHash);
        }
    }

    /// @notice Verify a commitment without revealing (check if data+salt matches)
    /// @dev This is a view function for off-chain verification
    function verifyCommitment(bytes32 commitmentId, bytes calldata data, bytes32 salt) external view returns (bool) {
        Commitment memory c = commitments[commitmentId];
        bytes32 computed = keccak256(abi.encodePacked(data, salt));
        return computed == c.commitment;
    }

    // ============ Merkle Tree Functions ============

    /// @notice Add an invoice to the verified set
    /// @param invoiceHash Hash of the verified invoice
    function addVerifiedInvoice(bytes32 invoiceHash) external onlyVerifier {
        require(!verifiedInvoices[invoiceHash], "Already verified");

        verifiedInvoices[invoiceHash] = true;
        verifiedInvoicesList.push(invoiceHash);

        emit InvoiceVerified(invoiceHash, msg.sender);

        // Rebuild Merkle root
        _updateMerkleRoot();
    }

    /// @notice Batch add verified invoices
    function addVerifiedInvoices(bytes32[] calldata invoiceHashes) external onlyVerifier {
        for (uint256 i = 0; i < invoiceHashes.length; i++) {
            if (!verifiedInvoices[invoiceHashes[i]]) {
                verifiedInvoices[invoiceHashes[i]] = true;
                verifiedInvoicesList.push(invoiceHashes[i]);
                emit InvoiceVerified(invoiceHashes[i], msg.sender);
            }
        }
        _updateMerkleRoot();
    }

    /// @notice Verify Merkle proof that invoice is in verified set
    /// @param invoiceHash The invoice hash to verify
    /// @param proof The Merkle proof
    /// @return valid Whether the proof is valid
    function verifyInclusion(bytes32 invoiceHash, bytes32[] calldata proof) external view returns (bool valid) {
        return MerkleProof.verify(proof, verifiedInvoicesRoot, invoiceHash);
    }

    /// @notice Check if invoice is verified (direct lookup)
    function isVerified(bytes32 invoiceHash) external view returns (bool) {
        return verifiedInvoices[invoiceHash];
    }

    // ============ Internal Functions ============

    function _updateMerkleRoot() internal {
        bytes32 oldRoot = verifiedInvoicesRoot;

        if (verifiedInvoicesList.length == 0) {
            verifiedInvoicesRoot = bytes32(0);
        } else {
            verifiedInvoicesRoot = _computeMerkleRoot(verifiedInvoicesList);
        }

        emit MerkleRootUpdated(oldRoot, verifiedInvoicesRoot, verifiedInvoicesList.length);
    }

    function _computeMerkleRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        if (leaves.length == 0) return bytes32(0);
        if (leaves.length == 1) return leaves[0];

        uint256 n = leaves.length;
        while (n > 1) {
            uint256 newN = (n + 1) / 2;
            for (uint256 i = 0; i < newN; i++) {
                uint256 left = i * 2;
                uint256 right = left + 1;
                if (right < n) {
                    leaves[i] = _hashPair(leaves[left], leaves[right]);
                } else {
                    leaves[i] = leaves[left];
                }
            }
            n = newN;
        }

        return leaves[0];
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    // ============ TEE Audit Log (Flare FCC) ============

    /// @notice Append an immutable record of a TEE-attested strategy change
    /// @dev Called by AgentRouter immediately after a successful FDC attestation verification.
    ///      No raw invoice data is stored â€” only the TEE identity and the decision outcome.
    ///      This creates a verifiable, privacy-preserving audit trail on Flare.
    /// @param teeId      TEE machine identity from the FCE Docker image
    /// @param tokenId    Invoice token ID
    /// @param strategy   Chosen strategy (uint8 of YieldVault.Strategy enum)
    /// @param confidence AI confidence score 0-100
    function logTEEStrategyChange(
        bytes32 teeId,
        uint256 tokenId,
        uint8 strategy,
        uint256 confidence
    ) external onlyAuthorizedRouter {
        TEEAuditEntry memory entry = TEEAuditEntry({
            teeId: teeId,
            tokenId: tokenId,
            strategy: strategy,
            confidence: confidence,
            timestamp: block.timestamp,
            router: msg.sender
        });

        teeAuditLog.push(entry);

        emit TEEStrategyChangeLogged(teeId, tokenId, strategy, confidence, block.timestamp, msg.sender);
    }

    // ============ View Functions ============

    function getCommitment(bytes32 commitmentId) external view returns (Commitment memory) {
        return commitments[commitmentId];
    }

    function getVerifiedInvoicesCount() external view returns (uint256) {
        return verifiedInvoicesList.length;
    }

    function getMerkleRoot() external view returns (bytes32) {
        return verifiedInvoicesRoot;
    }

    /// @notice Generate a commitment hash (helper for frontend)
    function computeCommitment(bytes calldata data, bytes32 salt) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(data, salt));
    }

    /// @notice Return the total number of TEE-attested strategy changes
    function getTEEAuditCount() external view returns (uint256) {
        return teeAuditLog.length;
    }

    /// @notice Return a single TEE audit entry
    function getTEEAuditEntry(uint256 index) external view returns (TEEAuditEntry memory) {
        require(index < teeAuditLog.length, "PrivacyRegistry: index out of range");
        return teeAuditLog[index];
    }

    /// @notice Return all TEE audit entries for a given invoice token ID
    function getTEEAuditEntriesForToken(uint256 tokenId) external view returns (TEEAuditEntry[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < teeAuditLog.length; i++) {
            if (teeAuditLog[i].tokenId == tokenId) count++;
        }
        TEEAuditEntry[] memory result = new TEEAuditEntry[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < teeAuditLog.length; i++) {
            if (teeAuditLog[i].tokenId == tokenId) result[j++] = teeAuditLog[i];
        }
        return result;
    }
}
