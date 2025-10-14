// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ========================================
// ADMIN MANAGER CONTRACT
// ========================================
// This contract handles all admin functions:
// - Token whitelist management
// - Wallet blacklist management  
// - Market deletion
// - Settings (durations, restrictions)
// - Links to Analytics & Verification contracts
//
// OWNER CALLS THIS CONTRACT for all admin tasks
// ========================================

import "@openzeppelin/contracts/access/Ownable.sol";

// Interface to interact with EventPool contract
interface IEventPool {
    enum MarketState {
        Active,
        Ended,
        Resolved,
        Cancelled,
        Deleted
    }
    
    struct Market {
        address creator;
        string ipfsHash;
        bool isMultiOption;
        uint256 maxOptions;
        address paymentToken;
        uint256 minStake;
        uint256 creatorDeposit;
        uint256 creatorOutcome;
        uint256 startTime;
        uint256 stakeEndTime;
        uint256 endTime;
        uint256 resolutionEndTime;
        MarketState state;
        uint256 winningOption;
        bool isResolved;
    }
    
    function markets(uint256) external view returns (Market memory);
    function nextMarketId() external view returns (uint256);
    function isActiveMarket(uint256) external view returns (bool);
    function markMarketDeleted(uint256 marketId) external;
    function markMarketPermanentlyRemoved(uint256 marketId) external;
}

