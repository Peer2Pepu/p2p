// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
    
    // Market fund tracking
    mapping(uint256 => mapping(address => uint256)) public marketPools; // marketId => token => total amount
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public optionPools; // marketId => option => token => amount
    mapping(uint256 => mapping(address => uint256)) public supportPools; // marketId => token => support amount
    mapping(uint256 => mapping(address => mapping(address => uint256))) public userBets; // marketId => user => token => bet amount
    mapping(uint256 => mapping(address => mapping(address => uint256))) public userSupports; // marketId => user => token => support amount
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public userBetOptions; // marketId => user => option => bet amount
    mapping(uint256 => mapping(address => bool)) public userClaimed; // marketId => user => has claimed
    mapping(uint256 => mapping(address => bool)) public userSupportClaimed; // marketId => user => has claimed support
    
    // Events
    event PartnerUpdated(address indexed oldPartner, address indexed newPartner);
    event FeesDistributed(address indexed token, uint256 platformAmount, uint256 partnerAmount);
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
     * @dev Distribute fees to platform and partner
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
            
            // Platform keeps the remaining platform fee
            emit FeesDistributed(token, platformFee, partnerFee);
        } else {
            // ERC20 token
            IERC20 tokenContract = IERC20(token);
            require(tokenContract.balanceOf(address(this)) >= totalAmount, "Treasury: Insufficient token balance");
            
            if (partnerFee > 0) {
                tokenContract.safeTransfer(partner, partnerFee);
            }
            
            // Platform keeps the remaining platform fee
            emit FeesDistributed(token, platformFee, partnerFee);
        }
    }

    /**
     * @dev Withdraw funds (only owner)
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
     * @dev Place a bet (called by MarketManager)
     */
    function placeBet(uint256 marketId, address user, address token, uint256 amount, uint256 option) external {
        require(authorizedContracts[msg.sender], "Treasury: Only authorized contracts can place bets");
        require(amount > 0, "Treasury: Invalid bet amount");
        
        // Update user bet
        userBets[marketId][user][token] += amount;
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

    // Supporters get nothing - it's just a donation to support the market

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
    function getUserBet(uint256 marketId, address user, address token) external view returns (uint256) {
        return userBets[marketId][user][token];
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
     * @dev Get total market pool
     */
    function getMarketPool(uint256 marketId, address token) external view returns (uint256) {
        return marketPools[marketId][token];
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
     * @dev Receive ETH
     */
    receive() external payable {}
}