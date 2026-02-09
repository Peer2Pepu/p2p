// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// EventPool: Main betting contract

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./P2PTreasury.sol";
import "./P2PAnalytics.sol";

interface IAdminManager {
    function supportedTokens(address) external view returns (bool);
    function tokenSymbols(address) external view returns (string memory);
    function blacklistedWallets(address) external view returns (bool);
    function isMarketDeleted(uint256) external view returns (bool);
    function minMarketDurationMinutes() external view returns (uint256);
    function bettingRestrictionEnabled() external view returns (bool);
    function bettingRestrictionMinutes() external view returns (uint256);
    function analytics() external view returns (address);
}

// UMA Optimistic Oracle V3 Interface
interface OptimisticOracleV3 {
    function assertTruth(
        bytes memory claim,
        address asserter,
        address callbackRecipient,
        address bondCurrency,
        uint256 bond,
        bytes32 identifier,
        uint64 liveness,
        bytes memory ancillaryData
    ) external returns (bytes32 assertionId);
    
    function getAssertion(bytes32 assertionId) external view returns (
        bytes32 claim,
        address asserter,
        address callbackRecipient,
        address bondCurrency,
        uint256 bond,
        uint64 settledAt,
        bool settled,
        bytes32 settlementResolution
    );
    
    function settleAndGetAssertionResult(bytes32 assertionId) external returns (bool);
}

// UMA Finder Interface
interface Finder {
    function getImplementationAddress(bytes32 interfaceName) external view returns (address);
}

// Price Feed Interface (Chainlink-compatible)
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function decimals() external view returns (uint8);
}

