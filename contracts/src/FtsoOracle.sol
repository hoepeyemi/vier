// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IFlareContractRegistry {
    function getContractAddressByName(string calldata name) external view returns (address);
}

interface IFtsoV2 {
    function getFeedByIdInWei(bytes21 feedId) external payable returns (uint256 value, uint64 timestamp);
}

interface IInvoiceRiskTarget {
    function getDaysUntilDue(uint256 tokenId) external view returns (int256);
    function updateRiskMetrics(uint256 tokenId, uint8 riskScore, uint8 paymentProbability) external;
}

/// @title FtsoOracle - Flare-native market-aware invoice risk oracle
/// @notice Resolves FtsoV2 through FlareContractRegistry and uses live feeds when updating invoice risk.
/// @dev FTSOv2 price functions are payable/non-view, so risk updates are explicit state-changing calls.
contract FtsoOracle is Ownable {
    struct RiskData {
        uint8 riskScore;
        uint8 paymentProbability;
        uint256 nativeUsdPriceWei;
        uint64 priceTimestamp;
        uint256 lastUpdate;
        bool exists;
    }

    IInvoiceRiskTarget public immutable invoiceNFT;
    IFlareContractRegistry public flareContractRegistry;
    address public ftsoV2Override;

    bytes21 public nativeUsdFeedId;
    bytes21 public ethUsdFeedId;
    uint256 public maxPriceAge = 10 minutes;
    uint8 public defaultRiskScore = 75;
    uint8 public defaultPaymentProbability = 80;
    uint256 public lastObservedNativeUsdPriceWei;

    mapping(address => bool) public dataProviders;
    mapping(uint256 => RiskData) public riskData;

    event RiskDataUpdated(
        uint256 indexed tokenId,
        uint8 riskScore,
        uint8 paymentProbability,
        uint256 nativeUsdPriceWei,
        uint64 priceTimestamp
    );
    event DataProviderUpdated(address indexed provider, bool authorized);
    event RegistryUpdated(address indexed registry);
    event FtsoV2OverrideUpdated(address indexed ftsoV2Override);
    event FeedIdsUpdated(bytes21 nativeUsdFeedId, bytes21 ethUsdFeedId);
    event MaxPriceAgeUpdated(uint256 maxPriceAge);
    event DefaultsUpdated(uint8 riskScore, uint8 paymentProbability);

    modifier onlyDataProvider() {
        require(dataProviders[msg.sender] || msg.sender == owner(), "Not provider");
        _;
    }

    constructor(
        address invoiceNFT_,
        address flareContractRegistry_,
        bytes21 nativeUsdFeedId_,
        bytes21 ethUsdFeedId_
    ) Ownable(msg.sender) {
        require(invoiceNFT_ != address(0), "Invalid invoice NFT");
        require(flareContractRegistry_ != address(0), "Invalid registry");
        require(nativeUsdFeedId_ != bytes21(0), "Invalid native feed");
        require(ethUsdFeedId_ != bytes21(0), "Invalid ETH feed");

        invoiceNFT = IInvoiceRiskTarget(invoiceNFT_);
        flareContractRegistry = IFlareContractRegistry(flareContractRegistry_);
        nativeUsdFeedId = nativeUsdFeedId_;
        ethUsdFeedId = ethUsdFeedId_;
        dataProviders[msg.sender] = true;
    }

    function setDataProvider(address provider, bool authorized) external onlyOwner {
        require(provider != address(0), "Invalid provider");
        dataProviders[provider] = authorized;
        emit DataProviderUpdated(provider, authorized);
    }

    function setFlareContractRegistry(address registry) external onlyOwner {
        require(registry != address(0), "Invalid registry");
        flareContractRegistry = IFlareContractRegistry(registry);
        emit RegistryUpdated(registry);
    }

    /// @notice Optional emergency/manual override. Leave zero for registry-first production behavior.
    function setFtsoV2Override(address ftsoV2) external onlyOwner {
        ftsoV2Override = ftsoV2;
        emit FtsoV2OverrideUpdated(ftsoV2);
    }

    function setFeedIds(bytes21 nativeUsdFeedId_, bytes21 ethUsdFeedId_) external onlyOwner {
        require(nativeUsdFeedId_ != bytes21(0), "Invalid native feed");
        require(ethUsdFeedId_ != bytes21(0), "Invalid ETH feed");
        nativeUsdFeedId = nativeUsdFeedId_;
        ethUsdFeedId = ethUsdFeedId_;
        emit FeedIdsUpdated(nativeUsdFeedId_, ethUsdFeedId_);
    }

    function setMaxPriceAge(uint256 maxPriceAge_) external onlyOwner {
        require(maxPriceAge_ >= 30 seconds && maxPriceAge_ <= 1 days, "Invalid max age");
        maxPriceAge = maxPriceAge_;
        emit MaxPriceAgeUpdated(maxPriceAge_);
    }

    function setDefaults(uint8 riskScore, uint8 paymentProbability) external onlyOwner {
        require(riskScore <= 100 && paymentProbability <= 100, "Invalid values");
        defaultRiskScore = riskScore;
        defaultPaymentProbability = paymentProbability;
        emit DefaultsUpdated(riskScore, paymentProbability);
    }

    function resolveFtsoV2() public view returns (address ftsoV2) {
        ftsoV2 = ftsoV2Override;
        if (ftsoV2 == address(0)) {
            ftsoV2 = flareContractRegistry.getContractAddressByName("FtsoV2");
        }
        require(ftsoV2 != address(0), "FtsoV2 unavailable");
    }

    function getNativeUsdPrice() external payable returns (uint256 value, uint64 timestamp) {
        return _readFeed(nativeUsdFeedId);
    }

    function getEthUsdPrice() external payable returns (uint256 value, uint64 timestamp) {
        return _readFeed(ethUsdFeedId);
    }

    /// @notice Read FTSOv2 and update invoice risk metrics on InvoiceNFT.
    /// @dev The invoice amount remains encrypted; this score uses due-date and market-volatility signals only.
    function assessAndUpdateRisk(uint256 tokenId) external payable onlyDataProvider {
        (uint256 nativeUsdPriceWei, uint64 priceTimestamp) = _readFeed(nativeUsdFeedId);
        require(block.timestamp <= uint256(priceTimestamp) + maxPriceAge, "Stale FTSO price");

        int256 daysUntilDue = invoiceNFT.getDaysUntilDue(tokenId);
        (uint8 riskScore, uint8 paymentProbability) = _score(daysUntilDue, nativeUsdPriceWei);

        riskData[tokenId] = RiskData({
            riskScore: riskScore,
            paymentProbability: paymentProbability,
            nativeUsdPriceWei: nativeUsdPriceWei,
            priceTimestamp: priceTimestamp,
            lastUpdate: block.timestamp,
            exists: true
        });
        lastObservedNativeUsdPriceWei = nativeUsdPriceWei;

        invoiceNFT.updateRiskMetrics(tokenId, riskScore, paymentProbability);
        emit RiskDataUpdated(tokenId, riskScore, paymentProbability, nativeUsdPriceWei, priceTimestamp);
    }

    function getRiskScore(uint256 tokenId) external view returns (uint8) {
        return riskData[tokenId].exists ? riskData[tokenId].riskScore : defaultRiskScore;
    }

    function getPaymentProbability(uint256 tokenId) external view returns (uint8) {
        return riskData[tokenId].exists ? riskData[tokenId].paymentProbability : defaultPaymentProbability;
    }

    function isStale(uint256 tokenId, uint256 maxAge) external view returns (bool) {
        if (!riskData[tokenId].exists) return true;
        return block.timestamp - riskData[tokenId].lastUpdate > maxAge;
    }

    function _readFeed(bytes21 feedId) internal returns (uint256 value, uint64 timestamp) {
        (value, timestamp) = IFtsoV2(resolveFtsoV2()).getFeedByIdInWei{value: msg.value}(feedId);
        require(value > 0, "Invalid FTSO price");
    }

    function _score(int256 daysUntilDue, uint256 nativeUsdPriceWei)
        internal
        view
        returns (uint8 riskScore, uint8 paymentProbability)
    {
        if (daysUntilDue < 0) {
            riskScore = 30;
            paymentProbability = 40;
        } else if (daysUntilDue < 7) {
            riskScore = 60;
            paymentProbability = 70;
        } else if (daysUntilDue < 30) {
            riskScore = 75;
            paymentProbability = 85;
        } else {
            riskScore = 85;
            paymentProbability = 92;
        }

        uint256 previous = lastObservedNativeUsdPriceWei;
        if (previous > 0) {
            uint256 diff = nativeUsdPriceWei > previous ? nativeUsdPriceWei - previous : previous - nativeUsdPriceWei;
            uint256 changeBps = (diff * 10_000) / previous;
            if (changeBps > 1_000) {
                riskScore = _subtractClamp(riskScore, 15, 5);
                paymentProbability = _subtractClamp(paymentProbability, 15, 5);
            } else if (changeBps > 500) {
                riskScore = _subtractClamp(riskScore, 8, 5);
                paymentProbability = _subtractClamp(paymentProbability, 8, 5);
            }
        }
    }

    function _subtractClamp(uint8 value, uint8 amount, uint8 floor) internal pure returns (uint8) {
        if (value <= floor + amount) return floor;
        return value - amount;
    }
}