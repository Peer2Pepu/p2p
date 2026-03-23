// @p2p-oracle-system
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title P2PMarketManager
 * @notice P2P prediction market contract.
 *
 * ─── Oracle integration (P2POPTIMISTIC markets) ──────────────────────────────
 *
 *  Resolution flow:
 *
 *  1. endMarket(id)                  — anyone, after market.endTime
 *  2. requestP2PResolution(id, ...)  — anyone except creator, after endTime;
 *                                      posts a claim + bond to the oracle
 *  3. [optional] disputeOracle(id)   — anyone who disagrees with the assertion;
 *                                      posts a counter-bond and supplies the option
 *                                      they believe actually won; triggers a
 *                                      token-weighted vote in P2PVoting
 *  4. settleOracle(id)               — anyone, after the oracle expirationTime
 *                                      (which is >= vote window close)
 *  5. resolveP2PMarket(id)           — anyone, after oracle is settled
 *
 *  Fallback paths that prevent permanent fund-lock:
 *
 *  • If nobody asserts within ASSERTION_GRACE_PERIOD after endTime
 *    → cancelMarketNoAssertion(id) cancels the market and allows refunds.
 *
 *  • If the oracle vote had no consensus, the oracle automatically accepts the
 *    assertion as true and returns both bonds. Market resolves to the originally
 *    asserted option. This is handled inside the oracle.
 *
 * ─── Fee model ────────────────────────────────────────────────────────────────
 *
 *  Fees are taken ONLY from the losing pool (not total pool).
 *  This ensures: sum(winner payouts) + sum(fees) == totalPool exactly.
 *
 *    creatorFee  = losingPool * CREATOR_FEE_BPS  / 10_000   (3.5%)
 *    platformFee = losingPool * PLATFORM_FEE_BPS / 10_000   (5.0%)
 *    winningsPool = losingPool * NET_WINNER_BPS  / 10_000   (91.5%)
 *
 *  Each winner receives their original stake back, plus a pro-rata share of
 *  winningsPool proportional to their stake in the winning pool.
 *
 *  Edge cases:
 *    • All-win (totalLosingPool == 0): everyone gets stake back; no fees taken.
 *    • All-lose (totalWinningStake == 0): platform keeps all after creator fee.
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

