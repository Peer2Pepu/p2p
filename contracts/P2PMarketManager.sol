// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ========================================
// EVENT POOL CONTRACT (MAIN BETTING CONTRACT)
// ========================================
// This contract handles all betting/market functions:
// - Create markets
// - Place stakes/bets
// - Support markets
// - Resolve markets
// - Claim winnings/refunds
//
// USERS CALL THIS CONTRACT for all betting actions
// READS FROM AdminManager for permissions/settings
// ========================================

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./P2PTreasury.sol";
import "./P2PVerification.sol";
import "./P2PAnalytics.sol";

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./P2PTreasury.sol";
import "./P2PVerification.sol";
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
    function verification() external view returns (address);
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
    uint256 public constant VERIFIER_FEE_BPS = 150;
    uint256 public constant PLATFORM_FEE_BPS = 500;
    
    // Active market tracking
    uint256[] public activeMarkets;
    mapping(uint256 => bool) public isActiveMarket;
    
    // Stake history tracking
    mapping(address => uint256[]) public userMarketHistory;
    
    // Verifier resolution tracking
    mapping(uint256 => address[]) public marketResolvingVerifiers;
    
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
        require(!IAdminManager(adminManager).blacklistedWallets(msg.sender), "EventPool: Wallet blacklisted");
        _;
    }
    
    modifier notDeleted(uint256 marketId) {
        require(!IAdminManager(adminManager).isMarketDeleted(marketId), "EventPool: Market deleted");
        _;
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
        uint256 stakeDurationMinutes,
        uint256 resolutionDurationMinutes
    ) external payable notBlacklisted returns (uint256) {
        require(bytes(ipfsHash).length > 0, "EventPool: Invalid IPFS hash");
        require(maxOptions >= 2 && maxOptions <= 10, "EventPool: Invalid max options");
        require(minStake > 0, "EventPool: Invalid min stake");
        require(creatorDeposit > 0, "EventPool: Invalid creator deposit");
        require(creatorOutcome > 0 && creatorOutcome <= maxOptions, "EventPool: Invalid creator outcome");
        
        // Get settings from AdminManager
        uint256 minDuration = IAdminManager(adminManager).minMarketDurationMinutes();
        require(stakeDurationMinutes >= minDuration, "EventPool: Below minimum stake duration");
        require(resolutionDurationMinutes >= stakeDurationMinutes, "EventPool: Resolution must be after stake period");
        
        // Validate payment token via AdminManager
        if (isMultiOption) {
            require(paymentToken != address(0), "EventPool: Multi-option markets require P2P token");
            require(IAdminManager(adminManager).supportedTokens(paymentToken), "EventPool: Token not supported for multi-option");
        } else {
            if (paymentToken != address(0)) {
                require(IAdminManager(adminManager).supportedTokens(paymentToken), "EventPool: Token not supported");
            }
        }
        
        // Pay market creation fee
        require(msg.value >= marketCreationFee, "EventPool: Insufficient creation fee");
        
        // Calculate timestamps
        uint256 startTime = block.timestamp;
        uint256 stakeEndTime = startTime + (stakeDurationMinutes * 1 minutes);
        uint256 endTime = startTime + (resolutionDurationMinutes * 1 minutes);
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
            stakeEndTime: stakeEndTime,
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
            require(msg.value >= marketCreationFee + creatorDeposit, "EventPool: Insufficient PEPU");
            (bool success, ) = owner().call{value: marketCreationFee}("");
            require(success, "EventPool: Fee transfer to owner failed");
            (bool treasurySuccess, ) = treasury.call{value: creatorDeposit}("");
            require(treasurySuccess, "EventPool: Creator deposit transfer to Treasury failed");
        } else {
            require(msg.value >= marketCreationFee, "EventPool: Insufficient PEPU for creation fee");
            (bool success, ) = owner().call{value: marketCreationFee}("");
            require(success, "EventPool: Fee transfer to owner failed");
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
        require(market.state == MarketState.Active, "EventPool: Market not active");
        
        // Check betting restriction from AdminManager
        if (IAdminManager(adminManager).bettingRestrictionEnabled()) {
            uint256 restrictionMinutes = IAdminManager(adminManager).bettingRestrictionMinutes();
            require(block.timestamp < market.stakeEndTime - (restrictionMinutes * 1 minutes), "EventPool: Staking period ended");
        }
        
        require(option > 0 && option <= market.maxOptions, "EventPool: Invalid option");
        require(market.paymentToken == address(0), "EventPool: This market uses tokens, use placeBetWithToken");
        
        uint256 amount = msg.value;
        require(amount >= market.minStake, "EventPool: Below minimum stake");
        
        // Transfer ETH to Treasury first
        (bool success, ) = treasury.call{value: amount}("");
        require(success, "EventPool: ETH transfer to Treasury failed");
        
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
        require(market.state == MarketState.Active, "EventPool: Market not active");
        
        if (IAdminManager(adminManager).bettingRestrictionEnabled()) {
            uint256 restrictionMinutes = IAdminManager(adminManager).bettingRestrictionMinutes();
            require(block.timestamp < market.stakeEndTime - (restrictionMinutes * 1 minutes), "EventPool: Staking period ended");
        }
        
        require(option > 0 && option <= market.maxOptions, "EventPool: Invalid option");
        require(market.paymentToken != address(0), "EventPool: This market uses PEPU, use placeBet");
        require(amount >= market.minStake, "EventPool: Below minimum stake");
        
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
        require(market.state == MarketState.Active, "EventPool: Market not active");
        require(block.timestamp < market.stakeEndTime, "EventPool: Support period ended");
        require(amount > 0, "EventPool: Support amount must be greater than 0");
        
        if (market.paymentToken == address(0)) {
            require(msg.value == amount, "EventPool: Incorrect ETH amount");
            require(msg.value > 0, "EventPool: Support amount must be greater than 0");
            
            (bool success, ) = treasury.call{value: msg.value}("");
            require(success, "EventPool: ETH transfer to treasury failed");
        } else {
            require(msg.value == 0, "EventPool: No ETH should be sent for token support");
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
        require(userHasSupported[marketId][msg.sender], "EventPool: No support to withdraw");
        
        if (market.state == MarketState.Active) {
            require(block.timestamp < market.stakeEndTime - 12 hours, "EventPool: Cannot withdraw within 12 hours of staking end");
        } else if (market.state == MarketState.Deleted || market.state == MarketState.Cancelled) {
            // Can withdraw anytime
        } else {
            revert("EventPool: Cannot withdraw in current market state");
        }
        
        uint256 supportAmount = PoolVault(treasury).getUserSupport(marketId, msg.sender, market.paymentToken);
        require(supportAmount > 0, "EventPool: No support to withdraw");
        
        PoolVault(treasury).withdrawSupport(marketId, msg.sender, market.paymentToken, supportAmount);
        userHasSupported[marketId][msg.sender] = false;
    }

    /**
     * @dev End the betting period
     */
    function endMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Active, "EventPool: Market not active");
        require(block.timestamp >= market.endTime, "EventPool: Resolution time not reached");
        
        market.state = MarketState.Ended;
        
        if (isActiveMarket[marketId]) {
            _removeFromActiveMarkets(marketId);
        }
    }

    /**
     * @dev Resolve market with winning option
     */
    function resolveMarket(uint256 marketId, uint256 _winningOption) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Ended, "EventPool: Market not in ended state");
        require(_winningOption > 0 && _winningOption <= market.maxOptions, "EventPool: Invalid winning option");
        require(!market.isResolved, "EventPool: Already resolved");
        
        if (block.timestamp >= market.resolutionEndTime) {
            _cancelMarket(marketId, "Resolution period expired");
            return;
        }
        
        address verification = IAdminManager(adminManager).verification();
        (bool resolved, uint256 votedOption) = ValidationCore(verification).isResolved(marketId);
        if (resolved && votedOption == _winningOption) {
            market.winningOption = _winningOption;
            market.isResolved = true;
            market.state = MarketState.Resolved;
            
            _trackResolvingVerifiers(marketId, _winningOption);
            _distributeFees(marketId);
            
            address analytics = IAdminManager(adminManager).analytics();
            if (analytics != address(0)) {
                MetricsHub(analytics).trackMarketResolution(marketId, _winningOption);
            }
            
            emit MarketResolved(marketId, _winningOption);
        } else {
            revert("EventPool: Insufficient verifier votes for this option");
        }
    }

    /**
     * @dev Auto-resolve market when verifier quorum is reached
     */
    function autoResolve(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Ended, "EventPool: Market not in ended state");
        require(!market.isResolved, "EventPool: Already resolved");
        
        address verification = IAdminManager(adminManager).verification();
        (bool resolved, uint256 votedOption) = ValidationCore(verification).isResolved(marketId);
        require(resolved, "EventPool: No resolution reached");
        
        market.winningOption = votedOption;
        market.isResolved = true;
        market.state = MarketState.Resolved;
        
        _trackResolvingVerifiers(marketId, votedOption);
        _distributeFees(marketId);
        
        address analytics = IAdminManager(adminManager).analytics();
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
        require(market.state == MarketState.Ended, "EventPool: Market not in ended state");
        require(block.timestamp >= market.resolutionEndTime, "EventPool: Resolution period not ended");
        require(!market.isResolved, "EventPool: Already resolved");
        
        _cancelMarket(marketId, "Resolution period expired");
    }

    /**
     * @dev Creator can cancel market (up to 12 hours before end)
     */
    function creatorCancelMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(msg.sender == market.creator, "EventPool: Only creator can cancel");
        require(market.state == MarketState.Active, "EventPool: Market not active");
        require(block.timestamp < market.stakeEndTime - 12 hours, "EventPool: Too late to cancel");
        
        _cancelMarket(marketId, "Creator cancelled");
    }

    /**
     * @dev Claim refunds for cancelled market
     */
    function claimRefund(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Cancelled, "EventPool: Market not cancelled");
        require(userHasStaked[marketId][msg.sender] || userHasSupported[marketId][msg.sender], "EventPool: No stake to refund");
        
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
        
        require(refundAmount > 0, "EventPool: No refund available");
        
        PoolVault(treasury).claimRefund(marketId, msg.sender, market.paymentToken, refundAmount);
        emit RefundClaimed(marketId, msg.sender, refundAmount);
    }

    /**
     * @dev Calculate winnings for a user without claiming
     */
    function calculateWinnings(uint256 marketId, address user) external view returns (uint256) {
        Market storage market = markets[marketId];
        require(market.state == MarketState.Resolved, "EventPool: Market not resolved");
        require(market.winningOption > 0, "EventPool: No winning option");
        require(userHasStaked[marketId][user], "EventPool: No stake placed");
        require(!PoolVault(treasury).hasUserClaimed(marketId, user), "EventPool: Already claimed");
        
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
        require(market.state == MarketState.Resolved, "EventPool: Market not resolved");
        require(market.winningOption > 0, "EventPool: No winning option");
        require(userHasStaked[marketId][msg.sender], "EventPool: No stake placed");
        require(!PoolVault(treasury).hasUserClaimed(marketId, msg.sender), "EventPool: Already claimed");
        
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
     * @dev Internal function to track which verifiers resolved a market
     */
    function _trackResolvingVerifiers(uint256 marketId, uint256 winningOption) internal {
        address verification = IAdminManager(adminManager).verification();
        address[] memory allVerifiers = ValidationCore(verification).getVerifiers();
        
        for (uint256 i = 0; i < allVerifiers.length; i++) {
            if (ValidationCore(verification).hasVerifierVoted(marketId, winningOption, allVerifiers[i])) {
                marketResolvingVerifiers[marketId].push(allVerifiers[i]);
            }
        }
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
        uint256 verifierFee = (totalPool * VERIFIER_FEE_BPS) / 10000;
        uint256 platformFee = (totalPool * PLATFORM_FEE_BPS) / 10000;
        
        if (totalWinningStake == 0) {
            // All lose scenario - Creator gets stake back, platform gets the rest
            uint256 totalFees = creatorFee + verifierFee + platformFee;
            uint256 remainingForPlatform = totalPool - totalFees;
            
            if (creatorFee > 0) {
                PoolVault(treasury).transferToCreator(market.creator, market.paymentToken, creatorFee);
            }
            
            if (verifierFee > 0) {
                PoolVault(treasury).distributeVerifierRewards(marketId, market.paymentToken, verifierFee);
            }
            
            uint256 totalPlatformAmount = platformFee + remainingForPlatform;
            if (totalPlatformAmount > 0) {
                PoolVault(treasury).addToPlatformPool(market.paymentToken, totalPlatformAmount);
            }
        } else if (totalLosingPool == 0) {
            // All win scenario - No fees, no verifier rewards
            // Everyone gets their stakes back completely
        } else {
            // Normal scenario - Fees from losing pool
            if (creatorFee > 0) {
                PoolVault(treasury).transferToCreator(market.creator, market.paymentToken, creatorFee);
            }
            
            if (verifierFee > 0) {
                PoolVault(treasury).distributeVerifierRewards(marketId, market.paymentToken, verifierFee);
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
        require(_adminManager != address(0), "EventPool: Invalid address");
        adminManager = _adminManager;
    }
    
    /**
     * @dev Mark market as deleted (only callable by AdminManager)
     */
    function markMarketDeleted(uint256 marketId) external {
        require(msg.sender == adminManager, "EventPool: Only AdminManager");
        require(marketId < nextMarketId, "EventPool: Invalid market ID");
        require(markets[marketId].creator != address(0), "EventPool: Market does not exist");
        require(markets[marketId].state != MarketState.Deleted, "EventPool: Already deleted");
        
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
        require(msg.sender == adminManager, "EventPool: Only AdminManager");
        require(marketId < nextMarketId, "EventPool: Invalid market ID");
        require(markets[marketId].creator != address(0), "EventPool: Market does not exist");
        require(markets[marketId].state == MarketState.Resolved, "EventPool: Market not resolved");
        
        // Clear market data
        delete markets[marketId];
        
        // Remove from active markets if still there
        if (isActiveMarket[marketId]) {
            _removeFromActiveMarkets(marketId);
        }
        
        emit MarketCancelled(marketId, "Permanently removed after claim period");
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
    
    function getActiveMarkets() external view returns (uint256[] memory) {
        return activeMarkets;
    }
    
    function getUserMarketHistory(address user) external view returns (uint256[] memory) {
        return userMarketHistory[user];
    }
    
    function isMarketActive(uint256 marketId) external view returns (bool) {
        return isActiveMarket[marketId] && markets[marketId].state != MarketState.Deleted;
    }
    
    function getActiveMarketCount() external view returns (uint256) {
        return activeMarkets.length;
    }
    
    function getAllMarketIds() external view returns (uint256[] memory) {
        uint256[] memory allIds = new uint256[](nextMarketId - 1);
        for (uint256 i = 1; i < nextMarketId; i++) {
            allIds[i - 1] = i;
        }
        return allIds;
    }

    function getMarketResolvingVerifiers(uint256 marketId) external view returns (address[] memory) {
        return marketResolvingVerifiers[marketId];
    }

    receive() external payable {}
}