// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WebSocketTest
 * @notice Simple contract to test WebSocket event listening on PEPU
 */
contract WebSocketTest {
    event TestEvent(
        uint256 indexed counter,
        string message,
        uint256 timestamp,
        address indexed caller
    );

    uint256 public counter;

    /**
     * @notice Emit a test event
     * @param message Custom message to include in event
     */
    function emitTestEvent(string memory message) external {
        counter++;
        emit TestEvent(
            counter,
            message,
            block.timestamp,
            msg.sender
        );
    }

    /**
     * @notice Get current counter value
     */
    function getCounter() external view returns (uint256) {
        return counter;
    }
}
