// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ✅ COPY THIS FILE - Fixed PoolVault with platform pool tracking and proper partner allocation

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interface for MarketManager
interface IMarketManager {
    function getMarketResolvingVerifiers(uint256 marketId) external view returns (address[] memory);
}

contract PoolVault is Ownable {
    using SafeERC20 for IERC20;

    // Platform fee percentage (5% = 500 basis points)
    uint256 public constant PLATFORM_FEE_BPS = 500;
    
    // Partner fee percentage (20% of platform fee = 1% of total = 100 basis points)
    uint256 public constant PARTNER_FEE_BPS = 100;
    
    // Partner address
    address public partner;
    
    // Authorized contracts that can distribute fees
    mapping(address => bool) public authorizedContracts;
    
    // MarketManager address (can be changed)
    address public marketManager;
    
    // Platform pool tracking - separate for each token
    mapping(address => uint256) public platformPools; // token => platform pool amount
    
    // Market fund tracking
    mapping(uint256 => mapping(address => uint256)) public marketPools; // marketId => token => total amount
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public optionPools; // marketId => option => token => amount
    mapping(uint256 => mapping(address => uint256)) public supportPools; // marketId => token => support amount
    mapping(uint256 => mapping(address => mapping(address => uint256))) public userStakes; // marketId => user => token => stake amount
    mapping(uint256 => mapping(address => mapping(address => uint256))) public userSupports; // marketId => user => token => support amount
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public userBetOptions; // marketId => user => option => bet amount
    mapping(uint256 => mapping(address => bool)) public userClaimed; // marketId => user => has claimed
    mapping(uint256 => mapping(address => bool)) public userSupportClaimed; // marketId => user => has claimed support
    
    // Events
    event PartnerUpdated(address indexed oldPartner, address indexed newPartner);
    event FeesDistributed(address indexed token, uint256 platformAmount, uint256 partnerAmount);
    event PlatformPoolUpdated(address indexed token, uint256 amount, string reason);
    event PlatformFundsWithdrawn(address indexed token, uint256 amount, address indexed to);
    event FundsWithdrawn(address indexed token, uint256 amount, address indexed to);
    event ContractAuthorized(address indexed contractAddr);
    event ContractDeauthorized(address indexed contractAddr);
    event MarketManagerUpdated(address indexed oldManager, address indexed newManager);

    constructor(address initialOwner, address _partner) Ownable(initialOwner) {
        partner = _partner;
    }

    /**
     * @dev Update partner address
     */
    function setPartner(address _partner) external onlyOwner {
        require(_partner != address(0), "Treasury: Invalid partner address");
        address oldPartner = partner;
        partner = _partner;
        emit PartnerUpdated(oldPartner, _partner);
    }

    /**
     * @dev Calculate platform and partner fees from total amount
     */
    function calculateFees(uint256 totalAmount) public pure returns (uint256 platformFee, uint256 partnerFee) {
        platformFee = (totalAmount * PLATFORM_FEE_BPS) / 10000;
        partnerFee = (platformFee * PARTNER_FEE_BPS) / 10000;
    }

    /**
     * @dev Authorize a contract to distribute fees
     */
    function authorizeContract(address contractAddr) external onlyOwner {
        require(contractAddr != address(0), "Treasury: Invalid contract address");
        authorizedContracts[contractAddr] = true;
        emit ContractAuthorized(contractAddr);
    }

    /**
     * @dev Deauthorize a contract from distributing fees
     */
    function deauthorizeContract(address contractAddr) external onlyOwner {
        authorizedContracts[contractAddr] = false;
        emit ContractDeauthorized(contractAddr);
    }

    /**
     * @dev Set MarketManager address
     */
    function setMarketManager(address _marketManager) external onlyOwner {
        require(_marketManager != address(0), "Treasury: Invalid market manager address");
        address oldManager = marketManager;
        marketManager = _marketManager;
        
        // Auto-authorize the new market manager
        authorizedContracts[_marketManager] = true;
        
        emit MarketManagerUpdated(oldManager, _marketManager);
        emit ContractAuthorized(_marketManager);
    }

    /**
     * @dev Distribute fees to platform and partner (for normal fee distribution)
     * @param token ERC20 token address (address(0) for native ETH)
     * @param totalAmount Total amount to distribute fees from
     */
    function distributeFees(address token, uint256 totalAmount) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can distribute fees");
        require(totalAmount > 0, "Treasury: Invalid amount");
        
        (uint256 platformFee, uint256 partnerFee) = calculateFees(totalAmount);
        
        if (token == address(0)) {
            // Native ETH
            require(address(this).balance >= totalAmount, "Treasury: Insufficient ETH balance");
            
            if (partnerFee > 0) {
                (bool success, ) = partner.call{value: partnerFee}("");
                require(success, "Treasury: ETH transfer to partner failed");
            }
            
            // Add platform fee to platform pool
            platformPools[token] += (platformFee - partnerFee);
            emit PlatformPoolUpdated(token, (platformFee - partnerFee), "Regular fee distribution");
            
            emit FeesDistributed(token, platformFee, partnerFee);
        } else {
            // ERC20 token
            IERC20 tokenContract = IERC20(token);
            require(tokenContract.balanceOf(address(this)) >= totalAmount, "Treasury: Insufficient token balance");
            
            if (partnerFee > 0) {
                tokenContract.safeTransfer(partner, partnerFee);
            }
            
            // Add platform fee to platform pool
            platformPools[token] += (platformFee - partnerFee);
            emit PlatformPoolUpdated(token, (platformFee - partnerFee), "Regular fee distribution");
            
            emit FeesDistributed(token, platformFee, partnerFee);
        }
    }

    /**
     * @dev Add funds directly to platform pool (for "everyone loses" scenarios)
     * @param token ERC20 token address (address(0) for native ETH)
     * @param amount Amount to add to platform pool
     */
    function addToPlatformPool(address token, uint256 amount) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can add to platform pool");
        require(amount > 0, "Treasury: Invalid amount");
        
        // Partner gets 20% of the platform amount (same as normal fee distribution)
        uint256 partnerFee = (amount * 2000) / 10000; // 20% of platform amount
        uint256 platformAmount = amount - partnerFee;
        
        if (token == address(0)) {
            // Native ETH
            require(address(this).balance >= amount, "Treasury: Insufficient ETH balance");
            
            if (partnerFee > 0) {
                (bool success, ) = partner.call{value: partnerFee}("");
                require(success, "Treasury: ETH transfer to partner failed");
            }
        } else {
            // ERC20 token
            IERC20 tokenContract = IERC20(token);
            require(tokenContract.balanceOf(address(this)) >= amount, "Treasury: Insufficient token balance");
            
            if (partnerFee > 0) {
                tokenContract.safeTransfer(partner, partnerFee);
            }
        }
        
        // Add remaining amount to platform pool
        platformPools[token] += platformAmount;
        
        emit PlatformPoolUpdated(token, platformAmount, "Direct platform pool addition");
        emit FeesDistributed(token, platformAmount, partnerFee);
    }

    /**
     * @dev Get platform pool balance for a specific token
     * @param token ERC20 token address (address(0) for native ETH)
     */
    function getPlatformPool(address token) external view returns (uint256) {
        return platformPools[token];
    }

    /**
     * @dev Withdraw platform funds (only owner)
     * @param token ERC20 token address (address(0) for native ETH)
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function withdrawPlatformFunds(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Treasury: Invalid recipient");
        require(amount > 0, "Treasury: Invalid amount");
        require(platformPools[token] >= amount, "Treasury: Insufficient platform pool balance");
        
        // Reduce platform pool balance
        platformPools[token] -= amount;
        
        if (token == address(0)) {
            require(address(this).balance >= amount, "Treasury: Insufficient ETH balance");
            (bool success, ) = to.call{value: amount}("");
            require(success, "Treasury: ETH transfer failed");
        } else {
            IERC20 tokenContract = IERC20(token);
            require(tokenContract.balanceOf(address(this)) >= amount, "Treasury: Insufficient token balance");
            tokenContract.safeTransfer(to, amount);
        }
        
        emit PlatformFundsWithdrawn(token, amount, to);
        emit PlatformPoolUpdated(token, platformPools[token], "Platform funds withdrawal");
    }

    /**
     * @dev Emergency withdraw funds (only owner) - for non-platform funds
     */
    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "Treasury: Invalid recipient");
        require(amount > 0, "Treasury: Invalid amount");
        
        if (token == address(0)) {
            require(address(this).balance >= amount, "Treasury: Insufficient ETH balance");
            (bool success, ) = to.call{value: amount}("");
            require(success, "Treasury: ETH transfer failed");
        } else {
            IERC20 tokenContract = IERC20(token);
            require(tokenContract.balanceOf(address(this)) >= amount, "Treasury: Insufficient token balance");
            tokenContract.safeTransfer(to, amount);
        }
        
        emit FundsWithdrawn(token, amount, to);
    }

    /**
     * @dev Place a stake (called by MarketManager)
     */
    function placeStake(uint256 marketId, address user, address token, uint256 amount, uint256 option) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can place stakes");
        require(amount > 0, "Treasury: Invalid stake amount");
        
        // Update user stake
        userStakes[marketId][user][token] += amount;
        userBetOptions[marketId][user][option] += amount;
        
        // Update pools
        marketPools[marketId][token] += amount;
        optionPools[marketId][option][token] += amount;
    }

    /**
     * @dev Support a market (called by MarketManager)
     */
    function supportMarket(uint256 marketId, address user, address token, uint256 amount) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can support markets");
        require(amount > 0, "Treasury: Invalid support amount");
        
        // Update user support
        userSupports[marketId][user][token] += amount;
        
        // Update support pool
        supportPools[marketId][token] += amount;
    }

    /**
     * @dev Withdraw support (called by MarketManager)
     */
    function withdrawSupport(uint256 marketId, address user, address token, uint256 amount) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can withdraw support");
        require(amount > 0, "Treasury: Invalid withdrawal amount");
        require(userSupports[marketId][user][token] >= amount, "Treasury: Insufficient support balance");
        
        // Update user support
        userSupports[marketId][user][token] -= amount;
        
        // Update support pool
        supportPools[marketId][token] -= amount;
        
        // Transfer funds
        _transferPayment(user, amount, token);
    }

    /**
     * @dev Claim winnings (called by MarketManager)
     */
    function claimWinnings(uint256 marketId, address user, address token, uint256 amount) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can claim winnings");
        require(amount > 0, "Treasury: Invalid winnings amount");
        require(!userClaimed[marketId][user], "Treasury: Already claimed");
        
        userClaimed[marketId][user] = true;
        
        // Transfer funds
        _transferPayment(user, amount, token);
    }

    /**
     * @dev Claim refund (called by MarketManager)
     */
    function claimRefund(uint256 marketId, address user, address token, uint256 amount) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can claim refunds");
        require(amount > 0, "Treasury: Invalid refund amount");
        
        // Transfer funds
        _transferPayment(user, amount, token);
    }

    /**
     * @dev Internal function to transfer payment
     */
    function _transferPayment(address to, uint256 amount, address token) internal {
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "Treasury: ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /**
     * @dev Get user bet amount
     */
    function getUserStake(uint256 marketId, address user, address token) external view returns (uint256) {
        return userStakes[marketId][user][token];
    }

    /**
     * @dev Get user support amount
     */
    function getUserSupport(uint256 marketId, address user, address token) external view returns (uint256) {
        return userSupports[marketId][user][token];
    }

    /**
     * @dev Get option pool amount
     */
    function getOptionPool(uint256 marketId, uint256 option, address token) external view returns (uint256) {
        return optionPools[marketId][option][token];
    }

    /**
     * @dev Get support pool amount
     */
    function getSupportPool(uint256 marketId, address token) external view returns (uint256) {
        return supportPools[marketId][token];
    }

    /**
     * @dev Get total market pool (betting pools + support pools)
     */
    function getMarketPool(uint256 marketId, address token) external view returns (uint256) {
        uint256 bettingPool = marketPools[marketId][token];
        uint256 supportPool = supportPools[marketId][token];
        return bettingPool + supportPool;
    }

    /**
     * @dev Check if user has claimed
     */
    function hasUserClaimed(uint256 marketId, address user) external view returns (bool) {
        return userClaimed[marketId][user];
    }

    /**
     * @dev Check if user has claimed support
     */
    function hasUserSupportClaimed(uint256 marketId, address user) external view returns (bool) {
        return userSupportClaimed[marketId][user];
    }

    /**
     * @dev Get all platform pools info (for UI/monitoring)
     */
    function getAllPlatformPools(address[] calldata tokens) external view returns (uint256[] memory balances) {
        balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = platformPools[tokens[i]];
        }
    }

    /**
     * @dev Transfer creator's platform fee directly to creator
     */
    function transferToCreator(address creator, address token, uint256 amount) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can transfer to creator");
        require(amount > 0, "Treasury: Invalid amount");
        require(creator != address(0), "Treasury: Invalid creator address");
        
        if (token == address(0)) {
            // Native ETH
            require(address(this).balance >= amount, "Treasury: Insufficient ETH balance");
            (bool success, ) = creator.call{value: amount}("");
            require(success, "Treasury: ETH transfer to creator failed");
        } else {
            // ERC20 token
            require(IERC20(token).balanceOf(address(this)) >= amount, "Treasury: Insufficient token balance");
            IERC20(token).safeTransfer(creator, amount);
        }
        
        emit FundsWithdrawn(token, amount, creator);
    }

    /**
     * @dev Distribute verifier rewards to verifiers who resolved a market
     * Each verifier gets 0.5% of total pool (1.5% total split among 3 verifiers)
     */
    function distributeVerifierRewards(uint256 marketId, address token, uint256 totalAmount) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can distribute verifier rewards");
        require(totalAmount > 0, "Treasury: Invalid reward amount");
        
        // Get resolving verifiers from MarketManager
        address[] memory resolvingVerifiers = IMarketManager(msg.sender).getMarketResolvingVerifiers(marketId);
        require(resolvingVerifiers.length > 0, "Treasury: No resolving verifiers found");
        
        // Calculate reward per verifier (0.5% each)
        uint256 rewardPerVerifier = totalAmount / resolvingVerifiers.length;
        
        // Distribute rewards to each verifier
        for (uint256 i = 0; i < resolvingVerifiers.length; i++) {
            if (rewardPerVerifier > 0) {
                _transferPayment(resolvingVerifiers[i], rewardPerVerifier, token);
            }
        }
        
        // Handle any remainder (due to division)
        uint256 totalDistributed = rewardPerVerifier * resolvingVerifiers.length;
        uint256 remainder = totalAmount - totalDistributed;
        
        if (remainder > 0) {
            // Give remainder to first verifier
            _transferPayment(resolvingVerifiers[0], remainder, token);
        }
        
        emit FundsWithdrawn(token, totalAmount, address(0)); // Use address(0) to indicate verifier distribution
    }

    /**
     * @dev Get contract balance vs platform pool balance (for debugging)
     */
    function getBalanceInfo(address token) external view returns (uint256 contractBalance, uint256 platformPoolBalance) {
        platformPoolBalance = platformPools[token];
        
        if (token == address(0)) {
            contractBalance = address(this).balance;
        } else {
            contractBalance = IERC20(token).balanceOf(address(this));
        }
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {}
}