contract P2PMarketManager is Ownable {
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
        uint256     resolvedTimestamp;
        uint256     resolvedPrice;
        MarketType  marketType;
        // PRICE_FEED fields
        address     priceFeed;
        uint256     priceThreshold;
        // P2POPTIMISTIC fields
        bytes32     p2pAssertionId;
        bool        p2pAssertionMade;
        // Option ID the disputer claimed won. 0 = not disputed.
        // Used as the winning option if the oracle rejects the original assertion
        // (i.e. oracleResult = false, meaning the asserter lied and disputer was right).
        uint256     p2pDisputedOptionId;
    }

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant marketCreationFee = 1e18;

    /// @notice Fee percentages — applied to losingPool only, not totalPool.
    uint256 public constant CREATOR_FEE_BPS   = 350;   // 3.5%
    uint256 public constant PLATFORM_FEE_BPS  = 500;   // 5.0%
    uint256 public constant TOTAL_FEE_BPS     = 850;   // 8.5% (sum of above)
    /// @notice Basis points of losingPool that flow to winners after fees.
    uint256 public constant NET_WINNER_BPS    = 9_150; // 91.5% = 10_000 - 850

    /**
     * @notice Grace period after market.endTime during which someone must assert.
     *         If no assertion is made within this window, the market can be cancelled.
     */
    uint256 public assertionGracePeriod = 48 hours;

    // ─── Storage ──────────────────────────────────────────────────────────────

    mapping(uint256 => Market)                                      public markets;
    mapping(uint256 => mapping(address => bool))                    public userHasStaked;
    mapping(uint256 => mapping(address => bool))                    public userHasSupported;
    mapping(uint256 => mapping(address => uint256))                 public userStakeOptions;
    mapping(uint256 => address[])                                   public marketStakers;
    mapping(uint256 => address[])                                   public marketSupporters;
    mapping(address => uint256[])                                   public userMarketHistory;

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
    event MarketResolvedDetailed(
        uint256 indexed marketId,
        uint256 winningOption,
        uint256 resolvedTimestamp,
        uint256 resolvedPrice
    );
    event MarketCancelled(uint256 indexed marketId, string reason);
    event RefundClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event ResolutionRequested(uint256 indexed marketId, bytes32 indexed assertionId);
    event OracleDisputed(uint256 indexed marketId, bytes32 indexed assertionId, address indexed disputer, uint256 disputedOptionId);
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
            require(priceFeed != address(0), "EP: feed required");
            require(priceThreshold > 0,      "EP: threshold required");
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

        uint256 startTime         = block.timestamp;
        uint256 stakeEndTime      = startTime + stakeDurationMinutes      * 1 minutes;
        uint256 endTime           = startTime + resolutionDurationMinutes * 1 minutes;
        // For P2POPTIMISTIC: oracle expiry = assertionWindow(2h) + liveness(26h) = 28h; add 2h buffer
        uint256 resolutionEndTime = marketType == MarketType.PRICE_FEED
            ? endTime
            : endTime + 30 hours;

        uint256 marketId = nextMarketId++;
        markets[marketId] = Market({
            creator:             msg.sender,
            ipfsHash:            ipfsHash,
            isMultiOption:       isMultiOption,
            maxOptions:          maxOptions,
            paymentToken:        paymentToken,
            minStake:            minStake,
            creatorDeposit:      creatorDeposit,
            creatorOutcome:      creatorOutcome,
            startTime:           startTime,
            stakeEndTime:        stakeEndTime,
            endTime:             endTime,
            resolutionEndTime:   resolutionEndTime,
            state:               MarketState.Active,
            winningOption:       0,
            isResolved:          false,
            resolvedTimestamp:   0,
            resolvedPrice:       0,
            marketType:          marketType,
            priceFeed:           priceFeed,
            priceThreshold:      priceThreshold,
            p2pAssertionId:      bytes32(0),
            p2pAssertionMade:    false,
            p2pDisputedOptionId: 0
        });

        activeMarkets.push(marketId);
        isActiveMarket[marketId] = true;

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

    function placeStake(uint256 marketId, uint256 option)
        external payable notDeleted(marketId)
    {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Active,        "EP: not active");
        require(m.paymentToken == address(0),         "EP: use placeStakeWithToken");
        require(option > 0 && option <= m.maxOptions, "EP: bad option");

        _checkBettingRestriction(m);

        uint256 amount = msg.value;
        require(amount >= m.minStake, "EP: below min");

        (bool ok, ) = treasury.call{value: amount}("");
        require(ok, "EP: treasury send failed");

        _recordStake(marketId, msg.sender, m.paymentToken, amount, option);
        emit StakePlaced(marketId, msg.sender, option, amount);
    }

    function placeStakeWithToken(uint256 marketId, uint256 option, uint256 amount)
        external notDeleted(marketId)
    {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Active,        "EP: not active");
        require(m.paymentToken != address(0),         "EP: use placeStake");
        require(option > 0 && option <= m.maxOptions, "EP: bad option");
        require(amount >= m.minStake,                 "EP: below min");

        _checkBettingRestriction(m);

        IERC20(m.paymentToken).safeTransferFrom(msg.sender, treasury, amount);

        _recordStake(marketId, msg.sender, m.paymentToken, amount, option);
        emit StakePlaced(marketId, msg.sender, option, amount);
    }

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

    function withdrawSupport(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(userHasSupported[marketId][msg.sender], "EP: no support");

        if (m.state == MarketState.Active) {
            require(block.timestamp < m.stakeEndTime - 12 hours, "EP: too late to withdraw");
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

    function endMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Active, "EP: not active");
        require(block.timestamp >= m.endTime,  "EP: not ended");

        m.state = MarketState.Ended;
        _removeFromActiveMarkets(marketId);
    }

    function creatorCancelMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(msg.sender == m.creator,                      "EP: not creator");
        require(m.state == MarketState.Active,                "EP: not active");
        require(block.timestamp < m.stakeEndTime - 12 hours, "EP: too late");

        _cancelMarket(marketId, "Creator cancelled");
    }

    // ─── PRICE_FEED resolution ────────────────────────────────────────────────

    function resolvePriceFeedMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.PRICE_FEED, "EP: not PRICE_FEED");
        require(m.state == MarketState.Ended,           "EP: not ended");
        require(!m.isResolved,                          "EP: already resolved");
        require(block.timestamp >= m.resolutionEndTime, "EP: too early");

        AggregatorV3Interface feed = AggregatorV3Interface(m.priceFeed);
        (, int256 price, , , ) = feed.latestRoundData();

        m.winningOption     = uint256(price) >= m.priceThreshold ? 1 : 2;
        m.resolvedPrice     = uint256(price);
        m.isResolved        = true;
        m.resolvedTimestamp = block.timestamp;
        m.state             = MarketState.Resolved;

        _distributeFees(marketId);
        _trackResolution(marketId, m.winningOption);
        emit MarketResolved(marketId, m.winningOption);
        emit MarketResolvedDetailed(marketId, m.winningOption, m.resolvedTimestamp, m.resolvedPrice);
    }

    // ─── P2POPTIMISTIC resolution ─────────────────────────────────────────────

    /**
     * @notice Step 1 — Post an assertion claiming a specific option won.
     * @param marketId  The market to assert for.
     * @param optionId  The winning option (1-based). Encoded into callbackData.
     * @param claim     Human-readable description, e.g. "Option 2 (No) won".
     *
     * @dev Caller must approve `defaultBondCurrency` for `minimumBond` to this contract.
     *      Cannot be the market creator (prevents self-assertion).
     *      Must have a stake in the market.
     */
    function requestP2PResolution(
        uint256 marketId,
        uint256 optionId,
        bytes calldata claim
    ) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC,  "EP: not P2POPTIMISTIC");
        require(m.state == MarketState.Ended,              "EP: not ended");
        require(!m.isResolved,                             "EP: resolved");
        require(!m.p2pAssertionMade,                       "EP: assertion exists");
        require(msg.sender != m.creator,                   "EP: creator cannot assert");
        require(userHasStaked[marketId][msg.sender],        "EP: must have stake");
        require(optionId > 0 && optionId <= m.maxOptions,  "EP: bad option");
        require(address(optimisticOracle) != address(0),   "EP: oracle not set");
        require(defaultBondCurrency != address(0),         "EP: bond currency not set");

        uint256 bond = optimisticOracle.getMinimumBond(defaultBondCurrency);

        IERC20(defaultBondCurrency).safeTransferFrom(msg.sender, address(this), bond);
        IERC20(defaultBondCurrency).forceApprove(address(optimisticOracle), bond);

        bytes memory callbackData = abi.encode(marketId, optionId);
        bytes32 assertionId = optimisticOracle.assertTruth(claim, msg.sender, callbackData);

        m.p2pAssertionId   = assertionId;
        m.p2pAssertionMade = true;

        emit ResolutionRequested(marketId, assertionId);
    }

    /**
     * @notice Step 2 (optional) — Dispute the oracle assertion.
     *
     *         The disputer must supply the option ID they believe actually won.
     *         If the community vote agrees the original assertion was wrong
     *         (majority votes REJECT), the market resolves to the disputer's optionId.
     *
     *         Design rationale: the disputer must have skin-in-the-game knowledge
     *         of what the correct outcome is, not just that the asserter was wrong.
     *         They put up a bond for this. If they're right, they win both bonds.
     *
     * @param marketId The market to dispute.
     * @param optionId The option the disputer claims actually won.
     */
    function disputeOracle(uint256 marketId, uint256 optionId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC,  "EP: not P2POPTIMISTIC");
        require(m.p2pAssertionMade,                         "EP: no assertion");
        require(!m.isResolved,                              "EP: resolved");
        require(m.p2pDisputedOptionId == 0,                 "EP: already disputed");
        require(address(optimisticOracle) != address(0),    "EP: oracle not set");
        require(defaultBondCurrency != address(0),          "EP: bond currency not set");
        require(optionId > 0 && optionId <= m.maxOptions,  "EP: invalid option");

        uint256 bond = optimisticOracle.getMinimumBond(defaultBondCurrency);

        IERC20(defaultBondCurrency).safeTransferFrom(msg.sender, address(this), bond);
        IERC20(defaultBondCurrency).forceApprove(address(optimisticOracle), bond);

        optimisticOracle.disputeAssertion(m.p2pAssertionId, msg.sender);

        m.p2pDisputedOptionId = optionId;

        emit OracleDisputed(marketId, m.p2pAssertionId, msg.sender, optionId);
    }

    /**
     * @notice Step 3 — Settle the oracle assertion after expiration.
     *         Anyone can call. Internally triggers vote resolution if the vote has closed.
     *
     * @dev Will revert with "OO: vote window still open" if called before
     *      the vote window closes. Try again once the voting period ends.
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
     *    • oracleResult = true  → assertion accepted; market resolves with the asserted optionId.
     *    • oracleResult = false → assertion rejected (disputer won); market resolves with
     *                             the disputed optionId the disputer supplied.
     *
     *  Note: oracleResult=false can ONLY occur if disputeOracle() was called, which
     *  always sets p2pDisputedOptionId > 0. There is no path where this value is 0
     *  when oracleResult=false — the oracle only returns false after a successful
     *  community vote rejecting the assertion (Path B in the oracle).
     */
    function resolveP2PMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC, "EP: not P2POPTIMISTIC");
        require(m.p2pAssertionMade,                        "EP: no assertion");
        require(!m.isResolved,                             "EP: resolved");

        (bool oracleResult, bytes memory callbackData) =
            optimisticOracle.getAssertionResult(m.p2pAssertionId);

        emit OracleResultProcessed(marketId, m.p2pAssertionId, oracleResult);

        uint256 optionId;
        if (oracleResult) {
            // Assertion accepted — decode winning option from callbackData
            (, optionId) = abi.decode(callbackData, (uint256, uint256));
        } else {
            // Assertion rejected — disputer's option wins.
            // p2pDisputedOptionId is always set here (see NatSpec above).
            optionId = m.p2pDisputedOptionId;
        }

        require(optionId > 0 && optionId <= m.maxOptions, "EP: bad option");

        m.winningOption     = optionId;
        m.resolvedPrice     = 0;
        m.isResolved        = true;
        m.resolvedTimestamp = block.timestamp;
        m.state             = MarketState.Resolved;

        _distributeFees(marketId);
        _trackResolution(marketId, m.winningOption);
        emit MarketResolved(marketId, m.winningOption);
        emit MarketResolvedDetailed(marketId, m.winningOption, m.resolvedTimestamp, 0);
    }

    /**
     * @notice Cancel a P2POPTIMISTIC market if nobody made an assertion within the
     *         grace period after endTime. Allows stakers to claim full refunds.
     */
    function cancelMarketNoAssertion(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.marketType == MarketType.P2POPTIMISTIC,           "EP: not P2POPTIMISTIC");
        require(m.state == MarketState.Ended,                        "EP: not ended");
        require(!m.p2pAssertionMade,                                 "EP: assertion exists");
        require(block.timestamp >= m.endTime + assertionGracePeriod, "EP: grace period active");

        _cancelMarket(marketId, unicode"No assertion made — refunds available");
    }

    /**
     * @notice Cancel a market after the full resolution period expires without resolution.
     *         Last-resort escape hatch for both market types.
     */
    function cancelMarket(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.state == MarketState.Ended,                "EP: not ended");
        require(block.timestamp >= m.resolutionEndTime,       "EP: resolution period active");
        require(!m.isResolved,                                "EP: already resolved");

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
        require(m.state == MarketState.Resolved,                          "EP: not resolved");
        require(m.winningOption > 0,                                       "EP: no winner");
        require(userHasStaked[marketId][msg.sender],                       "EP: no stake");
        require(!PoolVault(treasury).hasUserClaimed(marketId, msg.sender), "EP: claimed");

        uint256 winnings = _calculateWinnings(marketId, msg.sender);

        PoolVault(treasury).claimWinnings(marketId, msg.sender, m.paymentToken, winnings);
        emit WinningsClaimed(marketId, msg.sender, winnings);

        address analytics = IAdminManager(adminManager).analytics();
        if (analytics != address(0) && winnings > 0 && MetricsHub(analytics).isTrackedPaymentToken(m.paymentToken)) {
            MetricsHub(analytics).trackWinnings(marketId, msg.sender, winnings, m.paymentToken);
        }
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

    /**
     * @notice Calculate winnings for a user in a resolved market.
     *
     * Fee model (fees from losingPool only):
     *   losingPool   = sum of all non-winning option stakes + support pool
     *   creatorFee   = losingPool * CREATOR_FEE_BPS  / 10_000
     *   platformFee  = losingPool * PLATFORM_FEE_BPS / 10_000
     *   winningsPool = losingPool * NET_WINNER_BPS   / 10_000
     *
     *   payout = userStake + (userStake / totalWinningStake) * winningsPool
     *
     * Invariant: sum(all payouts) + creatorFee + platformFee == totalPool
     */
    function _calculateWinnings(uint256 marketId, address user) internal view returns (uint256) {
        Market storage m = markets[marketId];

        uint256 userStake         = PoolVault(treasury).getUserStake(marketId, user, m.paymentToken);
        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, m.winningOption, m.paymentToken);

        uint256 losingPool = _getLosingPool(marketId);

        bool isWinner = userStakeOptions[marketId][user] == m.winningOption;
        if (!isWinner) return 0;
        if (totalWinningStake == 0) return 0;
        if (losingPool == 0) return userStake; // All-win: everyone gets stake back

        // winningsPool is what remains of losingPool after creator + platform fees
        uint256 winningsPool = (losingPool * NET_WINNER_BPS) / 10_000;
        return userStake + (userStake * winningsPool) / totalWinningStake;
    }

    /**
     * @notice Distribute creator and platform fees on market resolution.
     *
     *  Fees come from the losing pool only, ensuring:
     *    sum(winner payouts) + creatorFee + platformFee == totalPool
     *
     *  Edge cases:
     *    • All-win (losingPool == 0): no fees taken.
     *    • All-lose (totalWinningStake == 0): platform takes all after creator fee.
     */
    function _distributeFees(uint256 marketId) internal {
        Market storage m = markets[marketId];

        uint256 totalWinningStake = PoolVault(treasury).getOptionPool(marketId, m.winningOption, m.paymentToken);
        uint256 losingPool        = _getLosingPool(marketId);

        if (losingPool == 0) {
            // All-win: everyone gets stake back. No fees.
            return;
        }

        uint256 creatorFee  = (losingPool * CREATOR_FEE_BPS)  / 10_000;
        uint256 platformFee = (losingPool * PLATFORM_FEE_BPS) / 10_000;

        if (totalWinningStake == 0) {
            // All-lose: no winners. Platform takes all after creator fee.
            if (creatorFee > 0)
                PoolVault(treasury).transferToCreator(m.creator, m.paymentToken, creatorFee);
            uint256 platformTotal = losingPool - creatorFee; // includes what would have been NET_WINNER_BPS
            if (platformTotal > 0)
                PoolVault(treasury).addToPlatformPool(m.paymentToken, platformTotal);
        } else {
            // Normal case: distribute creator and platform fees from the losing pool.
            if (creatorFee  > 0) PoolVault(treasury).transferToCreator(m.creator, m.paymentToken, creatorFee);
            if (platformFee > 0) PoolVault(treasury).distributeFees(m.paymentToken, platformFee);
            // The remaining losingPool * NET_WINNER_BPS / 10_000 stays in the vault
            // to be claimed by winners via claimWinnings().
        }
    }

    /**
     * @notice Sum of all non-winning stakes plus the support pool.
     */
    function _getLosingPool(uint256 marketId) internal view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 losingPool;
        for (uint256 i = 1; i <= m.maxOptions; i++) {
            if (i != m.winningOption)
                losingPool += PoolVault(treasury).getOptionPool(marketId, i, m.paymentToken);
        }
        losingPool += PoolVault(treasury).getSupportPool(marketId, m.paymentToken);
        return losingPool;
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
        require(msg.sender == adminManager,               "EP: only AdminManager");
        require(marketId < nextMarketId,                  "EP: bad ID");
        require(markets[marketId].creator != address(0),  "EP: no market");
        require(markets[marketId].state != MarketState.Deleted, "EP: already deleted");

        markets[marketId].state = MarketState.Deleted;
        if (isActiveMarket[marketId]) _removeFromActiveMarkets(marketId);
        emit MarketCancelled(marketId, "Deleted by admin");
    }

    function markMarketPermanentlyRemoved(uint256 marketId) external {
        require(msg.sender == adminManager,                      "EP: only AdminManager");
        require(markets[marketId].state == MarketState.Resolved, "EP: not resolved");
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
