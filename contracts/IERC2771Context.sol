// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @dev Interface for contracts that support meta-transactions through ERC2771
 */
interface IERC2771Context {
    /**
     * @dev Returns true if the forwarder is trusted
     */
    function isTrustedForwarder(address forwarder) external view returns (bool);
}

/**
 * @title ERC2771Context
 * @dev Context variant with ERC2771 support for meta-transactions
 */
abstract contract ERC2771Context {
    address private _trustedForwarder;

    constructor(address trustedForwarder_) {
        _trustedForwarder = trustedForwarder_;
    }

    /**
     * @dev Returns true if the forwarder is trusted
     */
    function isTrustedForwarder(address forwarder) public view virtual returns (bool) {
        return forwarder == _trustedForwarder;
    }

    /**
     * @dev Returns the original sender of the transaction
     */
    function _msgSender() internal view virtual returns (address sender) {
        if (isTrustedForwarder(msg.sender)) {
            // The assembly code is more direct than the Solidity version using `abi.decode`.
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    /**
     * @dev Returns the original msg.data of the transaction
     */
    function _msgData() internal view virtual returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender)) {
            return msg.data[:msg.data.length - 20];
        } else {
            return msg.data;
        }
    }
} 