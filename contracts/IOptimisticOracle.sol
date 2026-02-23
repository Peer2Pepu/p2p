// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IOptimisticOracle
 * @notice Standard interface for the P2P Optimistic Oracle.
 *         Any dapp integrating the oracle should import and use this interface,
 *         not the concrete implementation directly.
 *
 * ─── Integration flow ────────────────────────────────────────────────────────
 *
 *  1. ASSERT
 *     Someone (not the "interested party") calls assertTruth() with a plain-text
 *     claim and puts up a bond. They are saying "this claim is true."
 *
 *  2. DISPUTE  (optional, within dispute window)
 *     Anyone who disagrees calls disputeAssertion() and puts up an equal bond.
 *     This triggers a token-weighted vote in the P2PVoting contract.
 *
 *  3. SETTLE
 *     After the dispute + voting window, anyone calls settleAssertion().
 *     Three outcomes:
 *       a) No dispute   → assertion accepted, asserter's bond returned.
 *       b) Vote passes  → assertion accepted or rejected per vote majority,
 *                         winner gets both bonds.
 *       c) Vote fails (no consensus / reverts) → assertion accepted by default,
 *                         BOTH parties' bonds returned (no one penalised).
 *
 *  4. READ RESULT
 *     Call getAssertionResult() to read the settled bool and the callbackData
 *     that was embedded when the assertion was made. The integrator uses
 *     callbackData however they like (option ID, market ID, etc.).
 *
 * ─── Bond flow ────────────────────────────────────────────────────────────────
 *
 *  The oracle pulls bond tokens from msg.sender on both assertTruth() and
 *  disputeAssertion(). Integrating contracts must:
 *    1. Pull the bond from the end-user to the integrating contract.
 *    2. Approve the oracle to spend that amount.
 *    3. Call assertTruth() / disputeAssertion() — oracle pulls from msg.sender
 *       (the integrating contract).
 */
interface IOptimisticOracle {
    // ─── Events ───────────────────────────────────────────────────────────────

    event AssertionMade(
        bytes32 indexed assertionId,
        address indexed asserter,
        bytes           claim,
        bytes           callbackData,
        uint256         expirationTime
    );

    event AssertionDisputed(
        bytes32 indexed assertionId,
        address indexed disputer
    );

    event AssertionSettled(
        bytes32 indexed assertionId,
        bool            result,
        bool            hadDispute
    );

    // ─── State-changing ───────────────────────────────────────────────────────

    /**
     * @notice Submit a truthful assertion. The caller puts up a bond.
     * @param claim        Human-readable UTF-8 claim (stored on-chain for transparency).
     * @param asserter     Address credited if assertion is accepted (receives bond back).
     *                     Usually msg.sender, but can be a different address.
     * @param callbackData Arbitrary bytes the integrator wants returned with the result.
     *                     E.g. abi.encode(marketId, optionId). Oracle is agnostic to this.
     * @return assertionId Unique ID for this assertion.
     */
    function assertTruth(
        bytes calldata claim,
        address        asserter,
        bytes calldata callbackData
    ) external returns (bytes32 assertionId);

    /**
     * @notice Dispute an open assertion. Caller puts up an equal bond.
     *         Can only be called after assertionDeadline and before expirationTime.
     * @param assertionId  The assertion to challenge.
     * @param disputer     Address credited if dispute succeeds (receives both bonds).
     */
    function disputeAssertion(
        bytes32 assertionId,
        address disputer
    ) external;

    /**
     * @notice Settle a finalized assertion. Can be called by anyone.
     *         Resolves the outcome, distributes bonds, and marks the assertion settled.
     */
    function settleAssertion(bytes32 assertionId) external;

    // ─── Read-only ────────────────────────────────────────────────────────────

    /**
     * @notice Returns the result of a settled assertion.
     * @param assertionId  The assertion to query.
     * @return result       true  = assertion accepted (asserter was right).
     *                      false = assertion rejected (disputer was right).
     * @return callbackData The bytes passed in when the assertion was made.
     */
    function getAssertionResult(bytes32 assertionId)
        external
        view
        returns (bool result, bytes memory callbackData);

    /**
     * @notice Minimum bond required to make or dispute an assertion.
     * @param currency ERC-20 token address. Reverts if currency is not supported.
     */
    function getMinimumBond(address currency) external view returns (uint256);

    /**
     * @notice Full assertion details for off-chain inspection or integrator logic.
     * @dev voteRequestId is bytes32(0) if the assertion was never disputed.
     *      When disputed, it is the requestId used in P2PVoting — read it directly
     *      instead of recomputing it off-chain to avoid encoding mismatches.
     */
    function getAssertion(bytes32 assertionId)
        external
        view
        returns (
            bytes   memory claim,
            address        asserter,
            address        disputer,
            uint256        assertionTime,
            uint256        assertionDeadline,
            uint256        expirationTime,
            bool           settled,
            bool           result,
            address        currency,
            uint256        bond,
            bytes   memory callbackData,
            bytes32        voteRequestId
        );
}
