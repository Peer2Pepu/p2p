// @p2p-oracle-system
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EventPool
 * @notice P2P prediction market contract.
 *
 * ─── Oracle integration (P2POPTIMISTIC markets) ──────────────────────────────
 *
 *  Resolution flow:
 *
 *  1. endMarket(id)                  — anyone, after market.endTime
 *  2. requestP2PResolution(id, ...)  — anyone except creator, after endTime;
 *                                      posts a claim + bond to the oracle
 *  3. [optional] disputeOracle(id)   — anyone, after assertionDeadline and
 *                                      before expirationTime; puts up counter-bond
 *  4. settleOracle(id)               — anyone, after expirationTime
 *  5. resolveP2PMarket(id)           — anyone, after oracle is settled
 *
 *  Fallback paths that prevent permanent fund-lock:
 *
 *  • If nobody asserts within ASSERTION_GRACE_PERIOD after endTime
 *    → cancelMarketNoAssertion(id) cancels the market and allows refunds.
 *
 *  • If oracle settles with result=false (disputer won / assertion was wrong)
 *    → resolveP2PMarket() cancels the market and allows refunds.
 *      (The asserter lied; we don't know the real outcome, so refund everyone.)
 *
 *  • If oracle vote had no consensus, the oracle automatically accepts the
 *    assertion as true and returns both bonds. Market resolves normally.
 *    This path is handled inside the oracle itself (see P2POptimisticOracle.sol).
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IOptimisticOracle.sol";
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

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80);
    function decimals() external view returns (uint8);
}

