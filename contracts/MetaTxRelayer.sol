// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IERC2771Context.sol";

/**
 * @title MetaTxRelayer
 * @dev A minimal forwarder contract that validates EIP-712 signatures and executes meta-transactions
 * This contract allows users to sign messages off-chain that can be submitted by relayers
 */
contract MetaTxRelayer {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    bytes32 private constant _TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );

    mapping(address => uint256) private _nonces;

    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        bytes indexed data,
        bool success,
        bytes returndata
    );

    /**
     * @dev Returns the current nonce for a given address
     */
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @dev Verifies the signature and executes the meta-transaction
     */
    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool success, bytes memory returndata)
    {
        // Verify nonce
        require(_nonces[req.from] == req.nonce, "MetaTxRelayer: invalid nonce");
        
        // Verify signature
        require(_verify(req, signature), "MetaTxRelayer: signature verification failed");

        // Increment nonce
        _nonces[req.from] = req.nonce + 1;

        // Execute the call
        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Emit event
        emit MetaTransactionExecuted(req.from, req.to, req.data, success, returndata);

        // Refund unused gas (optional optimization)
        if (gasleft() > 0) {
            payable(msg.sender).transfer(address(this).balance);
        }
    }

    /**
     * @dev Verifies that the signature matches the request
     */
    function _verify(ForwardRequest calldata req, bytes calldata signature)
        internal
        view
        returns (bool)
    {
        address signer = _hashTypedDataV4(
            keccak256(abi.encode(
                _TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            ))
        ).recover(signature);
        
        return signer == req.from;
    }

    /**
     * @dev Returns the domain separator for EIP-712
     */
    function _domainSeparatorV4() internal view returns (bytes32) {
        return _buildDomainSeparator(_TYPE_HASH, _HASHED_NAME, _HASHED_VERSION);
    }

    /**
     * @dev Builds the domain separator
     */
    function _buildDomainSeparator(
        bytes32 typeHash,
        bytes32 nameHash,
        bytes32 versionHash
    ) private view returns (bytes32) {
        return keccak256(abi.encode(typeHash, nameHash, versionHash, block.chainid, address(this)));
    }

    /**
     * @dev Hashes the typed data according to EIP-712
     */
    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    // EIP-712 constants
    bytes32 private constant _TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant _HASHED_NAME = keccak256("MetaTxRelayer");
    bytes32 private constant _HASHED_VERSION = keccak256("1");
}

// ECDSA library for signature recovery
library ECDSA {
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) {
            return address(0);
        }

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        return recover(hash, v, r, s);
    }

    function recover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "ECDSA: invalid signature 's' value");
        require(v == 27 || v == 28, "ECDSA: invalid signature 'v' value");

        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "ECDSA: invalid signature");

        return signer;
    }
} 