contract EventPool is Ownable {
    using SafeERC20 for IERC20;

    // Market states
    enum MarketState {
        Active,
        Ended,
        Resolved,
        Cancelled,
        Deleted
    }

    // Market types
    enum MarketType {
        PRICE_FEED,    // Resolves using on-chain price feed (no UMA)
        UMA_MANUAL     // Resolves via UMA Optimistic Oracle (sports/politics/etc)
    }

    // Market structure
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
        MarketType marketType;        // NEW: Market type
        address priceFeed;             // NEW: Price feed address (for PRICE_FEED markets)
        uint256 priceThreshold;        // NEW: Price threshold (for PRICE_FEED markets)
        bytes32 umaAssertionId;        // NEW: UMA assertion ID (for UMA_MANUAL markets)
        bool umaAssertionMade;         // NEW: Whether UMA assertion was made
    }

    // Market data
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => bool)) public userHasStaked;
    mapping(uint256 => mapping(address => bool)) public userHasSupported;
    mapping(uint256 => mapping(address => uint256)) public userStakeOptions;
    mapping(uint256 => address[]) public marketStakers;
    mapping(uint256 => address[]) public marketSupporters;
    
    // Contracts
    address payable public treasury;
    address public adminManager; // NEW: AdminManager contract
    
    // Market management
    uint256 public nextMarketId = 1;
    uint256 public constant marketCreationFee = 1000000000000000000;
    
    // Fee structure (in basis points)
    uint256 public constant CREATOR_FEE_BPS = 350;
    uint256 public constant PLATFORM_FEE_BPS = 500;
    // Note: VERIFIER_FEE_BPS removed - repurposed for UMA bonds if needed
    
    // Active market tracking
    uint256[] public activeMarkets;
    mapping(uint256 => bool) public isActiveMarket;
    
    // Stake history tracking
    mapping(address => uint256[]) public userMarketHistory;
    
    // UMA Configuration
    address public optimisticOracle;    // UMA OptimisticOracleV3 address
    address public finder;              // UMA Finder address
    address public defaultBondCurrency; // Currency for UMA bonds (P2P token)
    uint256 public defaultBond;         // Default bond amount
    uint64 public defaultLiveness;     // Default liveness period (e.g., 2 hours = 7200)
    bytes32 public defaultIdentifier;   // UMA identifier (e.g., "ASSERT_TRUTH")
    
    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string ipfsHash,
        bool isMultiOption,
        uint256 maxOptions,
        address paymentToken,
        uint256 minStake,
        uint256 startTime,
        uint256 stakeEndTime,
        uint256 endTime,
        uint256 resolutionEndTime
    );
    
    event StakePlaced(
        uint256 indexed marketId,
        address indexed user,
        uint256 option,
        uint256 amount
    );
    
    event MarketResolved(uint256 indexed marketId, uint256 winningOption);
    event MarketCancelled(uint256 indexed marketId, string reason);
    event RefundClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event ResolutionRequested(uint256 indexed marketId, bytes32 indexed assertionId);
    event UMAResolutionSettled(uint256 indexed marketId, bytes32 indexed assertionId, bool outcome);

    constructor(
        address initialOwner,
        address payable _treasury,
        address _adminManager
    ) Ownable(initialOwner) {
        treasury = _treasury;
        adminManager = _adminManager;
    }

    // ============ MODIFIERS ============
    
    modifier notBlacklisted() {
        require(!IAdminManager(adminManager).blacklistedWallets(msg.sender), "EP: Wallet blacklisted");
        _;
    }
    
    modifier notDeleted(uint256 marketId) {
        require(!IAdminManager(adminManager).isMarketDeleted(marketId), "EP: Market deleted");
        _;
    }

    /**
     * @dev Create a new market
     * @param marketType 0 = PRICE_FEED, 1 = UMA_MANUAL
     * @param priceFeed Address of price feed (required for PRICE_FEED markets, ignored for UMA_MANUAL)
     * @param priceThreshold Price threshold in USD (scaled by feed decimals, required for PRICE_FEED markets)
     */
    function createMarket(
        string memory ipfsHash,
        bool isMultiOption,
        uint256 maxOptions,
        address paymentToken,
        uint256 minStake,
        uint256 creatorDeposit,
        uint256 creatorOutcome,
        uint256 stakeDurationMinutes,
        uint256 resolutionDurationMinutes,
        MarketType marketType,
        address priceFeed,
        uint256 priceThreshold
    ) external payable notBlacklisted returns (uint256) {
        require(bytes(ipfsHash).length > 0, "EP: Invalid hash");
        require(maxOptions >= 2 && maxOptions <= 10, "EP: Invalid options");
        require(minStake > 0, "EP: Invalid stake");
        require(creatorDeposit > 0, "EP: Invalid deposit");
        require(creatorOutcome > 0 && creatorOutcome <= maxOptions, "EP: Invalid outcome");
        
        // Validate market type specific requirements
        if (marketType == MarketType.PRICE_FEED) {
            require(priceFeed != address(0), "EP: Price feed required");
            require(priceThreshold > 0, "EP: Price threshold required");
        }
        
        // Get settings from AdminManager
        uint256 minDuration = IAdminManager(adminManager).minMarketDurationMinutes();
        require(stakeDurationMinutes >= minDuration, "EP: Min duration");
        require(resolutionDurationMinutes >= stakeDurationMinutes, "EP: Resolution after stake");
        
        // Validate payment token via AdminManager
        if (isMultiOption) {
            require(paymentToken != address(0), "EP: Multi-option needs P2P token");
            require(IAdminManager(adminManager).supportedTokens(paymentToken), "EP: Token not supported");
        } else {
            if (paymentToken != address(0)) {
                require(IAdminManager(adminManager).supportedTokens(paymentToken), "EP: Token not supported");
            }
        }
        
        // Pay market creation fee
        require(msg.value >= marketCreationFee, "EP: Insufficient fee");
        
        // Calculate timestamps
        uint256 startTime = block.timestamp;
        uint256 stakeEndTime = startTime + (stakeDurationMinutes * 1 minutes);
        uint256 endTime = startTime + (resolutionDurationMinutes * 1 minutes);
        // For PRICE_FEED markets, resolution can happen immediately after endTime
        // For UMA_MANUAL markets, add 48 hours buffer for dispute period
        uint256 resolutionEndTime = marketType == MarketType.PRICE_FEED ? endTime : endTime + 48 hours;
        
        // Create market
        uint256 marketId = nextMarketId++;
        markets[marketId] = Market({
            creator: msg.sender,
            ipfsHash: ipfsHash,
            isMultiOption: isMultiOption,
            maxOptions: maxOptions,
            paymentToken: paymentToken,
            minStake: minStake,
            creatorDeposit: creatorDeposit,
            creatorOutcome: creatorOutcome,
            startTime: startTime,
            stakeEndTime: stakeEndTime,
            endTime: endTime,
            resolutionEndTime: resolutionEndTime,
            state: MarketState.Active,
            winningOption: 0,
            isResolved: false,
            marketType: marketType,
            priceFeed: priceFeed,
            priceThreshold: priceThreshold,
            umaAssertionId: bytes32(0),
            umaAssertionMade: false
        });
        
        // Add to active markets
        activeMarkets.push(marketId);
        isActiveMarket[marketId] = true;
        
        // Transfer creator deposit and send fee to owner
        if (paymentToken == address(0)) {
            require(msg.value >= marketCreationFee + creatorDeposit, "EP: Insufficient PEPU");
            (bool success, ) = owner().call{value: marketCreationFee}("");
            require(success, "EP: Fee transfer to owner failed");
            (bool treasurySuccess, ) = treasury.call{value: creatorDeposit}("");
            require(treasurySuccess, "EP: Creator deposit transfer to Treasury failed");
        } else {
            require(msg.value >= marketCreationFee, "EP: Insufficient PEPU for creation fee");
            (bool success, ) = owner().call{value: marketCreationFee}("");
            require(success, "EP: Fee transfer to owner failed");
            IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, creatorDeposit);
        }

        // Creator's deposit becomes their stake
        userHasStaked[marketId][msg.sender] = true;
        userStakeOptions[marketId][msg.sender] = creatorOutcome;
        userMarketHistory[msg.sender].push(marketId);
        
        // Call Treasury to handle creator's stake
        PoolVault(treasury).placeStake(marketId, msg.sender, paymentToken, creatorDeposit, creatorOutcome);
        
        // Track analytics (get address from AdminManager)
        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) {
            MetricsHub(analytics).trackMarketCreation(marketId, msg.sender);
            MetricsHub(analytics).trackStake(marketId, msg.sender, creatorOutcome, creatorDeposit);
        }
        
        emit MarketCreated(
            marketId,
            msg.sender,
            ipfsHash,
            isMultiOption,
            maxOptions,
            paymentToken,
            minStake,
            startTime,
            stakeEndTime,
            endTime,
            resolutionEndTime
        );
        
        return marketId;
    }

    /**
     * @dev Place a bet on a specific option (for PEPU markets)
     */
    function placeStake(uint256 marketId, uint256 option) external payable notDeleted(marketId) {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "EP: Not active");
        
        // Check betting restriction from AdminManager
        if (IAdminManager(adminManager).bettingRestrictionEnabled()) {
            uint256 restrictionMinutes = IAdminManager(adminManager).bettingRestrictionMinutes();
            require(block.timestamp < market.stakeEndTime - (restrictionMinutes * 1 minutes), "EP: Staking period ended");
        }
        
        require(option > 0 && option <= market.maxOptions, "EP: Bad option");
        require(market.paymentToken == address(0), "EP: This market uses tokens, use placeBetWithToken");
        
        uint256 amount = msg.value;
        require(amount >= market.minStake, "EP: Below min");
        
        // Transfer ETH to Treasury first
        (bool success, ) = treasury.call{value: amount}("");
        require(success, "EP: ETH transfer to Treasury failed");
        
        // Update user stake tracking
        if (!userHasStaked[marketId][msg.sender]) {
            marketStakers[marketId].push(msg.sender);
            userMarketHistory[msg.sender].push(marketId);
        }
        userHasStaked[marketId][msg.sender] = true;
        userStakeOptions[marketId][msg.sender] = option;
        
        // Call Treasury to handle funds accounting
        PoolVault(treasury).placeStake(marketId, msg.sender, market.paymentToken, amount, option);
        
        // Track analytics
        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) {
            MetricsHub(analytics).trackStake(marketId, msg.sender, option, amount);
        }
        
        emit StakePlaced(marketId, msg.sender, option, amount);
    }

    /**
     * @dev Place a bet on a specific option (for token markets)
     */
    function placeStakeWithToken(uint256 marketId, uint256 option, uint256 amount) external notDeleted(marketId) {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "EP: Not active");
        
        if (IAdminManager(adminManager).bettingRestrictionEnabled()) {
            uint256 restrictionMinutes = IAdminManager(adminManager).bettingRestrictionMinutes();
            require(block.timestamp < market.stakeEndTime - (restrictionMinutes * 1 minutes), "EP: Staking period ended");
        }
        
        require(option > 0 && option <= market.maxOptions, "EP: Bad option");
        require(market.paymentToken != address(0), "EP: This market uses PEPU, use placeBet");
        require(amount >= market.minStake, "EP: Below min");
        
        // Transfer tokens to Treasury
        IERC20(market.paymentToken).safeTransferFrom(msg.sender, treasury, amount);
        
        // Update user stake tracking
        if (!userHasStaked[marketId][msg.sender]) {
            marketStakers[marketId].push(msg.sender);
            userMarketHistory[msg.sender].push(marketId);
        }
        userHasStaked[marketId][msg.sender] = true;
        userStakeOptions[marketId][msg.sender] = option;
        
        // Call Treasury to handle funds
        PoolVault(treasury).placeStake(marketId, msg.sender, market.paymentToken, amount, option);
        
        // Track analytics
        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) {
            MetricsHub(analytics).trackStake(marketId, msg.sender, option, amount);
        }
        
        emit StakePlaced(marketId, msg.sender, option, amount);
    }

    /**
     * @dev Support a market without betting on any option
     */
    function supportMarket(uint256 marketId, uint256 amount) external payable notBlacklisted notDeleted(marketId) {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "EP: Not active");
        require(block.timestamp < market.stakeEndTime, "EP: Support period ended");
        require(amount > 0, "EP: Support amount must be greater than 0");
        
        if (market.paymentToken == address(0)) {
            require(msg.value == amount, "EP: Incorrect ETH amount");
            require(msg.value > 0, "EP: Support amount must be greater than 0");
            
            (bool success, ) = treasury.call{value: msg.value}("");
            require(success, "EP: ETH transfer to treasury failed");
        } else {
            require(msg.value == 0, "EP: No ETH should be sent for token support");
            IERC20(market.paymentToken).safeTransferFrom(msg.sender, treasury, amount);
        }
        
        if (!userHasSupported[marketId][msg.sender]) {
            marketSupporters[marketId].push(msg.sender);
        }
        userHasSupported[marketId][msg.sender] = true;
        
        PoolVault(treasury).supportMarket(marketId, msg.sender, market.paymentToken, amount);
        
        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) {
            MetricsHub(analytics).trackSupport(marketId, msg.sender, amount);
        }
    }

    /**
     * @dev Withdraw support from a market
     */
    function withdrawSupport(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(userHasSupported[marketId][msg.sender], "EP: No support to withdraw");
        
        if (market.state == MarketState.Active) {
            require(block.timestamp < market.stakeEndTime - 12 hours, "EP: Cannot withdraw within 12 hours of staking end");
        } else if (market.state == MarketState.Deleted || market.state == MarketState.Cancelled) {
            // Can withdraw anytime
        } else {
            revert("EP: Cannot withdraw in current market state");
        }
        
        uint256 supportAmount = PoolVault(treasury).getUserSupport(marketId, msg.sender, market.paymentToken);
        require(supportAmount > 0, "EP: No support to withdraw");
        
        PoolVault(treasury).withdrawSupport(marketId, msg.sender, market.paymentToken, supportAmount);
        userHasSupported[marketId][msg.sender] = false;
    }

    /**
     * @dev End the betting period
     */
    function endMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "EP: Not active");
        require(block.timestamp >= market.endTime, "EP: Resolution time not reached");
        
        market.state = MarketState.Ended;
        
        if (isActiveMarket[marketId]) {
            _removeFromActiveMarkets(marketId);
        }
    }

    /**
     * @dev Resolve price feed market directly (no UMA needed)
     * Reads price from on-chain feed and resolves immediately
     */
    function resolvePriceFeedMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.marketType == MarketType.PRICE_FEED, "EP: Not price feed");
        require(market.state == MarketState.Ended, "EP: Not ended");
        require(!market.isResolved, "EP: Resolved");
        require(block.timestamp >= market.resolutionEndTime, "EP: Too early to resolve");
        
        // Read price directly from on-chain feed
        AggregatorV3Interface feed = AggregatorV3Interface(market.priceFeed);
        (, int256 price, , , ) = feed.latestRoundData();
        uint256 currentPrice = uint256(price);
        
        // Determine outcome: Option 1 wins if price >= threshold, else Option 2 wins
        // For binary markets: option 1 = YES, option 2 = NO
        market.winningOption = currentPrice >= market.priceThreshold ? 1 : 2;
        market.isResolved = true;
        market.state = MarketState.Resolved;
        
        _distributeFees(marketId);
        
        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) {
            MetricsHub(analytics).trackMarketResolution(marketId, market.winningOption);
        }
        
        emit MarketResolved(marketId, market.winningOption);
    }

    /**
     * @dev Request resolution via UMA Optimistic Oracle (for UMA_MANUAL markets)
     * @param claim The claim bytes to assert to UMA (e.g., "Team A won the game")
     */
    function requestUMAResolution(uint256 marketId, bytes memory claim) external {
        Market storage market = markets[marketId];
        require(market.marketType == MarketType.UMA_MANUAL, "EP: Not UMA");
        require(market.state == MarketState.Ended, "EP: Not ended");
        require(!market.isResolved, "EP: Resolved");
        require(block.timestamp >= market.resolutionEndTime, "EP: Too early");
        require(!market.umaAssertionMade, "EP: Assertion made");
        require(optimisticOracle != address(0), "EP: OO not set");
        require(defaultBondCurrency != address(0), "EP: Bond not set");
        
        // Make assertion to UMA
        bytes32 assertionId = OptimisticOracleV3(optimisticOracle).assertTruth(
            claim,
            msg.sender,                    // asserter
            address(this),                 // callback recipient
            defaultBondCurrency,           // bond currency
            defaultBond,                   // bond amount
            defaultIdentifier,             // identifier
            defaultLiveness,               // liveness period
            abi.encode(marketId)           // ancillary data (market ID)
        );
        
        market.umaAssertionId = assertionId;
        market.umaAssertionMade = true;
        
        emit ResolutionRequested(marketId, assertionId);
    }

    /**
     * @dev Settle market after UMA assertion is resolved
     * Called after liveness period expires (or manually)
     * @param winningOption The winning option (1-based)
     */
    function settleUMAMarket(uint256 marketId, uint256 winningOption) external {
        Market storage market = markets[marketId];
        require(market.marketType == MarketType.UMA_MANUAL, "EP: Not UMA");
        require(market.umaAssertionMade, "EP: No assertion made");
        require(!market.isResolved, "EP: Resolved");
        require(winningOption > 0 && winningOption <= market.maxOptions, "EP: Invalid option");
        
        // Get assertion result from UMA
        bool assertionResult = OptimisticOracleV3(optimisticOracle)
            .settleAndGetAssertionResult(market.umaAssertionId);
        
        // For binary markets: assertionResult = true means option 1 wins
        // For multi-option: winningOption must be provided and validated
        if (market.maxOptions == 2) {
            // Binary market: assertionResult determines outcome
            market.winningOption = assertionResult ? 1 : 2;
        } else {
            // Multi-option: use provided winningOption
            require(assertionResult, "EP: UMA assertion rejected");
            market.winningOption = winningOption;
        }
        
        market.isResolved = true;
        market.state = MarketState.Resolved;
        
        _distributeFees(marketId);
        
        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) {
            MetricsHub(analytics).trackMarketResolution(marketId, market.winningOption);
        }
        
        emit MarketResolved(marketId, market.winningOption);
        emit UMAResolutionSettled(marketId, market.umaAssertionId, assertionResult);
    }

    /**
     * @dev Cancel market (anyone can call after resolution period)
     */
    function cancelMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Ended, "EP: Not ended");
        require(block.timestamp >= market.resolutionEndTime, "EP: Resolution period not ended");
        require(!market.isResolved, "EP: Resolved");
        
        _cancelMarket(marketId, "Resolution period expired");
    }

    /**
     * @dev Creator can cancel market (up to 12 hours before end)
     */
    function creatorCancelMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(msg.sender == market.creator, "EP: Only creator can cancel");
        require(market.state == MarketState.Active, "EP: Not active");
        require(block.timestamp < market.stakeEndTime - 12 hours, "EP: Too late to cancel");
        
        _cancelMarket(marketId, "Creator cancelled");
    }

    /**
     * @dev Claim refunds for cancelled market
     */
    function claimRefund(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Cancelled, "EP: Market not cancelled");
        require(userHasStaked[marketId][msg.sender] || userHasSupported[marketId][msg.sender], "EP: No stake to refund");
        
        uint256 refundAmount = 0;
        
        if (userHasStaked[marketId][msg.sender]) {
            uint256 stakeAmount = PoolVault(treasury).getUserStake(marketId, msg.sender, market.paymentToken);
            refundAmount += stakeAmount;
            userHasStaked[marketId][msg.sender] = false;
        }
        
        if (userHasSupported[marketId][msg.sender]) {
            uint256 supportAmount = PoolVault(treasury).getUserSupport(marketId, msg.sender, market.paymentToken);
            refundAmount += supportAmount;
            userHasSupported[marketId][msg.sender] = false;
        }
        
        require(refundAmount > 0, "EP: No refund available");
        
        PoolVault(treasury).claimRefund(marketId, msg.sender, market.paymentToken, refundAmount);
        emit RefundClaimed(marketId, msg.sender, refundAmount);
    }

    /**
     * @dev Calculate winnings for a user without claiming
     */
    function calculateWinnings(uint256 marketId, address user) external view returns (uint256) {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Resolved, "EP: Not resolved");
        require(market.winningOption > 0, "EP: No winner");
        require(userHasStaked[marketId][user], "EP: No stake placed");
        require(!PoolVault(treasury).hasUserClaimed(marketId, user), "EP: Already claimed");
        
        uint256 userStake = PoolVault(treasury).getUserStake(marketId, user, market.paymentToken);
        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, market.winningOption, market.paymentToken);
        
        uint256 totalLosingPool = 0;
        for (uint256 i = 1; i <= market.maxOptions; i++) {
            if (i != market.winningOption) {
                totalLosingPool += PoolVault(treasury).getOptionPool(marketId, i, market.paymentToken);
            }
        }
        
        uint256 supportPool = PoolVault(treasury).getSupportPool(marketId, market.paymentToken);
        totalLosingPool += supportPool;
        
        uint256 userWinnings;
        
        if (totalWinningStake == 0) {
            userWinnings = 0;
        } else if (totalLosingPool == 0) {
            bool isWinningStake = userStakeOptions[marketId][user] == market.winningOption;
            
            if (isWinningStake) {
                userWinnings = userStake;
            } else {
                userWinnings = 0;
            }
        } else {
            bool isWinningStake = userStakeOptions[marketId][user] == market.winningOption;
            
            if (isWinningStake) {
                uint256 winningsPool = (totalLosingPool * 9000) / 10000;
                userWinnings = userStake + (userStake * winningsPool) / totalWinningStake;
            } else {
                userWinnings = 0;
            }
        }
        
        return userWinnings;
    }

    /**
     * @dev Claim winnings for resolved market
     */
    function claimWinnings(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Resolved, "EP: Not resolved");
        require(market.winningOption > 0, "EP: No winner");
        require(userHasStaked[marketId][msg.sender], "EP: No stake");
        require(!PoolVault(treasury).hasUserClaimed(marketId, msg.sender), "EP: Claimed");
        
        uint256 userStake = PoolVault(treasury).getUserStake(marketId, msg.sender, market.paymentToken);
        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, market.winningOption, market.paymentToken);
        
        uint256 totalLosingPool = 0;
        for (uint256 i = 1; i <= market.maxOptions; i++) {
            if (i != market.winningOption) {
                totalLosingPool += PoolVault(treasury).getOptionPool(marketId, i, market.paymentToken);
            }
        }
        
        uint256 supportPool = PoolVault(treasury).getSupportPool(marketId, market.paymentToken);
        totalLosingPool += supportPool;
        
        uint256 userWinnings;
        
        if (totalWinningStake == 0) {
            userWinnings = 0;
        } else if (totalLosingPool == 0) {
            bool isWinningStake = userStakeOptions[marketId][msg.sender] == market.winningOption;
            
            if (isWinningStake) {
                userWinnings = userStake;
            } else {
                userWinnings = 0;
            }
        } else {
            bool isWinningStake = userStakeOptions[marketId][msg.sender] == market.winningOption;
            
            if (isWinningStake) {
                uint256 winningsPool = (totalLosingPool * 9000) / 10000;
                userWinnings = userStake + (userStake * winningsPool) / totalWinningStake;
            } else {
                userWinnings = 0;
            }
        }
        
        PoolVault(treasury).claimWinnings(marketId, msg.sender, market.paymentToken, userWinnings);
        
        emit WinningsClaimed(marketId, msg.sender, userWinnings);
    }

    /**
     * @dev Internal function to cancel market
     */
    function _cancelMarket(uint256 marketId, string memory reason) internal {
        markets[marketId].state = MarketState.Cancelled;
        emit MarketCancelled(marketId, reason);
    }


    /**
     * @dev Internal function to distribute platform fees to treasury
     */
    function _distributeFees(uint256 marketId) internal {
        Market storage market = markets[marketId];
        
        uint256 totalLosingPool = 0;
        for (uint256 i = 1; i <= market.maxOptions; i++) {
            if (i != market.winningOption) {
                totalLosingPool += PoolVault(treasury).getOptionPool(marketId, i, market.paymentToken);
            }
        }
        
        uint256 supportPool = PoolVault(treasury).getSupportPool(marketId, market.paymentToken);
        totalLosingPool += supportPool;
        
        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, market.winningOption, market.paymentToken);
        uint256 totalPool = PoolVault(treasury).getMarketPool(marketId, market.paymentToken);
        
        uint256 creatorFee = (totalPool * CREATOR_FEE_BPS) / 10000;
        uint256 platformFee = (totalPool * PLATFORM_FEE_BPS) / 10000;
        
        if (totalWinningStake == 0) {
            // All lose scenario - Creator gets fee, platform gets the rest
            uint256 totalFees = creatorFee + platformFee;
            uint256 remainingForPlatform = totalPool - totalFees;
            
            if (creatorFee > 0) {
                PoolVault(treasury).transferToCreator(market.creator, market.paymentToken, creatorFee);
            }
            
            uint256 totalPlatformAmount = platformFee + remainingForPlatform;
            if (totalPlatformAmount > 0) {
                PoolVault(treasury).addToPlatformPool(market.paymentToken, totalPlatformAmount);
            }
        } else if (totalLosingPool == 0) {
            // All win scenario - No fees
            // Everyone gets their stakes back completely
        } else {
            // Normal scenario - Fees from losing pool
            if (creatorFee > 0) {
                PoolVault(treasury).transferToCreator(market.creator, market.paymentToken, creatorFee);
            }
            
            if (platformFee > 0) {
                PoolVault(treasury).distributeFees(market.paymentToken, platformFee);
            }
        }
    }

    /**
     * @dev Internal function to remove market from active list
     */
    function _removeFromActiveMarkets(uint256 marketId) internal {
        for (uint256 i = 0; i < activeMarkets.length; i++) {
            if (activeMarkets[i] == marketId) {
                activeMarkets[i] = activeMarkets[activeMarkets.length - 1];
                activeMarkets.pop();
                isActiveMarket[marketId] = false;
                break;
            }
        }
    }

    // ============ ADMIN FUNCTIONS (DELEGATED TO ADMINMANAGER) ============
    
    /**
     * @dev Update AdminManager address (one-time or emergency)
     */
    function setAdminManager(address _adminManager) external onlyOwner {
        require(_adminManager != address(0), "EP: Bad addr");
        adminManager = _adminManager;
    }
    
    /**
     * @dev Mark market as deleted (only callable by AdminManager)
     */
    function markMarketDeleted(uint256 marketId) external {
        require(msg.sender == adminManager, "EP: Only AdminManager");
        require(marketId < nextMarketId, "EP: Bad ID");
        require(markets[marketId].creator != address(0), "EP: No market");
        require(markets[marketId].state != MarketState.Deleted, "EP: Already deleted");
        
        markets[marketId].state = MarketState.Deleted;
        
        // Remove from active markets list
        if (isActiveMarket[marketId]) {
            _removeFromActiveMarkets(marketId);
        }
        
        emit MarketCancelled(marketId, "Market deleted by admin");
    }
    
    /**
     * @dev Mark market as permanently removed (only callable by AdminManager)
     */
    function markMarketPermanentlyRemoved(uint256 marketId) external {
        require(msg.sender == adminManager, "EP: Only AdminManager");
        require(marketId < nextMarketId, "EP: Bad ID");
        require(markets[marketId].creator != address(0), "EP: No market");
        require(markets[marketId].state == MarketState.Resolved, "EP: Market not resolved");
        
        // Clear market data
        delete markets[marketId];
        
        // Remove from active markets if still there
        if (isActiveMarket[marketId]) {
            _removeFromActiveMarkets(marketId);
        }
        
        emit MarketCancelled(marketId, "Permanently removed after claim period");
    }

    // ============ UMA CONFIGURATION FUNCTIONS ============
    
    /**
     * @dev Set UMA Finder address (auto-updates OptimisticOracle from Finder)
     */
    function setFinder(address _finder) external onlyOwner {
        require(_finder != address(0), "EP: Invalid Finder address");
        finder = _finder;
        
        // Auto-update OptimisticOracle from Finder
        // UMA uses keccak256(abi.encodePacked("OptimisticOracleV3"))
        bytes32 interfaceName = keccak256(abi.encodePacked("OptimisticOracleV3"));
        optimisticOracle = Finder(_finder).getImplementationAddress(interfaceName);
        require(optimisticOracle != address(0), "EP: OptimisticOracle not found in Finder");
    }
    
    /**
     * @dev Set Finder address without lookup (if lookup fails)
     */
    function setFinderOnly(address _finder) external onlyOwner {
        require(_finder != address(0), "EP: Invalid Finder address");
        finder = _finder;
    }
    
    /**
     * @dev Set OptimisticOracle address directly (if not using Finder)
     */
    function setOptimisticOracle(address _oo) external onlyOwner {
        require(_oo != address(0), "EP: Invalid OptimisticOracle address");
        optimisticOracle = _oo;
    }
    
    /**
     * @dev Set default bond currency and amount for UMA assertions
     */
    function setDefaultBond(address _currency, uint256 _amount) external onlyOwner {
        require(_currency != address(0), "EP: Invalid bond currency");
        defaultBondCurrency = _currency;
        defaultBond = _amount;
    }
    
    /**
     * @dev Set default liveness period for UMA assertions (in seconds)
     */
    function setDefaultLiveness(uint64 _liveness) external onlyOwner {
        require(_liveness > 0, "EP: Invalid liveness");
        defaultLiveness = _liveness;
    }
    
    /**
     * @dev Set default identifier for UMA assertions
     */
    function setDefaultIdentifier(bytes32 _identifier) external onlyOwner {
        defaultIdentifier = _identifier;
    }

    // ============ VIEW FUNCTIONS ============
    
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getUserStake(uint256 marketId, address user, address token) external view returns (uint256) {
        return PoolVault(treasury).getUserStake(marketId, user, token);
    }

    function getOptionPool(uint256 marketId, uint256 option, address token) external view returns (uint256) {
        return PoolVault(treasury).getOptionPool(marketId, option, token);
    }

    function getTotalPool(uint256 marketId, address token) external view returns (uint256) {
        return PoolVault(treasury).getMarketPool(marketId, token);
    }

    function getSupportPool(uint256 marketId, address token) external view returns (uint256) {
        return PoolVault(treasury).getSupportPool(marketId, token);
    }

    function getUserSupport(uint256 marketId, address user, address token) external view returns (uint256) {
        return PoolVault(treasury).getUserSupport(marketId, user, token);
    }

    function getSupporterCount(uint256 marketId) external view returns (uint256) {
        return marketSupporters[marketId].length;
    }

    function getStakerCount(uint256 marketId) external view returns (uint256) {
        return marketStakers[marketId].length;
    }

    function getMarketStakers(uint256 marketId) external view returns (address[] memory) {
        return marketStakers[marketId];
    }

    /**
     * @dev Get comprehensive market information
     */
    function getMarketInfo(uint256 marketId) external view returns (
        Market memory market,
        uint256 totalPool,
        uint256 supportPool,
        uint256 stakerCount,
        uint256 supporterCount,
        address[] memory stakers,
        address[] memory supporters,
        string memory tokenSymbol
    ) {
        market = markets[marketId];
        totalPool = PoolVault(treasury).getMarketPool(marketId, market.paymentToken);
        supportPool = PoolVault(treasury).getSupportPool(marketId, market.paymentToken);
        stakerCount = marketStakers[marketId].length;
        supporterCount = marketSupporters[marketId].length;
        stakers = marketStakers[marketId];
        supporters = marketSupporters[marketId];
        tokenSymbol = IAdminManager(adminManager).tokenSymbols(market.paymentToken);
    }

    function getNextMarketId() external view returns (uint256) {
        return nextMarketId;
    }
    
    // Removed some view functions to reduce contract size - can be computed off-chain


    receive() external payable {}
}