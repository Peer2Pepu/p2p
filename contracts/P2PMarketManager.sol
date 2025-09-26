// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ✅ COPY THIS FILE - Fixed EventPool with proper fee distribution for "everyone loses" scenarios

// ✅ COPY THIS FILE - Fixed EventPool with proper fee distribution for "everyone loses" scenarios

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./P2PTreasury.sol";
import "./P2PVerification.sol";
import "./P2PAnalytics.sol";

contract EventPool is Ownable {
    using SafeERC20 for IERC20;

    // Market states
    enum MarketState {
        Active,     // Market is active, users can bet
        Ended,      // Betting period ended, resolution period
        Resolved,   // Market resolved with winning option
        Cancelled,  // Market cancelled, refunds available
        Deleted     // Market deleted, refunds still claimable
    }

    // Market structure
    struct Market {
        address creator;
        string ipfsHash;           // IPFS hash for title/description
        bool isMultiOption;        // true for multi-option, false for linear
        uint256 maxOptions;        // 2 for linear, up to 10 for multi-option
        address paymentToken;      // address(0) for native ETH, or ERC20 address
        uint256 minStake;          // Minimum stake required
        uint256 creatorDeposit;    // Creator's deposit amount
        uint256 creatorOutcome;    // Creator's predicted outcome
        uint256 startTime;         // Market start time
        uint256 endTime;           // Betting end time
        uint256 resolutionEndTime; // Resolution period end time
        MarketState state;
        uint256 winningOption;
        bool isResolved;
    }

    // Market data
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => bool)) public userHasBet; // marketId => user => has bet
    mapping(uint256 => mapping(address => bool)) public userHasSupported; // marketId => user => has supported
    mapping(uint256 => mapping(address => uint256)) public userBetOptions; // marketId => user => option
    mapping(uint256 => address[]) public marketBettors; // marketId => array of bettor addresses
    mapping(uint256 => address[]) public marketSupporters; // marketId => array of supporter addresses
    mapping(address => bool) public supportedTokens;
    mapping(address => string) public tokenSymbols; // token address => symbol
    address[] public supportedTokenList; // Array to track supported tokens
    mapping(address => bool) public blacklistedWallets;
    
    // Treasury, Verification, and Analytics contracts
    address payable public treasury;
    address public verification;
    address public analytics;
    
    // Market management
    uint256 public nextMarketId = 1;
    uint256 public marketCreationFee;
    
    // Settable parameters
    uint256 public minMarketDurationMinutes = 5; // Default 5 minutes
    bool public bettingRestrictionEnabled = false; // Default false (no restriction)
    uint256 public bettingRestrictionMinutes = 5; // If enabled, restrict betting in last X minutes
    
    // Active market tracking
    uint256[] public activeMarkets;
    mapping(uint256 => bool) public isActiveMarket;
    
    // Stake history tracking (for resolved markets)
    mapping(address => uint256[]) public userMarketHistory; // user => array of marketIds they participated in
    
    // Deletion tracking
    uint256[] public deletedMarkets; // Markets marked for deletion
    mapping(uint256 => uint256) public deletionTimestamp; // marketId => deletion time
    uint256[] public permanentlyRemovedMarkets; // Markets permanently removed
    
    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string ipfsHash,
        bool isMultiOption,
        uint256 maxOptions,
        address paymentToken,
        uint256 minStake
    );
    
    event BetPlaced(
        uint256 indexed marketId,
        address indexed user,
        uint256 option,
        uint256 amount
    );
    
    event MarketEnded(uint256 indexed marketId, uint256 endTime);
    event MarketResolved(uint256 indexed marketId, uint256 winningOption);
    event MarketCancelled(uint256 indexed marketId, string reason);
    
    event RefundClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event MarketSupported(uint256 indexed marketId, address indexed supporter, uint256 amount);
    event SupportWithdrawn(uint256 indexed marketId, address indexed supporter, uint256 amount);
    event SupportRewardClaimed(uint256 indexed marketId, address indexed supporter, uint256 amount);

    constructor(
        address initialOwner,
        address payable _treasury,
        address _verification,
        address _analytics,
        uint256 _marketCreationFee
    ) Ownable(initialOwner) {
        treasury = _treasury;
        verification = _verification;
        analytics = _analytics;
        marketCreationFee = _marketCreationFee;
        
        // Set native PEPU token symbol and add to supported list
        tokenSymbols[address(0)] = "PEPU";
        supportedTokens[address(0)] = true;
        supportedTokenList.push(address(0));
    }

    /**
     * @dev Create a new market
     */
    function createMarket(
        string memory ipfsHash,
        bool isMultiOption,
        uint256 maxOptions,
        address paymentToken,
        uint256 minStake,
        uint256 creatorDeposit,
        uint256 creatorOutcome,
        uint256 durationMinutes
    ) external payable returns (uint256) {
        require(!blacklistedWallets[msg.sender], "MarketManager: Wallet blacklisted");
        require(bytes(ipfsHash).length > 0, "MarketManager: Invalid IPFS hash");
        require(maxOptions >= 2 && maxOptions <= 10, "MarketManager: Invalid max options");
        require(minStake > 0, "MarketManager: Invalid min stake");
        require(creatorDeposit > 0, "MarketManager: Invalid creator deposit");
        require(creatorOutcome > 0 && creatorOutcome <= maxOptions, "MarketManager: Invalid creator outcome");
        require(durationMinutes >= minMarketDurationMinutes, "MarketManager: Below minimum duration");
        
        // Validate payment token
        if (isMultiOption) {
            require(paymentToken != address(0), "MarketManager: Multi-option markets require P2P token");
            require(supportedTokens[paymentToken], "MarketManager: Token not supported for multi-option");
        } else {
            if (paymentToken != address(0)) {
                require(supportedTokens[paymentToken], "MarketManager: Token not supported");
            }
        }
        
        // Pay market creation fee
        require(msg.value >= marketCreationFee, "MarketManager: Insufficient creation fee");
        
        // Calculate timestamps
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + (durationMinutes * 1 minutes);
        uint256 resolutionEndTime = endTime + 48 hours;
        
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
            endTime: endTime,
            resolutionEndTime: resolutionEndTime,
            state: MarketState.Active,
            winningOption: 0,
            isResolved: false
        });
        
        // Add to active markets
        activeMarkets.push(marketId);
        isActiveMarket[marketId] = true;
        
        // Transfer creator deposit and send fee to owner
        if (paymentToken == address(0)) {
            require(msg.value >= marketCreationFee + creatorDeposit, "MarketManager: Insufficient PEPU");
            // Send creation fee directly to owner
            (bool success, ) = owner().call{value: marketCreationFee}("");
            require(success, "MarketManager: Fee transfer to owner failed");
            // Send creator deposit to Treasury
            (bool treasurySuccess, ) = treasury.call{value: creatorDeposit}("");
            require(treasurySuccess, "MarketManager: Creator deposit transfer to Treasury failed");
        } else {
            require(msg.value >= marketCreationFee, "MarketManager: Insufficient PEPU for creation fee");
            // Send creation fee directly to owner
            (bool success, ) = owner().call{value: marketCreationFee}("");
            require(success, "MarketManager: Fee transfer to owner failed");
            // Send creator deposit to Treasury
            IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, creatorDeposit);
        }

        // Creator's deposit becomes their bet on their chosen outcome
        userHasBet[marketId][msg.sender] = true;
        userBetOptions[marketId][msg.sender] = creatorOutcome;
        userMarketHistory[msg.sender].push(marketId);
        
        // Call Treasury to handle creator's bet
        PoolVault(treasury).placeBet(marketId, msg.sender, paymentToken, creatorDeposit, creatorOutcome);
        
        // Track analytics
        if (analytics != address(0)) {
            MetricsHub(analytics).trackMarketCreation(marketId, msg.sender);
            MetricsHub(analytics).trackBet(marketId, msg.sender, creatorOutcome, creatorDeposit);
        }
        
        emit MarketCreated(
            marketId,
            msg.sender,
            ipfsHash,
            isMultiOption,
            maxOptions,
            paymentToken,
            minStake
        );
        
        return marketId;
    }

    /**
     * @dev Place a bet on a specific option (for PEPU markets)
     */
    function placeBet(uint256 marketId, uint256 option) external payable {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "MarketManager: Market not active");
        if (bettingRestrictionEnabled) {
            require(block.timestamp < market.endTime - (bettingRestrictionMinutes * 1 minutes), "MarketManager: Betting period ended - no bets allowed in restriction period");
        }
        require(option > 0 && option <= market.maxOptions, "MarketManager: Invalid option");
        require(market.paymentToken == address(0), "MarketManager: This market uses tokens, use placeBetWithToken");
        
        uint256 amount = msg.value;
        require(amount >= market.minStake, "MarketManager: Below minimum stake");
        
        // Transfer ETH to Treasury first
        (bool success, ) = treasury.call{value: amount}("");
        require(success, "MarketManager: ETH transfer to Treasury failed");
        
        // Update user bet tracking
        if (!userHasBet[marketId][msg.sender]) {
            marketBettors[marketId].push(msg.sender);
            userMarketHistory[msg.sender].push(marketId);
        }
        userHasBet[marketId][msg.sender] = true;
        userBetOptions[marketId][msg.sender] = option;
        
        // Call Treasury to handle funds accounting
        PoolVault(treasury).placeBet(marketId, msg.sender, market.paymentToken, amount, option);
        
        // Track analytics
        if (analytics != address(0)) {
            MetricsHub(analytics).trackBet(marketId, msg.sender, option, amount);
        }
        
        emit BetPlaced(marketId, msg.sender, option, amount);
    }

    /**
     * @dev Place a bet on a specific option (for token markets)
     */
    function placeBetWithToken(uint256 marketId, uint256 option, uint256 amount) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "MarketManager: Market not active");
        if (bettingRestrictionEnabled) {
            require(block.timestamp < market.endTime - (bettingRestrictionMinutes * 1 minutes), "MarketManager: Betting period ended - no bets allowed in restriction period");
        }
        require(option > 0 && option <= market.maxOptions, "MarketManager: Invalid option");
        require(market.paymentToken != address(0), "MarketManager: This market uses PEPU, use placeBet");
        require(amount >= market.minStake, "MarketManager: Below minimum stake");
        
        // Transfer tokens to Treasury
        IERC20(market.paymentToken).safeTransferFrom(msg.sender, treasury, amount);
        
        // Update user bet tracking
        if (!userHasBet[marketId][msg.sender]) {
            marketBettors[marketId].push(msg.sender);
            userMarketHistory[msg.sender].push(marketId);
        }
        userHasBet[marketId][msg.sender] = true;
        userBetOptions[marketId][msg.sender] = option;
        
        // Call Treasury to handle funds
        PoolVault(treasury).placeBet(marketId, msg.sender, market.paymentToken, amount, option);
        
        // Track analytics
        if (analytics != address(0)) {
            MetricsHub(analytics).trackBet(marketId, msg.sender, option, amount);
        }
        
        emit BetPlaced(marketId, msg.sender, option, amount);
    }

    /**
     * @dev Support a market without betting on any option
     */
    function supportMarket(uint256 marketId, uint256 amount) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "MarketManager: Market not active");
        require(block.timestamp < market.endTime, "MarketManager: Support period ended");
        require(!blacklistedWallets[msg.sender], "MarketManager: Wallet blacklisted");
        require(market.paymentToken != address(0), "MarketManager: Support only available for token markets");
        require(amount > 0, "MarketManager: Support amount must be greater than 0");
        
        // Transfer tokens to Treasury
        IERC20(market.paymentToken).safeTransferFrom(msg.sender, treasury, amount);
        
        // Update user support tracking
        if (!userHasSupported[marketId][msg.sender]) {
            // First time supporting this market
            marketSupporters[marketId].push(msg.sender);
        }
        userHasSupported[marketId][msg.sender] = true;
        
        // Call Treasury to handle funds
        PoolVault(treasury).supportMarket(marketId, msg.sender, market.paymentToken, amount);
        
        // Track analytics
        if (analytics != address(0)) {
            MetricsHub(analytics).trackSupport(marketId, msg.sender, amount);
        }
        
        emit MarketSupported(marketId, msg.sender, amount);
    }

    /**
     * @dev Withdraw support from a market
     */
    function withdrawSupport(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(userHasSupported[marketId][msg.sender], "MarketManager: No support to withdraw");
        
        // Check withdrawal conditions based on market state
        if (market.state == MarketState.Active) {
            // Can only withdraw if more than 12 hours left until end time
            require(block.timestamp < market.endTime - 12 hours, "MarketManager: Cannot withdraw within 12 hours of market end");
        } else if (market.state == MarketState.Deleted || market.state == MarketState.Cancelled) {
            // Can withdraw anytime if market is deleted or cancelled
            // No additional checks needed
        } else {
            // Cannot withdraw in other states (Ended, Resolved)
            revert("MarketManager: Cannot withdraw in current market state");
        }
        
        // Get user support amount from Treasury
        uint256 supportAmount = PoolVault(treasury).getUserSupport(marketId, msg.sender, market.paymentToken);
        require(supportAmount > 0, "MarketManager: No support to withdraw");
        
        // Call Treasury to handle withdrawal
        PoolVault(treasury).withdrawSupport(marketId, msg.sender, market.paymentToken, supportAmount);
        
        // Update tracking
        userHasSupported[marketId][msg.sender] = false;
        
        emit SupportWithdrawn(marketId, msg.sender, supportAmount);
    }

    /**
     * @dev End the betting period
     */
    function endMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "MarketManager: Market not active");
        require(block.timestamp >= market.endTime, "MarketManager: Betting period not ended");
        
        market.state = MarketState.Ended;
        emit MarketEnded(marketId, market.endTime);
    }

    /**
     * @dev Resolve market with winning option
     */
    function resolveMarket(uint256 marketId, uint256 _winningOption) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Ended, "MarketManager: Market not in ended state");
        require(_winningOption > 0 && _winningOption <= market.maxOptions, "MarketManager: Invalid winning option");
        require(!market.isResolved, "MarketManager: Already resolved");
        
        // Check if resolution period has passed
        if (block.timestamp >= market.resolutionEndTime) {
            _cancelMarket(marketId, "Resolution period expired");
            return;
        }
        
        // Check if verifier has voted for this option
        (bool resolved, uint256 votedOption) = ValidationCore(verification).isResolved(marketId);
        if (resolved && votedOption == _winningOption) {
            market.winningOption = _winningOption;
            market.isResolved = true;
            market.state = MarketState.Resolved;
            
            // Distribute fees to treasury
            _distributeFees(marketId);
            
            // Track analytics
            if (analytics != address(0)) {
                MetricsHub(analytics).trackMarketResolution(marketId, _winningOption);
            }
            
            emit MarketResolved(marketId, _winningOption);
        } else {
            revert("MarketManager: Insufficient verifier votes for this option");
        }
    }

    /**
     * @dev Auto-resolve market when verifier quorum is reached
     */
    function autoResolve(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Ended, "MarketManager: Market not in ended state");
        require(!market.isResolved, "MarketManager: Already resolved");
        
        (bool resolved, uint256 votedOption) = ValidationCore(verification).isResolved(marketId);
        require(resolved, "MarketManager: No resolution reached");
        
        market.winningOption = votedOption;
        market.isResolved = true;
        market.state = MarketState.Resolved;
        
        // Distribute fees to treasury
        _distributeFees(marketId);
        
        // Track analytics
        if (analytics != address(0)) {
            MetricsHub(analytics).trackMarketResolution(marketId, votedOption);
        }
        
        emit MarketResolved(marketId, votedOption);
    }

    /**
     * @dev Cancel market (anyone can call after resolution period)
     */
    function cancelMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Ended, "MarketManager: Market not in ended state");
        require(block.timestamp >= market.resolutionEndTime, "MarketManager: Resolution period not ended");
        require(!market.isResolved, "MarketManager: Already resolved");
        
        _cancelMarket(marketId, "Resolution period expired");
    }

    /**
     * @dev Creator can cancel market (up to 12 hours before end)
     */
    function creatorCancelMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(msg.sender == market.creator, "MarketManager: Only creator can cancel");
        require(market.state == MarketState.Active, "MarketManager: Market not active");
        require(block.timestamp < market.endTime - 12 hours, "MarketManager: Too late to cancel");
        
        _cancelMarket(marketId, "Creator cancelled");
    }

    /**
     * @dev Claim refunds for cancelled market
     */
    function claimRefund(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Cancelled, "MarketManager: Market not cancelled");
        require(userHasBet[marketId][msg.sender] || userHasSupported[marketId][msg.sender], "MarketManager: No stake to refund");
        
        uint256 refundAmount = 0;
        
        // Get bet refund
        if (userHasBet[marketId][msg.sender]) {
            uint256 betAmount = PoolVault(treasury).getUserBet(marketId, msg.sender, market.paymentToken);
            refundAmount += betAmount;
            userHasBet[marketId][msg.sender] = false;
        }
        
        // Get support refund
        if (userHasSupported[marketId][msg.sender]) {
            uint256 supportAmount = PoolVault(treasury).getUserSupport(marketId, msg.sender, market.paymentToken);
            refundAmount += supportAmount;
            userHasSupported[marketId][msg.sender] = false;
        }
        
        require(refundAmount > 0, "MarketManager: No refund available");
        
        // Call Treasury to handle refund payment
        PoolVault(treasury).claimRefund(marketId, msg.sender, market.paymentToken, refundAmount);
        emit RefundClaimed(marketId, msg.sender, refundAmount);
    }

    /**
     * @dev Claim winnings for resolved market
     */
    function claimWinnings(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Resolved, "MarketManager: Market not resolved");
        require(market.winningOption > 0, "MarketManager: No winning option");
        require(userHasBet[marketId][msg.sender], "MarketManager: No bet placed");
        require(userBetOptions[marketId][msg.sender] == market.winningOption, "MarketManager: Not a winning bet");
        require(!PoolVault(treasury).hasUserClaimed(marketId, msg.sender), "MarketManager: Already claimed");
        
        // Calculate winnings
        uint256 userStake = PoolVault(treasury).getUserBet(marketId, msg.sender, market.paymentToken);
        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, market.winningOption, market.paymentToken);
        
        // Calculate losing pool (all options except winning)
        uint256 totalLosingPool = 0;
        for (uint256 i = 1; i <= market.maxOptions; i++) {
            if (i != market.winningOption) {
                totalLosingPool += PoolVault(treasury).getOptionPool(marketId, i, market.paymentToken);
            }
        }
        
        uint256 userWinnings;
        
        // Check if anyone bet on the winning option
        if (totalWinningStake == 0) {
            // No one bet on winning option - everyone loses, platform gets all funds
            uint256 totalPool = PoolVault(treasury).getMarketPool(marketId, market.paymentToken);
            
            // Platform gets 95% of total pool (5% goes to creator if they're claiming)
            uint256 creatorShare = (totalPool * 500) / 10000;   // 5% to creator
            
            if (msg.sender == market.creator) {
                userWinnings = creatorShare;
            } else {
                // Non-creator trying to claim when no one won - they get nothing
                revert("MarketManager: No one bet on winning option - only creator can claim");
            }
        } else {
            // Normal case: someone bet on winning option
            // User gets their original stake + proportional share of losing pool (90% goes to bettors, 5% to platform)
            uint256 winningsPool = (totalLosingPool * 9000) / 10000; // 90% of losing pool goes to bettors
            userWinnings = userStake + (userStake * winningsPool) / totalWinningStake;
            
            // If user is the creator, they also get 5% of total pool as platform fee
            if (msg.sender == market.creator) {
                uint256 totalPool = PoolVault(treasury).getMarketPool(marketId, market.paymentToken);
                uint256 creatorPlatformFee = (totalPool * 500) / 10000; // 5% of total pool
                userWinnings += creatorPlatformFee;
            }
        }
        
        // Call Treasury to handle payment
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
     * @dev Internal function to distribute platform fees to treasury - FIXED VERSION
     */
    function _distributeFees(uint256 marketId) internal {
        Market storage market = markets[marketId];
        
        // Calculate total losing pool (all options except winning)
        uint256 totalLosingPool = 0;
        for (uint256 i = 1; i <= market.maxOptions; i++) {
            if (i != market.winningOption) {
                totalLosingPool += PoolVault(treasury).getOptionPool(marketId, i, market.paymentToken);
            }
        }
        
        // Check if anyone bet on the winning option
        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, market.winningOption, market.paymentToken);
        
        if (totalWinningStake == 0) {
            // FIXED: No one bet on winning option - properly distribute the 95% platform share
            uint256 totalPool = PoolVault(treasury).getMarketPool(marketId, market.paymentToken);
            
            // Calculate proper distribution:
            // Creator gets 5% of total pool (paid when they claim)
            // Platform gets 95% of total pool - ADD TO PLATFORM POOL
            
            uint256 platformShare = (totalPool * 9500) / 10000; // 95% to platform
            
            if (platformShare > 0) {
                // Add the full 95% to platform pool (this handles partner distribution internally)
                PoolVault(treasury).addToPlatformPool(market.paymentToken, platformShare);
            }
        } else {
            // Normal case: someone bet on winning option
            // Calculate 5% platform fee from losing pool
            uint256 platformFee = (totalLosingPool * 500) / 10000; // 5% platform fee
            
            if (platformFee > 0) {
                // Use regular fee distribution for normal case
                PoolVault(treasury).distributeFees(market.paymentToken, platformFee);
            }
        }
        
        // Note: Creator gets their 5% platform fee directly when they claim winnings
        // This ensures creator gets platform fee regardless of outcome
    }

    /**
     * @dev Internal function to transfer payment
     */
    function _transferPayment(address to, uint256 amount, address paymentToken) internal {
        if (paymentToken == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "MarketManager: ETH transfer failed");
        } else {
            IERC20(paymentToken).safeTransfer(to, amount);
        }
    }

    // Admin functions
    function addSupportedToken(address token, string memory symbol) external onlyOwner {
        require(token != address(0), "MarketManager: Invalid token address");
        require(bytes(symbol).length > 0, "MarketManager: Invalid token symbol");
        require(!supportedTokens[token], "MarketManager: Token already supported");
        
        supportedTokens[token] = true;
        tokenSymbols[token] = symbol;
        supportedTokenList.push(token);
    }

    function removeSupportedToken(address token) external onlyOwner {
        require(token != address(0), "MarketManager: Cannot remove native token");
        require(supportedTokens[token], "MarketManager: Token not supported");
        
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
    }

    function setWalletBlacklist(address wallet, bool blacklisted) external onlyOwner {
        require(wallet != address(0), "MarketManager: Invalid wallet address");
        blacklistedWallets[wallet] = blacklisted;
    }

    function setMarketCreationFee(uint256 _marketCreationFee) external onlyOwner {
        marketCreationFee = _marketCreationFee;
    }

    function setAnalytics(address _analytics) external onlyOwner {
        analytics = _analytics;
    }

    function setVerification(address _verification) external onlyOwner {
        verification = _verification;
    }

    function setMinMarketDuration(uint256 _minMarketDurationMinutes) external onlyOwner {
        require(_minMarketDurationMinutes > 0, "MarketManager: Invalid minimum duration");
        minMarketDurationMinutes = _minMarketDurationMinutes;
    }

    function setBettingRestriction(bool _enabled, uint256 _restrictionMinutes) external onlyOwner {
        bettingRestrictionEnabled = _enabled;
        if (_enabled) {
            require(_restrictionMinutes > 0, "MarketManager: Invalid restriction duration");
            bettingRestrictionMinutes = _restrictionMinutes;
        }
    }

    /**
     * @dev Get all supported tokens with their symbols
     */
    function getSupportedTokens() external view returns (address[] memory tokens, string[] memory symbols) {
        uint256 length = supportedTokenList.length;
        tokens = new address[](length);
        symbols = new string[](length);
        
        for (uint256 i = 0; i < length; i++) {
            tokens[i] = supportedTokenList[i];
            symbols[i] = tokenSymbols[supportedTokenList[i]];
        }
    }

    /**
     * @dev Get supported token count
     */
    function getSupportedTokenCount() external view returns (uint256) {
        return supportedTokenList.length;
    }

    function deleteMarket(uint256 marketId, string memory reason) external onlyOwner {
        require(marketId < nextMarketId, "MarketManager: Invalid market ID");
        require(markets[marketId].creator != address(0), "MarketManager: Market does not exist");
        require(markets[marketId].state != MarketState.Deleted, "MarketManager: Already deleted");
        
        // Soft delete - mark as deleted but keep data for refunds
        markets[marketId].state = MarketState.Deleted;
        deletionTimestamp[marketId] = block.timestamp;
        deletedMarkets.push(marketId);
        
        // Remove from active markets list
        if (isActiveMarket[marketId]) {
            _removeFromActiveMarkets(marketId);
        }
        
        emit MarketCancelled(marketId, reason);
    }
    
    /**
     * @dev Permanently remove resolved market after claim period (30 days)
     */
    function permanentlyRemoveMarket(uint256 marketId) external onlyOwner {
        require(marketId < nextMarketId, "MarketManager: Invalid market ID");
        require(markets[marketId].creator != address(0), "MarketManager: Market does not exist");
        require(markets[marketId].state == MarketState.Resolved, "MarketManager: Market not resolved");
        require(block.timestamp >= markets[marketId].resolutionEndTime + 30 days, "MarketManager: Claim period not ended");
        
        // Clear market data
        delete markets[marketId];
        
        // Note: Option pools are now managed by Treasury, no need to clear here
        
        // Remove from active markets if still there
        if (isActiveMarket[marketId]) {
            _removeFromActiveMarkets(marketId);
        }
        
        // Add to permanently removed list
        permanentlyRemovedMarkets.push(marketId);
        
        emit MarketCancelled(marketId, "Permanently removed after claim period");
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

    // View functions
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getUserBet(uint256 marketId, address user, address token) external view returns (uint256) {
        return PoolVault(treasury).getUserBet(marketId, user, token);
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

    function getMarketSupporters(uint256 marketId) external view returns (address[] memory) {
        return marketSupporters[marketId];
    }

    function getSupporterCount(uint256 marketId) external view returns (uint256) {
        return marketSupporters[marketId].length;
    }

    function getBettorCount(uint256 marketId) external view returns (uint256) {
        return marketBettors[marketId].length;
    }

    function getMarketBettors(uint256 marketId) external view returns (address[] memory) {
        return marketBettors[marketId];
    }

    /**
     * @dev Get comprehensive market information
     */
    function getMarketInfo(uint256 marketId) external view returns (
        Market memory market,
        uint256 totalPool,
        uint256 supportPool,
        uint256 bettorCount,
        uint256 supporterCount,
        address[] memory bettors,
        address[] memory supporters,
        string memory tokenSymbol
    ) {
        market = markets[marketId];
        totalPool = PoolVault(treasury).getMarketPool(marketId, market.paymentToken);
        supportPool = PoolVault(treasury).getSupportPool(marketId, market.paymentToken);
        bettorCount = marketBettors[marketId].length;
        supporterCount = marketSupporters[marketId].length;
        bettors = marketBettors[marketId];
        supporters = marketSupporters[marketId];
        tokenSymbol = tokenSymbols[market.paymentToken];
    }

    function getNextMarketId() external view returns (uint256) {
        return nextMarketId;
    }
    
    /**
     * @dev Get all active markets
     */
    function getActiveMarkets() external view returns (uint256[] memory) {
        return activeMarkets;
    }
    
    /**
     * @dev Get user's market history
     */
    function getUserMarketHistory(address user) external view returns (uint256[] memory) {
        return userMarketHistory[user];
    }
    
    /**
     * @dev Check if market is active (not deleted)
     */
    function isMarketActive(uint256 marketId) external view returns (bool) {
        return isActiveMarket[marketId] && markets[marketId].state != MarketState.Deleted;
    }
    
    /**
     * @dev Get market count (active only)
     */
    function getActiveMarketCount() external view returns (uint256) {
        return activeMarkets.length;
    }
    
    /**
     * @dev Get all deleted markets (for cleanup script)
     */
    function getDeletedMarkets() external view returns (uint256[] memory) {
        return deletedMarkets;
    }
    
    /**
     * @dev Get markets ready for permanent removal (30+ days old)
     */
    function getMarketsReadyForRemoval() external view returns (uint256[] memory) {
        uint256[] memory readyMarkets = new uint256[](deletedMarkets.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < deletedMarkets.length; i++) {
            uint256 marketId = deletedMarkets[i];
            if (markets[marketId].state == MarketState.Deleted && 
                block.timestamp >= deletionTimestamp[marketId] + 30 days) {
                readyMarkets[count] = marketId;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = readyMarkets[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get all market IDs (for UI pagination)
     */
    function getAllMarketIds() external view returns (uint256[] memory) {
        uint256[] memory allIds = new uint256[](nextMarketId - 1);
        for (uint256 i = 1; i < nextMarketId; i++) {
            allIds[i - 1] = i;
        }
        return allIds;
    }
    
    /**
     * @dev Get permanently removed markets
     */
    function getPermanentlyRemovedMarkets() external view returns (uint256[] memory) {
        return permanentlyRemovedMarkets;
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {}
}