contract EventPool is Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum MarketState { Active, Ended, Resolved, Cancelled, Deleted }

    enum MarketType {
        PRICE_FEED,    // Resolves via on-chain Chainlink-compatible feed
        P2POPTIMISTIC  // Resolves via P2P Optimistic Oracle + voting
    }

    struct Market {
        address     creator;
        string      ipfsHash;
        bool        isMultiOption;
        uint256     maxOptions;
        address     paymentToken;
        uint256     minStake;
        uint256     creatorDeposit;
        uint256     creatorOutcome;
        uint256     startTime;
        uint256     stakeEndTime;
        uint256     endTime;
        uint256     resolutionEndTime;
        MarketState state;
        uint256     winningOption;
        bool        isResolved;
        MarketType  marketType;
        // PRICE_FEED fields
        address     priceFeed;
        uint256     priceThreshold;
        // P2POPTIMISTIC fields
        bytes32     p2pAssertionId;
        bool        p2pAssertionMade;
    }

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant marketCreationFee = 1e18;
    uint256 public constant CREATOR_FEE_BPS   = 350;  // 3.5 %
    uint256 public constant PLATFORM_FEE_BPS  = 500;  // 5.0 %

    /**
     * @notice Grace period after market.endTime during which someone must assert.
     *         If no assertion is made within this window, the market can be cancelled.
     *         Set to 48 hours to give asserters plenty of time.
     */
    uint256 public assertionGracePeriod = 48 hours;

    // ─── Storage ──────────────────────────────────────────────────────────────

    mapping(uint256 => Market)   public markets;
    mapping(uint256 => mapping(address => bool))    public userHasStaked;
    mapping(uint256 => mapping(address => bool))    public userHasSupported;
    mapping(uint256 => mapping(address => uint256)) public userStakeOptions;
    mapping(uint256 => address[]) public marketStakers;
    mapping(uint256 => address[]) public marketSupporters;
    mapping(address => uint256[]) public userMarketHistory;

    uint256   public nextMarketId = 1;
    uint256[] public activeMarkets;
    mapping(uint256 => bool) public isActiveMarket;

    address payable public treasury;
    address public adminManager;

    // Oracle config
    IOptimisticOracle public optimisticOracle;
    address           public defaultBondCurrency;

    // ─── Events ───────────────────────────────────────────────────────────────

    event MarketCreated(
        uint256 indexed marketId, address indexed creator, string ipfsHash,
        bool isMultiOption, uint256 maxOptions, address paymentToken,
        uint256 minStake, uint256 startTime, uint256 stakeEndTime,
        uint256 endTime, uint256 resolutionEndTime
    );
    event StakePlaced(uint256 indexed marketId, address indexed user, uint256 option, uint256 amount);
    event MarketResolved(uint256 indexed marketId, uint256 winningOption);
    event MarketCancelled(uint256 indexed marketId, string reason);
    event RefundClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event ResolutionRequested(uint256 indexed marketId, bytes32 indexed assertionId);
    event OracleDisputed(uint256 indexed marketId, bytes32 indexed assertionId, address indexed disputer);
    event OracleSettled(uint256 indexed marketId, bytes32 indexed assertionId);
    event OracleResultProcessed(uint256 indexed marketId, bytes32 indexed assertionId, bool accepted);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address        initialOwner,
        address payable _treasury,
        address        _adminManager
    ) Ownable(initialOwner) {
        treasury     = _treasury;
        adminManager = _adminManager;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier notBlacklisted() {
        require(!IAdminManager(adminManager).blacklistedWallets(msg.sender), "EP: blacklisted");
        _;
    }

    modifier notDeleted(uint256 marketId) {
        require(!IAdminManager(adminManager).isMarketDeleted(marketId), "EP: deleted");
        _;
    }

    // ─── Market creation ──────────────────────────────────────────────────────

    /**
     * @notice Create a new prediction market.
     * @param marketType        0 = PRICE_FEED, 1 = P2POPTIMISTIC
     * @param priceFeed         Chainlink-compatible feed (PRICE_FEED only, else address(0))
     * @param priceThreshold    Price in feed units (PRICE_FEED only, else 0)
     */
    function createMarket(
        string memory ipfsHash,
        bool          isMultiOption,
        uint256       maxOptions,
        address       paymentToken,
        uint256       minStake,
        uint256       creatorDeposit,
        uint256       creatorOutcome,
        uint256       stakeDurationMinutes,
        uint256       resolutionDurationMinutes,
        MarketType    marketType,
        address       priceFeed,
        uint256       priceThreshold
    ) external payable notBlacklisted returns (uint256) {
        require(bytes(ipfsHash).length > 0,                     "EP: empty hash");
        require(maxOptions >= 2 && maxOptions <= 10,            "EP: bad options");
        require(minStake > 0,                                   "EP: bad stake");
        require(creatorDeposit > 0,                             "EP: bad deposit");
        require(creatorOutcome > 0 && creatorOutcome <= maxOptions, "EP: bad outcome");

        if (marketType == MarketType.PRICE_FEED) {
            require(priceFeed != address(0),  "EP: feed required");
            require(priceThreshold > 0,       "EP: threshold required");
        }

        uint256 minDuration = IAdminManager(adminManager).minMarketDurationMinutes();
        require(stakeDurationMinutes    >= minDuration,            "EP: min duration");
        require(resolutionDurationMinutes >= stakeDurationMinutes, "EP: resolution after stake");

        if (isMultiOption) {
            require(paymentToken != address(0), "EP: multi needs token");
            require(IAdminManager(adminManager).supportedTokens(paymentToken), "EP: unsupported token");
        } else if (paymentToken != address(0)) {
            require(IAdminManager(adminManager).supportedTokens(paymentToken), "EP: unsupported token");
        }

        require(msg.value >= marketCreationFee, "EP: fee too low");

        uint256 startTime     = block.timestamp;
        uint256 stakeEndTime  = startTime + stakeDurationMinutes    * 1 minutes;
        uint256 endTime       = startTime + resolutionDurationMinutes * 1 minutes;
        // For P2POPTIMISTIC: add assertionWindow(2h) + disputeWindow(12h) + buffer(2h) = 16h
        uint256 resolutionEndTime = marketType == MarketType.PRICE_FEED
            ? endTime
            : endTime + 16 hours;

        uint256 marketId = nextMarketId++;
        markets[marketId] = Market({
            creator:           msg.sender,
            ipfsHash:          ipfsHash,
            isMultiOption:     isMultiOption,
            maxOptions:        maxOptions,
            paymentToken:      paymentToken,
            minStake:          minStake,
            creatorDeposit:    creatorDeposit,
            creatorOutcome:    creatorOutcome,
            startTime:         startTime,
            stakeEndTime:      stakeEndTime,
            endTime:           endTime,
            resolutionEndTime: resolutionEndTime,
            state:             MarketState.Active,
            winningOption:     0,
            isResolved:        false,
            marketType:        marketType,
            priceFeed:         priceFeed,
            priceThreshold:    priceThreshold,
            p2pAssertionId:    bytes32(0),
            p2pAssertionMade:  false
        });

        activeMarkets.push(marketId);
        isActiveMarket[marketId] = true;

        // Collect creation fee
        if (paymentToken == address(0)) {
            require(msg.value >= marketCreationFee + creatorDeposit, "EP: insufficient PEPU");
            (bool ok1, ) = owner().call{value: marketCreationFee}("");
            require(ok1, "EP: fee send failed");
            (bool ok2, ) = treasury.call{value: creatorDeposit}("");
            require(ok2, "EP: deposit send failed");
        } else {
            (bool ok1, ) = owner().call{value: marketCreationFee}("");
            require(ok1, "EP: fee send failed");
            IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, creatorDeposit);
        }

        // Register creator's deposit as their stake
        userHasStaked[marketId][msg.sender]    = true;
        userStakeOptions[marketId][msg.sender] = creatorOutcome;
        userMarketHistory[msg.sender].push(marketId);

        PoolVault(treasury).placeStake(marketId, msg.sender, paymentToken, creatorDeposit, creatorOutcome);

        _trackCreation(marketId, msg.sender, creatorOutcome, creatorDeposit);

        emit MarketCreated(
            marketId, msg.sender, ipfsHash, isMultiOption, maxOptions,
            paymentToken, minStake, startTime, stakeEndTime, endTime, resolutionEndTime
        );
        return marketId;
    }

    // ─── Staking ──────────────────────────────────────────────────────────────

    /// @notice Stake PEPU (native token) on a market option.
    function placeStake(uint256 marketId, uint256 option)
        external payable notDeleted(marketId)
    {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Active,       "EP: not active");
        require(m.paymentToken == address(0),        "EP: use placeStakeWithToken");
        require(option > 0 && option <= m.maxOptions, "EP: bad option");

        _checkBettingRestriction(m);

        uint256 amount = msg.value;
        require(amount >= m.minStake, "EP: below min");

        (bool ok, ) = treasury.call{value: amount}("");
        require(ok, "EP: treasury send failed");

        _recordStake(marketId, msg.sender, m.paymentToken, amount, option);
        emit StakePlaced(marketId, msg.sender, option, amount);
    }

    /// @notice Stake ERC-20 tokens on a market option.
    function placeStakeWithToken(uint256 marketId, uint256 option, uint256 amount)
        external notDeleted(marketId)
    {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Active,       "EP: not active");
        require(m.paymentToken != address(0),        "EP: use placeStake");
        require(option > 0 && option <= m.maxOptions, "EP: bad option");
        require(amount >= m.minStake,                 "EP: below min");

        _checkBettingRestriction(m);

        IERC20(m.paymentToken).safeTransferFrom(msg.sender, treasury, amount);

        _recordStake(marketId, msg.sender, m.paymentToken, amount, option);
        emit StakePlaced(marketId, msg.sender, option, amount);
    }

    /// @notice Support a market with liquidity (no option chosen).
    function supportMarket(uint256 marketId, uint256 amount)
        external payable notBlacklisted notDeleted(marketId)
    {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Active,    "EP: not active");
        require(block.timestamp < m.stakeEndTime, "EP: support closed");
        require(amount > 0,                       "EP: zero amount");

        if (m.paymentToken == address(0)) {
            require(msg.value == amount, "EP: ETH mismatch");
            (bool ok, ) = treasury.call{value: amount}("");
            require(ok, "EP: treasury send failed");
        } else {
            require(msg.value == 0, "EP: no ETH for token market");
            IERC20(m.paymentToken).safeTransferFrom(msg.sender, treasury, amount);
        }

        if (!userHasSupported[marketId][msg.sender]) {
            marketSupporters[marketId].push(msg.sender);
        }
        userHasSupported[marketId][msg.sender] = true;

        PoolVault(treasury).supportMarket(marketId, msg.sender, m.paymentToken, amount);

        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) MetricsHub(analytics).trackSupport(marketId, msg.sender, amount);
    }

    /// @notice Withdraw market support (before stakeEndTime - 12h, or if cancelled/deleted).
    function withdrawSupport(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(userHasSupported[marketId][msg.sender], "EP: no support");

        if (m.state == MarketState.Active) {
            require(
                block.timestamp < m.stakeEndTime - 12 hours,
                "EP: too late to withdraw"
            );
        } else if (m.state == MarketState.Deleted || m.state == MarketState.Cancelled) {
            // always allowed
        } else {
            revert("EP: cannot withdraw now");
        }

        uint256 amt = PoolVault(treasury).getUserSupport(marketId, msg.sender, m.paymentToken);
        require(amt > 0, "EP: nothing to withdraw");

        PoolVault(treasury).withdrawSupport(marketId, msg.sender, m.paymentToken, amt);
        userHasSupported[marketId][msg.sender] = false;
    }

    // ─── Market lifecycle ─────────────────────────────────────────────────────

    /// @notice End the betting period. Anyone can call after endTime.
    function endMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Active,      "EP: not active");
        require(block.timestamp >= m.endTime,        "EP: not ended");

        m.state = MarketState.Ended;
        _removeFromActiveMarkets(marketId);
    }

    /// @notice Creator cancels (more than 12 h before stakeEndTime).
    function creatorCancelMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(msg.sender == m.creator,                          "EP: not creator");
        require(m.state == MarketState.Active,                    "EP: not active");
        require(block.timestamp < m.stakeEndTime - 12 hours,     "EP: too late");

        _cancelMarket(marketId, "Creator cancelled");
    }

    // ─── PRICE_FEED resolution ────────────────────────────────────────────────

    /// @notice Resolve a PRICE_FEED market by reading the on-chain oracle price.
    function resolvePriceFeedMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.PRICE_FEED,  "EP: not PRICE_FEED");
        require(m.state == MarketState.Ended,            "EP: not ended");
        require(!m.isResolved,                           "EP: already resolved");
        require(block.timestamp >= m.resolutionEndTime,  "EP: too early");

        AggregatorV3Interface feed = AggregatorV3Interface(m.priceFeed);
        (, int256 price, , , ) = feed.latestRoundData();

        m.winningOption = uint256(price) >= m.priceThreshold ? 1 : 2;
        m.isResolved    = true;
        m.state         = MarketState.Resolved;

        _distributeFees(marketId);
        _trackResolution(marketId, m.winningOption);
        emit MarketResolved(marketId, m.winningOption);
    }

    // ─── P2POPTIMISTIC resolution ─────────────────────────────────────────────

    /**
     * @notice Step 1 — Post an assertion to the oracle claiming a specific option won.
     * @param marketId  The market to assert for.
     * @param optionId  The winning option (1-based). Encoded as callbackData.
     * @param claim     Human-readable UTF-8 description, e.g. "Option 2 (No) won".
     *
     * @dev Caller must have approved `defaultBondCurrency` for `minimumBond` to this
     *      contract before calling. This contract then approves the oracle and asserts.
     */
    function requestP2PResolution(
        uint256 marketId,
        uint256 optionId,
        bytes calldata claim
    ) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC, "EP: not P2POPTIMISTIC");
        require(m.state == MarketState.Ended,              "EP: not ended");
        require(!m.isResolved,                             "EP: resolved");
        require(!m.p2pAssertionMade,                       "EP: assertion exists");
        require(msg.sender != m.creator,                   "EP: creator cannot assert");
        require(optionId > 0 && optionId <= m.maxOptions,  "EP: bad option");
        require(address(optimisticOracle) != address(0),   "EP: oracle not set");
        require(defaultBondCurrency != address(0),         "EP: bond currency not set");

        uint256 bond = optimisticOracle.getMinimumBond(defaultBondCurrency);

        // Pull bond from asserter to this contract, then approve oracle
        IERC20(defaultBondCurrency).safeTransferFrom(msg.sender, address(this), bond);
        IERC20(defaultBondCurrency).forceApprove(address(optimisticOracle), bond);

        // callbackData encodes (marketId, optionId) — oracle stores and returns it
        bytes memory callbackData = abi.encode(marketId, optionId);

        bytes32 assertionId = optimisticOracle.assertTruth(claim, msg.sender, callbackData);

        m.p2pAssertionId   = assertionId;
        m.p2pAssertionMade = true;

        emit ResolutionRequested(marketId, assertionId);
    }

    /**
     * @notice Step 2 (optional) — Dispute the oracle assertion.
     *         Can be called by anyone who disagrees, within the dispute window.
     *
     * @dev Caller must have approved `defaultBondCurrency` for `minimumBond` to this contract.
     */
    function disputeOracle(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC, "EP: not P2POPTIMISTIC");
        require(m.p2pAssertionMade,                        "EP: no assertion");
        require(!m.isResolved,                             "EP: resolved");
        require(address(optimisticOracle) != address(0),   "EP: oracle not set");
        require(defaultBondCurrency != address(0),         "EP: bond currency not set");

        uint256 bond = optimisticOracle.getMinimumBond(defaultBondCurrency);

        IERC20(defaultBondCurrency).safeTransferFrom(msg.sender, address(this), bond);
        IERC20(defaultBondCurrency).forceApprove(address(optimisticOracle), bond);

        optimisticOracle.disputeAssertion(m.p2pAssertionId, msg.sender);

        emit OracleDisputed(marketId, m.p2pAssertionId, msg.sender);
    }

    /**
     * @notice Step 3 — Settle the oracle assertion after expiration.
     *         Anyone can call. Triggers vote resolution inside the oracle if needed.
     */
    function settleOracle(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC, "EP: not P2POPTIMISTIC");
        require(m.p2pAssertionMade,                        "EP: no assertion");

        optimisticOracle.settleAssertion(m.p2pAssertionId);
        emit OracleSettled(marketId, m.p2pAssertionId);
    }

    /**
     * @notice Step 4 — Resolve the market using the settled oracle result.
     *
     *  Two outcomes:
     *    • result = true  → assertion was accepted; market resolves with the asserted optionId.
     *    • result = false → assertion was rejected (disputer won); market is cancelled
     *                       so all stakers can claim refunds. The true outcome is unknown.
     */
    function resolveP2PMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC, "EP: not P2POPTIMISTIC");
        require(m.p2pAssertionMade,                        "EP: no assertion");
        require(!m.isResolved,                             "EP: resolved");

        (bool oracleResult, bytes memory callbackData) =
            optimisticOracle.getAssertionResult(m.p2pAssertionId);

        emit OracleResultProcessed(marketId, m.p2pAssertionId, oracleResult);

        if (oracleResult) {
            // Assertion accepted — decode the winning option from callbackData
            (, uint256 optionId) = abi.decode(callbackData, (uint256, uint256));

            require(optionId > 0 && optionId <= m.maxOptions, "EP: bad option from oracle");

            m.winningOption = optionId;
            m.isResolved    = true;
            m.state         = MarketState.Resolved;

            _distributeFees(marketId);
            _trackResolution(marketId, m.winningOption);
            emit MarketResolved(marketId, m.winningOption);

        } else {
            // Assertion rejected — cancel market and allow refunds.
            // The asserter lied; we cannot know the real outcome without a new assertion.
            _cancelMarket(marketId, "Oracle assertion rejected — refunds available");
        }
    }

    /**
     * @notice Cancel a P2POPTIMISTIC market if nobody made an assertion within the
     *         grace period after endTime. Allows stakers to claim full refunds.
     *
     *         This prevents permanent fund-lock when the market ends but no one asserts.
     */
    function cancelMarketNoAssertion(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC,         "EP: not P2POPTIMISTIC");
        require(m.state == MarketState.Ended,                      "EP: not ended");
        require(!m.p2pAssertionMade,                               "EP: assertion exists");
        require(block.timestamp >= m.endTime + assertionGracePeriod, "EP: grace period active");

        _cancelMarket(marketId, "No assertion made — refunds available");
    }

    /**
     * @notice Cancel a market after the full resolution period expires without resolution.
     *         Works for both market types. Serves as the last-resort escape hatch.
     */
    function cancelMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Ended,                  "EP: not ended");
        require(block.timestamp >= m.resolutionEndTime,         "EP: resolution period active");
        require(!m.isResolved,                                  "EP: already resolved");

        _cancelMarket(marketId, "Resolution period expired");
    }

    // ─── Claiming ─────────────────────────────────────────────────────────────

    function claimRefund(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Cancelled, "EP: not cancelled");
        require(
            userHasStaked[marketId][msg.sender] || userHasSupported[marketId][msg.sender],
            "EP: nothing to refund"
        );

        uint256 refund;

        if (userHasStaked[marketId][msg.sender]) {
            refund += PoolVault(treasury).getUserStake(marketId, msg.sender, m.paymentToken);
            userHasStaked[marketId][msg.sender] = false;
        }

        if (userHasSupported[marketId][msg.sender]) {
            refund += PoolVault(treasury).getUserSupport(marketId, msg.sender, m.paymentToken);
            userHasSupported[marketId][msg.sender] = false;
        }

        require(refund > 0, "EP: zero refund");

        PoolVault(treasury).claimRefund(marketId, msg.sender, m.paymentToken, refund);
        emit RefundClaimed(marketId, msg.sender, refund);
    }

    function claimWinnings(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Resolved,                      "EP: not resolved");
        require(m.winningOption > 0,                                   "EP: no winner");
        require(userHasStaked[marketId][msg.sender],                   "EP: no stake");
        require(!PoolVault(treasury).hasUserClaimed(marketId, msg.sender), "EP: claimed");

        uint256 winnings = _calculateWinnings(marketId, msg.sender);

        PoolVault(treasury).claimWinnings(marketId, msg.sender, m.paymentToken, winnings);
        emit WinningsClaimed(marketId, msg.sender, winnings);
    }

    function calculateWinnings(uint256 marketId, address user) external view returns (uint256) {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Resolved,                    "EP: not resolved");
        require(m.winningOption > 0,                                 "EP: no winner");
        require(userHasStaked[marketId][user],                       "EP: no stake");
        require(!PoolVault(treasury).hasUserClaimed(marketId, user), "EP: claimed");
        return _calculateWinnings(marketId, user);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _calculateWinnings(uint256 marketId, address user) internal view returns (uint256) {
        Market storage m          = markets[marketId];
        uint256 userStake         = PoolVault(treasury).getUserStake(marketId, user, m.paymentToken);
        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, m.winningOption, m.paymentToken);

        uint256 totalLosingPool;
        for (uint256 i = 1; i <= m.maxOptions; i++) {
            if (i != m.winningOption)
                totalLosingPool += PoolVault(treasury).getOptionPool(marketId, i, m.paymentToken);
        }
        totalLosingPool += PoolVault(treasury).getSupportPool(marketId, m.paymentToken);

        if (totalWinningStake == 0) return 0;

        bool isWinner = userStakeOptions[marketId][user] == m.winningOption;
        if (!isWinner) return 0;

        if (totalLosingPool == 0) return userStake; // all-win: everyone gets stake back

        uint256 winningsPool = (totalLosingPool * 9_000) / 10_000; // 90% after 10% fees
        return userStake + (userStake * winningsPool) / totalWinningStake;
    }

    function _distributeFees(uint256 marketId) internal {
        Market storage m = markets[marketId];

        uint256 totalLosingPool;
        for (uint256 i = 1; i <= m.maxOptions; i++) {
            if (i != m.winningOption)
                totalLosingPool += PoolVault(treasury).getOptionPool(marketId, i, m.paymentToken);
        }
        totalLosingPool += PoolVault(treasury).getSupportPool(marketId, m.paymentToken);

        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, m.winningOption, m.paymentToken);
        uint256 totalPool         = PoolVault(treasury).getMarketPool(marketId, m.paymentToken);

        uint256 creatorFee  = (totalPool * CREATOR_FEE_BPS)  / 10_000;
        uint256 platformFee = (totalPool * PLATFORM_FEE_BPS) / 10_000;

        if (totalWinningStake == 0) {
            // All-lose: platform keeps everything after creator fee
            if (creatorFee > 0)
                PoolVault(treasury).transferToCreator(m.creator, m.paymentToken, creatorFee);
            uint256 platformTotal = totalPool - creatorFee;
            if (platformTotal > 0)
                PoolVault(treasury).addToPlatformPool(m.paymentToken, platformTotal);
        } else if (totalLosingPool == 0) {
            // All-win: no fees taken
        } else {
            if (creatorFee  > 0) PoolVault(treasury).transferToCreator(m.creator, m.paymentToken, creatorFee);
            if (platformFee > 0) PoolVault(treasury).distributeFees(m.paymentToken, platformFee);
        }
    }

    function _cancelMarket(uint256 marketId, string memory reason) internal {
        markets[marketId].state = MarketState.Cancelled;
        if (isActiveMarket[marketId]) _removeFromActiveMarkets(marketId);
        emit MarketCancelled(marketId, reason);
    }

    function _recordStake(
        uint256 marketId,
        address user,
        address token,
        uint256 amount,
        uint256 option
    ) internal {
        if (!userHasStaked[marketId][user]) {
            marketStakers[marketId].push(user);
            userMarketHistory[user].push(marketId);
        }
        userHasStaked[marketId][user]    = true;
        userStakeOptions[marketId][user] = option;

        PoolVault(treasury).placeStake(marketId, user, token, amount, option);

        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) MetricsHub(analytics).trackStake(marketId, user, option, amount);
    }

    function _checkBettingRestriction(Market storage m) internal view {
        if (IAdminManager(adminManager).bettingRestrictionEnabled()) {
            uint256 mins = IAdminManager(adminManager).bettingRestrictionMinutes();
            require(block.timestamp < m.stakeEndTime - mins * 1 minutes, "EP: staking closed");
        } else {
            require(block.timestamp < m.stakeEndTime, "EP: staking closed");
        }
    }

    function _trackCreation(uint256 marketId, address creator, uint256 option, uint256 amount) internal {
        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) {
            MetricsHub(analytics).trackMarketCreation(marketId, creator);
            MetricsHub(analytics).trackStake(marketId, creator, option, amount);
        }
    }

    function _trackResolution(uint256 marketId, uint256 winningOption) internal {
        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0)) MetricsHub(analytics).trackMarketResolution(marketId, winningOption);
    }

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

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setOptimisticOracle(address _oo) external onlyOwner {
        require(_oo != address(0), "EP: zero address");
        optimisticOracle = IOptimisticOracle(_oo);
    }

    function setDefaultBondCurrency(address _currency) external onlyOwner {
        require(_currency != address(0), "EP: zero address");
        defaultBondCurrency = _currency;
    }

    function setAssertionGracePeriod(uint256 _seconds) external onlyOwner {
        require(_seconds >= 1 hours, "EP: too short");
        assertionGracePeriod = _seconds;
    }

    function setAdminManager(address _adminManager) external onlyOwner {
        require(_adminManager != address(0), "EP: zero address");
        adminManager = _adminManager;
    }

    function markMarketDeleted(uint256 marketId) external {
        require(msg.sender == adminManager,              "EP: only AdminManager");
        require(marketId < nextMarketId,                 "EP: bad ID");
        require(markets[marketId].creator != address(0), "EP: no market");
        require(markets[marketId].state != MarketState.Deleted, "EP: already deleted");

        markets[marketId].state = MarketState.Deleted;
        if (isActiveMarket[marketId]) _removeFromActiveMarkets(marketId);
        emit MarketCancelled(marketId, "Deleted by admin");
    }

    function markMarketPermanentlyRemoved(uint256 marketId) external {
        require(msg.sender == adminManager,                        "EP: only AdminManager");
        require(markets[marketId].state == MarketState.Resolved,   "EP: not resolved");
        delete markets[marketId];
        if (isActiveMarket[marketId]) _removeFromActiveMarkets(marketId);
        emit MarketCancelled(marketId, "Permanently removed");
    }

    // ─── View functions ───────────────────────────────────────────────────────

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

    function getNextMarketId() external view returns (uint256) {
        return nextMarketId;
    }

    receive() external payable {}
}
