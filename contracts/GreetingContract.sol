// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IERC2771Context.sol";

/**
 * @title GreetingContract
 * @dev A simple contract that stores greetings and supports meta-transactions
 * This contract demonstrates how to integrate with the MetaTxRelayer
 */
contract GreetingContract is ERC2771Context {
    string private _greeting;
    
    event GreetingChanged(address indexed sender, string newGreeting);
    
    /**
     * @dev Constructor sets the trusted forwarder (MetaTxRelayer)
     */
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {
        _greeting = "Hello, World!";
    }
    
    /**
     * @dev Sets a new greeting message
     * This function can be called directly or through meta-transactions
     */
    function setGreeting(string calldata newGreeting) external {
        address sender = _msgSender(); // Gets the original sender even if called via relayer
        _greeting = newGreeting;
        emit GreetingChanged(sender, newGreeting);
    }
    
    /**
     * @dev Returns the current greeting
     */
    function getGreeting() external view returns (string memory) {
        return _greeting;
    }
    
    /**
     * @dev Returns the address that would be considered the sender
     * Useful for testing and verification
     */
    function getCurrentSender() external view returns (address) {
        return _msgSender();
    }
    
    /**
     * @dev Returns information about the current message
     * Useful for debugging
     */
    function getMessageInfo() external view returns (
        address sender,
        bytes calldata data,
        uint256 dataLength
    ) {
        return (_msgSender(), _msgData(), _msgData().length);
    }
} 