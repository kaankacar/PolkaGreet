// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IERC2771Context.sol";

/**
 * @title PolkaGreetContract
 * @dev A simple greeting contract that demonstrates meta-transactions on Polkadot
 * Users can say "hi" and the relayer pays for gas fees
 */
contract PolkaGreetContract is ERC2771Context {
    string private _greeting;
    address private _lastGreeter;
    uint256 private _greetCount;
    
    event GreetingSent(address indexed greeter, string message, uint256 greetNumber);
    
    /**
     * @dev Constructor sets the trusted forwarder (MetaTxRelayer)
     */
    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {
        _greeting = "Welcome to PolkaGreet!";
        _greetCount = 0;
    }
    
    /**
     * @dev Send a greeting - this is the main function for our "Say Hi" button
     * This function can be called directly or through meta-transactions
     */
    function sayHi() external {
        address sender = _msgSender(); // Gets the original sender even if called via relayer
        _lastGreeter = sender;
        _greetCount += 1;
        
        // Create a personalized greeting
        _greeting = string(abi.encodePacked("Hi ", _addressToString(sender), "!"));
        
        emit GreetingSent(sender, _greeting, _greetCount);
    }
    
    /**
     * @dev Returns the current greeting message
     */
    function getCurrentGreeting() external view returns (string memory) {
        return _greeting;
    }
    
    /**
     * @dev Returns the address of the last person who greeted
     */
    function getLastGreeter() external view returns (address) {
        return _lastGreeter;
    }
    
    /**
     * @dev Returns the total number of greetings sent
     */
    function getGreetCount() external view returns (uint256) {
        return _greetCount;
    }
    
    /**
     * @dev Returns comprehensive greeting info
     */
    function getGreetingInfo() external view returns (
        string memory currentGreeting,
        address lastGreeter,
        uint256 totalGreets
    ) {
        return (_greeting, _lastGreeter, _greetCount);
    }
    
    /**
     * @dev Helper function to convert address to string
     */
    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes32 _bytes = bytes32(uint256(uint160(_addr)));
        bytes memory HEX = "0123456789abcdef";
        bytes memory _string = new bytes(42);
        _string[0] = '0';
        _string[1] = 'x';
        for(uint i = 0; i < 20; i++) {
            _string[2+i*2] = HEX[uint8(_bytes[i + 12] >> 4)];
            _string[3+i*2] = HEX[uint8(_bytes[i + 12] & 0x0f)];
        }
        return string(_string);
    }
} 