# UMA + Price Feed Integration - Implementation Summary

## ✅ Completed Changes

### 1. Contract Updates (`P2PMarketManager.sol`)

#### Added:
- **UMA Interfaces**: `OptimisticOracleV3`, `Finder`, `AggregatorV3Interface`
- **MarketType Enum**: `PRICE_FEED` (0) and `UMA_MANUAL` (1)
- **Market Struct Fields**:
  - `marketType`: MarketType enum
  - `priceFeed`: Address of price feed (for PRICE_FEED markets)
  - `priceThreshold`: Price threshold in USD (for PRICE_FEED markets)
  - `umaAssertionId`: UMA assertion ID (for UMA_MANUAL markets)
  - `umaAssertionMade`: Whether UMA assertion was made
- **UMA Configuration State Variables**:
  - `optimisticOracle`: UMA OptimisticOracleV3 address
  - `finder`: UMA Finder address
  - `defaultBondCurrency`: Currency for UMA bonds
  - `defaultBond`: Default bond amount
  - `defaultLiveness`: Default liveness period (seconds)
  - `defaultIdentifier`: UMA identifier

#### Removed:
- `P2PVerification.sol` import (no longer needed)
- `VERIFIER_FEE_BPS` constant
- `marketResolvingVerifiers` mapping
- `_trackResolvingVerifiers()` function
- `getMarketResolvingVerifiers()` view function
- Verifier fee distribution logic

#### New Functions:
- `resolvePriceFeedMarket(uint256 marketId)`: Resolves price feed markets directly (no UMA)
- `requestUMAResolution(uint256 marketId, bytes memory claim)`: Makes UMA assertion
- `settleUMAMarket(uint256 marketId, uint256 winningOption)`: Settles UMA market after liveness
- `setFinder(address _finder)`: Set UMA Finder (auto-updates OptimisticOracle)
- `setOptimisticOracle(address _oo)`: Set OptimisticOracle directly
- `setDefaultBond(address _currency, uint256 _amount)`: Configure UMA bond
- `setDefaultLiveness(uint64 _liveness)`: Configure liveness period
- `setDefaultIdentifier(bytes32 _identifier)`: Configure UMA identifier

#### Updated Functions:
- `createMarket()`: Now accepts `marketType`, `priceFeed`, and `priceThreshold` parameters
- `_distributeFees()`: Removed verifier fee distribution

#### Removed Functions:
- `resolveMarket(uint256 marketId, uint256 _winningOption)`: Replaced by new resolution functions
- `autoResolve(uint256 marketId)`: Replaced by new resolution functions

---

## ⚠️ Frontend/API Updates Needed

### 1. API Route: `src/app/api/resolve-market/route.ts`
**Current Issue**: Uses old `resolveMarket()` and `autoResolve()` functions

**Required Changes**:
- Check market type (`market.marketType`)
- For `PRICE_FEED` markets: Call `resolvePriceFeedMarket(marketId)`
- For `UMA_MANUAL` markets: 
  - First call `requestUMAResolution(marketId, claim)` with claim bytes
  - After liveness period: Call `settleUMAMarket(marketId, winningOption)`
- Remove verifier-related logic

### 2. Market Creation: `src/app/create-market/page.tsx`
**Required Changes**:
- Add UI for selecting market type (PRICE_FEED vs UMA_MANUAL)
- For PRICE_FEED markets:
  - Add price feed address selector
  - Add price threshold input
- Update `createMarket()` call to include new parameters:
  ```typescript
  contract.createMarket(
    ipfsHash,
    isMultiOption,
    maxOptions,
    paymentToken,
    minStake,
    creatorDeposit,
    creatorOutcome,
    stakeDurationMinutes,
    resolutionDurationMinutes,
    marketType,      // NEW: 0 or 1
    priceFeed,       // NEW: address or zero
    priceThreshold   // NEW: uint256 or 0
  )
  ```

### 3. Market Resolution UI: `src/app/resolve/page.tsx`
**Required Changes**:
- Display market type
- For PRICE_FEED markets: Show "Resolve" button that calls `resolvePriceFeedMarket()`
- For UMA_MANUAL markets: 
  - Show "Request UMA Resolution" button (with claim input)
  - Show assertion status
  - Show "Settle" button after liveness period

### 4. Market Display Components
**Required Changes**:
- Show market type badge (PRICE_FEED / UMA_MANUAL)
- For PRICE_FEED markets: Display price feed address and threshold
- For UMA_MANUAL markets: Display UMA assertion status

---

## 🔧 Configuration Required

### After Deployment:

1. **Set UMA Finder**:
   ```solidity
   marketManager.setFinder(finderAddress);
   ```

2. **Set Default Bond** (if not using Finder auto-config):
   ```solidity
   marketManager.setOptimisticOracle(ooAddress);
   marketManager.setDefaultBond(p2pTokenAddress, 1000 * 1e18); // 1000 P2P tokens
   marketManager.setDefaultLiveness(7200); // 2 hours
   marketManager.setDefaultIdentifier(keccak256("ASSERT_TRUTH"));
   ```

3. **Get UMA Addresses**:
   - Check `p2p/oracle/p2p-oracle/packages/core/networks/97741.json` for deployed addresses

---

## 📋 Migration Notes

### For Existing Markets:
- Old markets created before this update will have `marketType = PRICE_FEED` (default enum value = 0)
- They will need to be resolved using the old method or migrated
- Consider adding a migration function if needed

### Breaking Changes:
- `createMarket()` signature changed - all callers must be updated
- `resolveMarket()` and `autoResolve()` removed - use new functions
- Verifier system completely removed

---

## 🧪 Testing Checklist

- [ ] Create PRICE_FEED market with price feed address
- [ ] Create UMA_MANUAL market
- [ ] Resolve PRICE_FEED market (should read price directly)
- [ ] Request UMA resolution for UMA_MANUAL market
- [ ] Settle UMA market after liveness period
- [ ] Verify fee distribution (no verifier fees)
- [ ] Test market creation with all parameters
- [ ] Test edge cases (stale price feed, disputed UMA assertion)

---

## 📝 Next Steps

1. Update frontend/API to use new contract functions
2. Deploy updated contract
3. Configure UMA addresses
4. Test end-to-end flow
5. Update documentation for users
