// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

// Interface for EventPool auto-resolution
interface IEventPool {
    function autoResolve(uint256 marketId) external;
}

contract ValidationCore is Ownable {
    // Maximum number of verifiers
    uint256 public constant MAX_VERIFIERS = 5;
    
    // Required quorum for resolution
    uint256 public constant REQUIRED_QUORUM = 3;
    
    // Verifier addresses
    address[] public verifiers;
    
    // Mapping to check if address is a verifier
    mapping(address => bool) public isVerifier;
    
    // MarketManager address (for auto-resolution)
    address public marketManager;
    
    // Market resolution votes
    mapping(uint256 => mapping(uint256 => bool)) public hasVoted; // marketId => option => voted
    mapping(uint256 => mapping(uint256 => uint256)) public voteCount; // marketId => option => count
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public verifierVoted; // marketId => option => verifier => voted
    
    // Events
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    event VoteCast(address indexed market, uint256 option, address indexed verifier);
    event ResolutionReached(address indexed market, uint256 winningOption);
    event MarketManagerUpdated(address indexed oldManager, address indexed newManager);
    event AutoResolutionTriggered(uint256 indexed marketId, uint256 winningOption);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @dev Set MarketManager address
     */
    function setMarketManager(address _marketManager) external onlyOwner {
        require(_marketManager != address(0), "Verification: Invalid market manager address");
        address oldManager = marketManager;
        marketManager = _marketManager;
        emit MarketManagerUpdated(oldManager, _marketManager);
    }

    /**
     * @dev Add a new verifier
     */
    function addVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Verification: Invalid verifier address");
        require(!isVerifier[verifier], "Verification: Already a verifier");
        require(verifiers.length < MAX_VERIFIERS, "Verification: Maximum verifiers reached");
        
        verifiers.push(verifier);
        isVerifier[verifier] = true;
        
        emit VerifierAdded(verifier);
    }

    /**
     * @dev Remove a verifier
     */
    function removeVerifier(address verifier) external onlyOwner {
        require(isVerifier[verifier], "Verification: Not a verifier");
        
        // Find and remove verifier
        for (uint256 i = 0; i < verifiers.length; i++) {
            if (verifiers[i] == verifier) {
                verifiers[i] = verifiers[verifiers.length - 1];
                verifiers.pop();
                break;
            }
        }
        
        isVerifier[verifier] = false;
        
        emit VerifierRemoved(verifier);
    }

    /**
     * @dev Get all verifiers
     */
    function getVerifiers() external view returns (address[] memory) {
        return verifiers;
    }

    /**
     * @dev Get verifier count
     */
    function getVerifierCount() external view returns (uint256) {
        return verifiers.length;
    }

    /**
     * @dev Cast a vote for market resolution
     */
    function castVote(uint256 marketId, uint256 option) external {
        require(isVerifier[msg.sender], "Verification: Not a verifier");
        require(option > 0, "Verification: Invalid option");
        require(!verifierVoted[marketId][option][msg.sender], "Verification: Already voted for this option");
        
        // Mark this verifier as voted for this option
        verifierVoted[marketId][option][msg.sender] = true;
        
        // Increment vote count for this option
        voteCount[marketId][option]++;
        
        emit VoteCast(address(0), option, msg.sender); // Keep event compatible
        
        // Check if quorum reached
        if (voteCount[marketId][option] >= REQUIRED_QUORUM) {
            emit ResolutionReached(address(0), option);
            
            // Auto-resolve market if P2PMarketManager is set
            if (marketManager != address(0)) {
                try IEventPool(marketManager).autoResolve(marketId) {
                    emit AutoResolutionTriggered(marketId, option);
                } catch {
                    // P2PMarketManager might not be ready or market might not be in correct state
                    // This is not critical - manual resolution can still be called
                }
            }
        }
    }

    /**
     * @dev Check if market has reached resolution
     */
    function isResolved(uint256 marketId) external view returns (bool, uint256) {
        for (uint256 option = 1; option <= 10; option++) {
            if (voteCount[marketId][option] >= REQUIRED_QUORUM) {
                return (true, option);
            }
        }
        return (false, 0);
    }

    /**
     * @dev Get vote count for specific option
     */
    function getVoteCount(uint256 marketId, uint256 option) external view returns (uint256) {
        return voteCount[marketId][option];
    }

    /**
     * @dev Check if verifier has voted for specific option
     */
    function hasVerifierVoted(uint256 marketId, uint256 option, address verifier) external view returns (bool) {
        return verifierVoted[marketId][option][verifier];
    }

    /**
     * @dev Reset votes for a market (for testing or emergency)
     */
    function resetMarketVotes(uint256 marketId) external onlyOwner {
        for (uint256 option = 1; option <= 10; option++) {
            voteCount[marketId][option] = 0;
            for (uint256 i = 0; i < verifiers.length; i++) {
                verifierVoted[marketId][option][verifiers[i]] = false;
            }
        }
    }
}