// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./P2PMarketManager.sol";

contract MetricsHub is Ownable {
    
    // MarketManager reference
    address payable public marketManager;
    
    // User statistics
    struct UserStats {
        uint256 totalBetsPlaced;
        uint256 totalBetsWon;
        uint256 totalBetsLost;
        uint256 totalWinnings;
        uint256 totalLosses;
        uint256 totalSupportDonated;
        uint256 marketsCreated;
        uint256 marketsWon;
        uint256 marketsLost;
        uint256 favoriteOption; // Most bet on option
        uint256 lastActivity;
    }
    
    // Market statistics
    struct MarketStats {
        uint256 totalVolume;
        uint256 totalBettors;
        uint256 totalSupporters;
        uint256 averageBetSize;
        uint256 largestBet;
        uint256 mostPopularOption;
        uint256 resolutionTime;
        bool wasResolved;
        uint256 creatorWinnings;
    }
    
    // Global statistics
    struct GlobalStats {
        uint256 totalMarkets;
        uint256 totalVolume;
        uint256 totalBettors;
        uint256 totalSupporters;
        uint256 totalWinnings;
        uint256 averageMarketSize;
        uint256 mostActiveToken;
        uint256 averageResolutionTime;
    }
    
    // Mappings
    mapping(address => UserStats) public userStats;
    mapping(uint256 => MarketStats) public marketStats;
    mapping(address => uint256[]) public userMarkets;
    mapping(address => uint256[]) public userBets;
    mapping(address => uint256[]) public userSupports;
    mapping(address => mapping(uint256 => uint256)) public userOptionStats; // user => option => count
    
    // Events
    event UserStatsUpdated(address indexed user, uint256 totalBets, uint256 winnings);
    event MarketStatsUpdated(uint256 indexed marketId, uint256 volume, uint256 bettors);
    event GlobalStatsUpdated(uint256 totalMarkets, uint256 totalVolume);
    
    constructor(address initialOwner, address _marketManager) Ownable(initialOwner) {
        marketManager = payable(_marketManager);
    }
    
    /**
     * @dev Update market manager address
     */
    function setMarketManager(address _marketManager) external onlyOwner {
        marketManager = payable(_marketManager);
    }
    
    /**
     * @dev Track bet placement
     */
    function trackBet(uint256 marketId, address user, uint256 option, uint256 amount) external {
        require(msg.sender == marketManager, "Analytics: Only MarketManager can track");
        
        UserStats storage stats = userStats[user];
        stats.totalBetsPlaced++;
        stats.totalLosses += amount; // Will be updated when resolved
        stats.lastActivity = block.timestamp;
        
        // Track option preference
        userOptionStats[user][option]++;
        if (userOptionStats[user][option] > userOptionStats[user][stats.favoriteOption]) {
            stats.favoriteOption = option;
        }
        
        // Update market stats
        MarketStats storage marketStat = marketStats[marketId];
        marketStat.totalVolume += amount;
        marketStat.totalBettors = EventPool(marketManager).getBettorCount(marketId);
        marketStat.averageBetSize = marketStat.totalBettors > 0 ? marketStat.totalVolume / marketStat.totalBettors : 0;
        
        if (amount > marketStat.largestBet) {
            marketStat.largestBet = amount;
        }
        
        // Track user's markets
        if (userMarkets[user].length == 0 || userMarkets[user][userMarkets[user].length - 1] != marketId) {
            userMarkets[user].push(marketId);
        }
        userBets[user].push(marketId);
        
        emit UserStatsUpdated(user, stats.totalBetsPlaced, stats.totalWinnings);
        emit MarketStatsUpdated(marketId, marketStat.totalVolume, marketStat.totalBettors);
    }
    
    /**
     * @dev Track support donation
     */
    function trackSupport(uint256 marketId, address user, uint256 amount) external {
        require(msg.sender == marketManager, "Analytics: Only MarketManager can track");
        
        UserStats storage stats = userStats[user];
        stats.totalSupportDonated += amount;
        stats.lastActivity = block.timestamp;
        
        // Update market stats
        MarketStats storage marketStat = marketStats[marketId];
        marketStat.totalSupporters = EventPool(marketManager).getSupporterCount(marketId);
        
        userSupports[user].push(marketId);
        
        emit UserStatsUpdated(user, stats.totalBetsPlaced, stats.totalWinnings);
    }
    
    /**
     * @dev Track market creation
     */
    function trackMarketCreation(uint256 marketId, address creator) external {
        require(msg.sender == marketManager, "Analytics: Only MarketManager can track");
        
        UserStats storage stats = userStats[creator];
        stats.marketsCreated++;
        stats.lastActivity = block.timestamp;
        
        userMarkets[creator].push(marketId);
        
        emit UserStatsUpdated(creator, stats.totalBetsPlaced, stats.totalWinnings);
    }
    
    /**
     * @dev Track market resolution
     */
    function trackMarketResolution(uint256 marketId, uint256 winningOption) external {
        require(msg.sender == marketManager, "Analytics: Only MarketManager can track");
        
        MarketStats storage marketStat = marketStats[marketId];
        marketStat.wasResolved = true;
        marketStat.resolutionTime = block.timestamp;
        marketStat.mostPopularOption = winningOption;
        
        // Update global stats (note: this is expensive, consider caching)
        // GlobalStats storage global = getGlobalStats();
        // global.totalMarkets++;
        // global.totalVolume += marketStat.totalVolume;
        
        emit GlobalStatsUpdated(0, 0); // Placeholder - global stats calculation is expensive
    }
    
    /**
     * @dev Track user winnings
     */
    function trackWinnings(uint256 marketId, address user, uint256 winnings) external {
        require(msg.sender == marketManager, "Analytics: Only MarketManager can track");
        
        UserStats storage stats = userStats[user];
        stats.totalBetsWon++;
        stats.totalWinnings += winnings;
        stats.lastActivity = block.timestamp;
        
        // Check if user won the market they created
        EventPool.Market memory market = EventPool(marketManager).getMarket(marketId);
        if (market.creator == user) {
            stats.marketsWon++;
            marketStats[marketId].creatorWinnings = winnings;
        }
        
        emit UserStatsUpdated(user, stats.totalBetsPlaced, stats.totalWinnings);
    }
    
    /**
     * @dev Track user loss
     */
    function trackLoss(uint256 marketId, address user, uint256 loss) external {
        require(msg.sender == marketManager, "Analytics: Only MarketManager can track");
        
        UserStats storage stats = userStats[user];
        stats.totalBetsLost++;
        stats.lastActivity = block.timestamp;
        
        // Check if user lost the market they created
        EventPool.Market memory market = EventPool(marketManager).getMarket(marketId);
        if (market.creator == user) {
            stats.marketsLost++;
        }
        
        emit UserStatsUpdated(user, stats.totalBetsPlaced, stats.totalWinnings);
    }
    
    /**
     * @dev Get user statistics
     */
    function getUserStats(address user) external view returns (UserStats memory) {
        return userStats[user];
    }
    
    /**
     * @dev Get market statistics
     */
    function getMarketStats(uint256 marketId) external view returns (MarketStats memory) {
        return marketStats[marketId];
    }
    
    /**
     * @dev Get global statistics
     */
    function getGlobalStats() public view returns (GlobalStats memory) {
        uint256 totalMarkets = EventPool(marketManager).getNextMarketId() - 1;
        uint256 totalVolume = 0;
        uint256 totalBettors = 0;
        uint256 totalSupporters = 0;
        
        // Calculate totals (this is expensive, consider caching)
        for (uint256 i = 1; i <= totalMarkets; i++) {
            MarketStats memory market = marketStats[i];
            totalVolume += market.totalVolume;
            totalBettors += market.totalBettors;
            totalSupporters += market.totalSupporters;
        }
        
        return GlobalStats({
            totalMarkets: totalMarkets,
            totalVolume: totalVolume,
            totalBettors: totalBettors,
            totalSupporters: totalSupporters,
            totalWinnings: 0, // Would need to track this
            averageMarketSize: totalMarkets > 0 ? totalVolume / totalMarkets : 0,
            mostActiveToken: 0, // Would need to track this
            averageResolutionTime: 0 // Would need to track this
        });
    }
    
    /**
     * @dev Get user's market history
     */
    function getUserMarkets(address user) external view returns (uint256[] memory) {
        return userMarkets[user];
    }
    
    /**
     * @dev Get user's bet history
     */
    function getUserBets(address user) external view returns (uint256[] memory) {
        return userBets[user];
    }
    
    /**
     * @dev Get user's support history
     */
    function getUserSupports(address user) external view returns (uint256[] memory) {
        return userSupports[user];
    }
    
    /**
     * @dev Get user's win rate
     */
    function getUserWinRate(address user) external view returns (uint256) {
        UserStats memory stats = userStats[user];
        if (stats.totalBetsPlaced == 0) return 0;
        return (stats.totalBetsWon * 100) / stats.totalBetsPlaced;
    }
    
    /**
     * @dev Get user's favorite option
     */
    function getUserFavoriteOption(address user) external view returns (uint256) {
        return userStats[user].favoriteOption;
    }
    
    /**
     * @dev Get markets filtered by creator
     */
    function getMarketsByCreator(address creator) external view returns (uint256[] memory) {
        return userMarkets[creator];
    }
    
    /**
     * @dev Get markets filtered by token
     */
    function getMarketsByToken(address token) external view returns (uint256[] memory) {
        uint256[] memory filteredMarkets = new uint256[](0);
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            if (market.paymentToken == token) {
                // Add to filtered array (this is expensive, consider events)
                uint256[] memory temp = new uint256[](filteredMarkets.length + 1);
                for (uint256 j = 0; j < filteredMarkets.length; j++) {
                    temp[j] = filteredMarkets[j];
                }
                temp[filteredMarkets.length] = i;
                filteredMarkets = temp;
            }
        }
        return filteredMarkets;
    }
    
    /**
     * @dev Get active markets filtered by minimum volume
     */
    function getActiveMarketsByMinVolume(uint256 minVolume) external view returns (uint256[] memory) {
        uint256[] memory filteredMarkets = new uint256[](0);
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            if (market.state == EventPool.MarketState.Active && marketStats[i].totalVolume >= minVolume) {
                uint256[] memory temp = new uint256[](filteredMarkets.length + 1);
                for (uint256 j = 0; j < filteredMarkets.length; j++) {
                    temp[j] = filteredMarkets[j];
                }
                temp[filteredMarkets.length] = i;
                filteredMarkets = temp;
            }
        }
        return filteredMarkets;
    }
    
    /**
     * @dev Get markets filtered by state
     */
    function getMarketsByState(EventPool.MarketState state) external view returns (uint256[] memory) {
        uint256[] memory filteredMarkets = new uint256[](0);
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            if (market.state == state) {
                uint256[] memory temp = new uint256[](filteredMarkets.length + 1);
                for (uint256 j = 0; j < filteredMarkets.length; j++) {
                    temp[j] = filteredMarkets[j];
                }
                temp[filteredMarkets.length] = i;
                filteredMarkets = temp;
            }
        }
        return filteredMarkets;
    }
    
    /**
     * @dev Get markets filtered by date range
     */
    function getMarketsByDateRange(uint256 startTime, uint256 endTime) external view returns (uint256[] memory) {
        uint256[] memory filteredMarkets = new uint256[](0);
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            if (market.startTime >= startTime && market.startTime <= endTime) {
                uint256[] memory temp = new uint256[](filteredMarkets.length + 1);
                for (uint256 j = 0; j < filteredMarkets.length; j++) {
                    temp[j] = filteredMarkets[j];
                }
                temp[filteredMarkets.length] = i;
                filteredMarkets = temp;
            }
        }
        return filteredMarkets;
    }
    
    /**
     * @dev Get markets filtered by multiple criteria
     */
    function getMarketsFiltered(
        address creator,
        address token,
        uint256 minVolume,
        uint256 maxVolume,
        EventPool.MarketState state,
        uint256 startTime,
        uint256 endTime
    ) external view returns (uint256[] memory) {
        uint256[] memory filteredMarkets = new uint256[](0);
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            MarketStats memory stats = marketStats[i];
            
            bool matches = true;
            
            // Filter by creator
            if (creator != address(0) && market.creator != creator) {
                matches = false;
            }
            
            // Filter by token
            if (token != address(0) && market.paymentToken != token) {
                matches = false;
            }
            
            // Filter by volume range
            if (minVolume > 0 && stats.totalVolume < minVolume) {
                matches = false;
            }
            if (maxVolume > 0 && stats.totalVolume > maxVolume) {
                matches = false;
            }
            
            // Filter by state
            if (state != EventPool.MarketState.Active && market.state != state) {
                matches = false;
            }
            
            // Filter by date range
            if (startTime > 0 && market.startTime < startTime) {
                matches = false;
            }
            if (endTime > 0 && market.startTime > endTime) {
                matches = false;
            }
            
            if (matches) {
                uint256[] memory temp = new uint256[](filteredMarkets.length + 1);
                for (uint256 j = 0; j < filteredMarkets.length; j++) {
                    temp[j] = filteredMarkets[j];
                }
                temp[filteredMarkets.length] = i;
                filteredMarkets = temp;
            }
        }
        return filteredMarkets;
    }
    
    /**
     * @dev Get user's markets filtered by state
     */
    function getUserMarketsByState(address user, EventPool.MarketState state) external view returns (uint256[] memory) {
        uint256[] memory userMarketsList = userMarkets[user];
        uint256[] memory filteredMarkets = new uint256[](0);
        
        for (uint256 i = 0; i < userMarketsList.length; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(userMarketsList[i]);
            if (market.state == state) {
                uint256[] memory temp = new uint256[](filteredMarkets.length + 1);
                for (uint256 j = 0; j < filteredMarkets.length; j++) {
                    temp[j] = filteredMarkets[j];
                }
                temp[filteredMarkets.length] = userMarketsList[i];
                filteredMarkets = temp;
            }
        }
        return filteredMarkets;
    }
    
    /**
     * @dev Get active markets sorted by volume (descending)
     */
    function getActiveMarketsByVolume(uint256 limit) external view returns (uint256[] memory, uint256[] memory) {
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        uint256[] memory marketIds = new uint256[](0);
        uint256[] memory volumes = new uint256[](0);
        
        // Collect only ACTIVE markets
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            if (market.state == EventPool.MarketState.Active) {
                // Add to arrays
                uint256[] memory tempIds = new uint256[](marketIds.length + 1);
                uint256[] memory tempVolumes = new uint256[](volumes.length + 1);
                
                for (uint256 j = 0; j < marketIds.length; j++) {
                    tempIds[j] = marketIds[j];
                    tempVolumes[j] = volumes[j];
                }
                tempIds[marketIds.length] = i;
                tempVolumes[volumes.length] = marketStats[i].totalVolume;
                
                marketIds = tempIds;
                volumes = tempVolumes;
            }
        }
        
        // Simple bubble sort (expensive on-chain, consider off-chain)
        for (uint256 i = 0; i < marketIds.length - 1; i++) {
            for (uint256 j = 0; j < marketIds.length - i - 1; j++) {
                if (volumes[j] < volumes[j + 1]) {
                    // Swap volumes
                    uint256 tempVolume = volumes[j];
                    volumes[j] = volumes[j + 1];
                    volumes[j + 1] = tempVolume;
                    
                    // Swap market IDs
                    uint256 tempId = marketIds[j];
                    marketIds[j] = marketIds[j + 1];
                    marketIds[j + 1] = tempId;
                }
            }
        }
        
        // Return limited results
        uint256 resultLength = limit > 0 && limit < marketIds.length ? limit : marketIds.length;
        uint256[] memory resultIds = new uint256[](resultLength);
        uint256[] memory resultVolumes = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            resultIds[i] = marketIds[i];
            resultVolumes[i] = volumes[i];
        }
        
        return (resultIds, resultVolumes);
    }
    
    /**
     * @dev Get active markets by bettor count (most bettors)
     */
    function getActiveMarketsByBettorCount(uint256 limit) external view returns (uint256[] memory, uint256[] memory) {
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        uint256[] memory marketIds = new uint256[](0);
        uint256[] memory bettorCounts = new uint256[](0);
        
        // Collect only ACTIVE markets
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            if (market.state == EventPool.MarketState.Active) {
                uint256 bettorCount = EventPool(marketManager).getBettorCount(i);
                
                // Add to arrays
                uint256[] memory tempIds = new uint256[](marketIds.length + 1);
                uint256[] memory tempCounts = new uint256[](bettorCounts.length + 1);
                
                for (uint256 j = 0; j < marketIds.length; j++) {
                    tempIds[j] = marketIds[j];
                    tempCounts[j] = bettorCounts[j];
                }
                tempIds[marketIds.length] = i;
                tempCounts[bettorCounts.length] = bettorCount;
                
                marketIds = tempIds;
                bettorCounts = tempCounts;
            }
        }
        
        // Sort by bettor count (bubble sort)
        for (uint256 i = 0; i < marketIds.length - 1; i++) {
            for (uint256 j = 0; j < marketIds.length - i - 1; j++) {
                if (bettorCounts[j] < bettorCounts[j + 1]) {
                    // Swap counts
                    uint256 tempCount = bettorCounts[j];
                    bettorCounts[j] = bettorCounts[j + 1];
                    bettorCounts[j + 1] = tempCount;
                    
                    // Swap market IDs
                    uint256 tempId = marketIds[j];
                    marketIds[j] = marketIds[j + 1];
                    marketIds[j + 1] = tempId;
                }
            }
        }
        
        // Return limited results
        uint256 resultLength = limit > 0 && limit < marketIds.length ? limit : marketIds.length;
        uint256[] memory resultIds = new uint256[](resultLength);
        uint256[] memory resultCounts = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            resultIds[i] = marketIds[i];
            resultCounts[i] = bettorCounts[i];
        }
        
        return (resultIds, resultCounts);
    }
    
    /**
     * @dev Get active markets by total participants (bettors + supporters)
     */
    function getActiveMarketsByParticipants(uint256 limit) external view returns (uint256[] memory, uint256[] memory) {
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        uint256[] memory marketIds = new uint256[](0);
        uint256[] memory participantCounts = new uint256[](0);
        
        // Collect only ACTIVE markets
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            if (market.state == EventPool.MarketState.Active) {
                uint256 bettorCount = EventPool(marketManager).getBettorCount(i);
                uint256 supporterCount = EventPool(marketManager).getSupporterCount(i);
                uint256 totalParticipants = bettorCount + supporterCount;
                
                // Add to arrays
                uint256[] memory tempIds = new uint256[](marketIds.length + 1);
                uint256[] memory tempCounts = new uint256[](participantCounts.length + 1);
                
                for (uint256 j = 0; j < marketIds.length; j++) {
                    tempIds[j] = marketIds[j];
                    tempCounts[j] = participantCounts[j];
                }
                tempIds[marketIds.length] = i;
                tempCounts[participantCounts.length] = totalParticipants;
                
                marketIds = tempIds;
                participantCounts = tempCounts;
            }
        }
        
        // Sort by total participants (bubble sort)
        for (uint256 i = 0; i < marketIds.length - 1; i++) {
            for (uint256 j = 0; j < marketIds.length - i - 1; j++) {
                if (participantCounts[j] < participantCounts[j + 1]) {
                    // Swap counts
                    uint256 tempCount = participantCounts[j];
                    participantCounts[j] = participantCounts[j + 1];
                    participantCounts[j + 1] = tempCount;
                    
                    // Swap market IDs
                    uint256 tempId = marketIds[j];
                    marketIds[j] = marketIds[j + 1];
                    marketIds[j + 1] = tempId;
                }
            }
        }
        
        // Return limited results
        uint256 resultLength = limit > 0 && limit < marketIds.length ? limit : marketIds.length;
        uint256[] memory resultIds = new uint256[](resultLength);
        uint256[] memory resultCounts = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            resultIds[i] = marketIds[i];
            resultCounts[i] = participantCounts[i];
        }
        
        return (resultIds, resultCounts);
    }
    
    /**
     * @dev Get recent active markets (created within last N days)
     */
    function getRecentActiveMarkets(uint256 daysBack, uint256 limit) external view returns (uint256[] memory, uint256[] memory) {
        uint256 nextMarketId = EventPool(marketManager).getNextMarketId();
        uint256[] memory marketIds = new uint256[](0);
        uint256[] memory timestamps = new uint256[](0);
        
        uint256 cutoffTime = block.timestamp - (daysBack * 1 days);
        
        // Collect only ACTIVE markets created within the time period
        for (uint256 i = 1; i < nextMarketId; i++) {
            EventPool.Market memory market = EventPool(marketManager).getMarket(i);
            if (market.state == EventPool.MarketState.Active && market.startTime >= cutoffTime) {
                // Add to arrays
                uint256[] memory tempIds = new uint256[](marketIds.length + 1);
                uint256[] memory tempTimestamps = new uint256[](timestamps.length + 1);
                
                for (uint256 j = 0; j < marketIds.length; j++) {
                    tempIds[j] = marketIds[j];
                    tempTimestamps[j] = timestamps[j];
                }
                tempIds[marketIds.length] = i;
                tempTimestamps[timestamps.length] = market.startTime;
                
                marketIds = tempIds;
                timestamps = tempTimestamps;
            }
        }
        
        // Sort by creation time (newest first)
        for (uint256 i = 0; i < marketIds.length - 1; i++) {
            for (uint256 j = 0; j < marketIds.length - i - 1; j++) {
                if (timestamps[j] < timestamps[j + 1]) {
                    // Swap timestamps
                    uint256 tempTimestamp = timestamps[j];
                    timestamps[j] = timestamps[j + 1];
                    timestamps[j + 1] = tempTimestamp;
                    
                    // Swap market IDs
                    uint256 tempId = marketIds[j];
                    marketIds[j] = marketIds[j + 1];
                    marketIds[j + 1] = tempId;
                }
            }
        }
        
        // Return limited results
        uint256 resultLength = limit > 0 && limit < marketIds.length ? limit : marketIds.length;
        uint256[] memory resultIds = new uint256[](resultLength);
        uint256[] memory resultTimestamps = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            resultIds[i] = marketIds[i];
            resultTimestamps[i] = timestamps[i];
        }
        
        return (resultIds, resultTimestamps);
    }
    
    /**
     * @dev Get active markets created today
     */
    function getTodayActiveMarkets(uint256 limit) external view returns (uint256[] memory, uint256[] memory) {
        return this.getRecentActiveMarkets(1, limit);
    }
    
    /**
     * @dev Get active markets created this week
     */
    function getThisWeekActiveMarkets(uint256 limit) external view returns (uint256[] memory, uint256[] memory) {
        return this.getRecentActiveMarkets(7, limit);
    }
    
    /**
     * @dev Get top bettors by volume
     */
    function getTopBettors(uint256 limit) external view returns (address[] memory, uint256[] memory) {
        // This would require sorting, which is expensive on-chain
        // Consider implementing off-chain or with events
        address[] memory empty;
        uint256[] memory empty2;
        return (empty, empty2);
    }
}