contract AdminManager is Ownable {
    
    address public eventPool;
    
    // Supported tokens
    mapping(address => bool) public supportedTokens;
    mapping(address => string) public tokenSymbols;
    address[] public supportedTokenList;
    
    // Blacklisted wallets
    mapping(address => bool) public blacklistedWallets;
    address[] public blacklistedAddresses;
    
    // Deletion tracking
    uint256[] public deletedMarkets;
    mapping(uint256 => uint256) public deletionTimestamp;
    uint256[] public permanentlyRemovedMarkets;
    mapping(uint256 => bool) public isMarketDeleted;
    
    // Settings
    uint256 public minMarketDurationMinutes = 5;
    bool public bettingRestrictionEnabled = false;
    uint256 public bettingRestrictionMinutes = 5;
    
    // Analytics and Verification contracts
    address public analytics;
    address public verification;
    
    // Events
    event EventPoolSet(address indexed eventPool);
    event TokenAdded(address indexed token, string symbol);
    event TokenRemoved(address indexed token);
    event WalletBlacklisted(address indexed wallet, bool blacklisted);
    event MarketDeleted(uint256 indexed marketId, string reason);
    event MarketPermanentlyRemoved(uint256 indexed marketId);
    event AnalyticsSet(address indexed analytics);
    event VerificationSet(address indexed verification);
    event MinMarketDurationSet(uint256 duration);
    event StakingRestrictionSet(bool enabled, uint256 restrictionMinutes);
    
    modifier onlyEventPool() {
        require(msg.sender == eventPool, "AdminManager: Only EventPool");
        _;
    }
    
    constructor(address initialOwner) Ownable(initialOwner) {
        // Set native PEPU token
        tokenSymbols[address(0)] = "PEPU";
        supportedTokens[address(0)] = true;
        supportedTokenList.push(address(0));
    }
    
    /**
     * @dev Set the EventPool contract address (one-time setup)
     */
    function setEventPool(address _eventPool) external onlyOwner {
        require(_eventPool != address(0), "AdminManager: Invalid address");
        require(eventPool == address(0), "AdminManager: EventPool already set");
        eventPool = _eventPool;
        emit EventPoolSet(_eventPool);
    }
    
    // ============ TOKEN MANAGEMENT ============
    
    function addSupportedToken(address token, string memory symbol) external onlyOwner {
        require(token != address(0), "AdminManager: Invalid token address");
        require(bytes(symbol).length > 0, "AdminManager: Invalid token symbol");
        require(!supportedTokens[token], "AdminManager: Token already supported");
        
        supportedTokens[token] = true;
        tokenSymbols[token] = symbol;
        supportedTokenList.push(token);
        
        emit TokenAdded(token, symbol);
    }
    
    function removeSupportedToken(address token) external onlyOwner {
        require(token != address(0), "AdminManager: Cannot remove native token");
        require(supportedTokens[token], "AdminManager: Token not supported");
        
        supportedTokens[token] = false;
        delete tokenSymbols[token];
        
        // Remove from array
        for (uint256 i = 0; i < supportedTokenList.length; i++) {
            if (supportedTokenList[i] == token) {
                supportedTokenList[i] = supportedTokenList[supportedTokenList.length - 1];
                supportedTokenList.pop();
                break;
            }
        }
        
        emit TokenRemoved(token);
    }
    
    function getSupportedTokens() external view returns (address[] memory tokens, string[] memory symbols) {
        uint256 length = supportedTokenList.length;
        tokens = new address[](length);
        symbols = new string[](length);
        
        for (uint256 i = 0; i < length; i++) {
            tokens[i] = supportedTokenList[i];
            symbols[i] = tokenSymbols[supportedTokenList[i]];
        }
    }
    
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }
    
    function getTokenSymbol(address token) external view returns (string memory) {
        return tokenSymbols[token];
    }
    
    // ============ BLACKLIST MANAGEMENT ============
    
    function setWalletBlacklist(address wallet, bool blacklisted) external onlyOwner {
        require(wallet != address(0), "AdminManager: Invalid wallet address");
        
        bool wasBlacklisted = blacklistedWallets[wallet];
        blacklistedWallets[wallet] = blacklisted;
        
        if (blacklisted && !wasBlacklisted) {
            blacklistedAddresses.push(wallet);
        } else if (!blacklisted && wasBlacklisted) {
            for (uint256 i = 0; i < blacklistedAddresses.length; i++) {
                if (blacklistedAddresses[i] == wallet) {
                    blacklistedAddresses[i] = blacklistedAddresses[blacklistedAddresses.length - 1];
                    blacklistedAddresses.pop();
                    break;
                }
            }
        }
        
        emit WalletBlacklisted(wallet, blacklisted);
    }
    
    function getBlacklistedAddresses() external view returns (address[] memory) {
        return blacklistedAddresses;
    }
    
    function isWalletBlacklisted(address wallet) external view returns (bool) {
        return blacklistedWallets[wallet];
    }
    
    // ============ MARKET DELETION ============
    
    function deleteMarket(uint256 marketId, string memory reason) external onlyOwner {
        require(eventPool != address(0), "AdminManager: EventPool not set");
        require(!isMarketDeleted[marketId], "AdminManager: Already deleted");
        
        // Mark as deleted
        isMarketDeleted[marketId] = true;
        deletionTimestamp[marketId] = block.timestamp;
        deletedMarkets.push(marketId);
        
        emit MarketDeleted(marketId, reason);
    }
    
    function permanentlyRemoveMarket(uint256 marketId) external onlyOwner {
        require(isMarketDeleted[marketId], "AdminManager: Market not deleted");
        require(block.timestamp >= deletionTimestamp[marketId] + 30 days, "AdminManager: Claim period not ended");
        
        permanentlyRemovedMarkets.push(marketId);
        
        emit MarketPermanentlyRemoved(marketId);
    }
    
    function getDeletedMarkets() external view returns (uint256[] memory) {
        return deletedMarkets;
    }
    
    function getMarketsReadyForRemoval() external view returns (uint256[] memory) {
        uint256[] memory readyMarkets = new uint256[](deletedMarkets.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < deletedMarkets.length; i++) {
            uint256 marketId = deletedMarkets[i];
            if (isMarketDeleted[marketId] && 
                block.timestamp >= deletionTimestamp[marketId] + 30 days) {
                readyMarkets[count] = marketId;
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = readyMarkets[i];
        }
        
        return result;
    }
    
    function getPermanentlyRemovedMarkets() external view returns (uint256[] memory) {
        return permanentlyRemovedMarkets;
    }
    
    // ============ SETTINGS MANAGEMENT ============
    
    function setAnalytics(address _analytics) external onlyOwner {
        analytics = _analytics;
        emit AnalyticsSet(_analytics);
    }
    
    function setVerification(address _verification) external onlyOwner {
        verification = _verification;
        emit VerificationSet(_verification);
    }
    
    function setMinMarketDuration(uint256 _minMarketDurationMinutes) external onlyOwner {
        require(_minMarketDurationMinutes > 0, "AdminManager: Invalid minimum duration");
        minMarketDurationMinutes = _minMarketDurationMinutes;
        emit MinMarketDurationSet(_minMarketDurationMinutes);
    }
    
    function setStakingRestriction(bool _enabled, uint256 _restrictionMinutes) external onlyOwner {
        bettingRestrictionEnabled = _enabled;
        if (_enabled) {
            require(_restrictionMinutes > 0, "AdminManager: Invalid restriction duration");
            bettingRestrictionMinutes = _restrictionMinutes;
        }
        emit StakingRestrictionSet(_enabled, _restrictionMinutes);
    }
}