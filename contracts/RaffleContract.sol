// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IERC2771Context.sol";

/**
 * @title RaffleContract
 * @dev A decentralized raffle system with meta-transaction support
 * Users can create raffles and join them without paying gas fees
 */
contract RaffleContract is ERC2771Context {
    struct Raffle {
        uint256 id;
        address creator;
        string title;
        string description;
        uint256 entryFee;
        uint256 maxParticipants;
        uint256 endTime;
        address[] participants;
        address winner;
        uint256 prizePool;
        bool isActive;
        bool prizeClaimable;
    }

    uint256 private _raffleIdCounter;
    mapping(uint256 => Raffle) public raffles;
    mapping(uint256 => mapping(address => bool)) public hasJoined;
    
    // For randomness (simplified - in production use Chainlink VRF)
    uint256 private _nonce;

    event RaffleCreated(
        uint256 indexed raffleId,
        address indexed creator,
        string title,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 endTime
    );

    event ParticipantJoined(
        uint256 indexed raffleId,
        address indexed participant,
        uint256 participantCount
    );

    event WinnerDrawn(
        uint256 indexed raffleId,
        address indexed winner,
        uint256 prizeAmount
    );

    event PrizeClaimed(
        uint256 indexed raffleId,
        address indexed winner,
        uint256 amount
    );

    event RaffleEnded(uint256 indexed raffleId);

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) {}

    /**
     * @dev Create a new raffle
     */
    function createRaffle(
        string calldata title,
        string calldata description,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 durationInHours
    ) external payable returns (uint256 raffleId) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(maxParticipants > 1, "Need at least 2 participants");
        require(durationInHours > 0, "Duration must be positive");

        raffleId = _raffleIdCounter++;
        uint256 endTime = block.timestamp + (durationInHours * 1 hours);

        raffles[raffleId] = Raffle({
            id: raffleId,
            creator: _msgSender(),
            title: title,
            description: description,
            entryFee: entryFee,
            maxParticipants: maxParticipants,
            endTime: endTime,
            participants: new address[](0),
            winner: address(0),
            prizePool: msg.value, // Creator can seed the prize pool
            isActive: true,
            prizeClaimable: false
        });

        emit RaffleCreated(
            raffleId,
            _msgSender(),
            title,
            entryFee,
            maxParticipants,
            endTime
        );

        return raffleId;
    }

    /**
     * @dev Join a raffle (supports meta-transactions)
     */
    function joinRaffle(uint256 raffleId) external payable {
        Raffle storage raffle = raffles[raffleId];
        address participant = _msgSender();

        require(raffle.isActive, "Raffle is not active");
        require(block.timestamp < raffle.endTime, "Raffle has ended");
        require(!hasJoined[raffleId][participant], "Already joined this raffle");
        require(raffle.participants.length < raffle.maxParticipants, "Raffle is full");
        require(msg.value >= raffle.entryFee, "Insufficient entry fee");

        // Add participant
        raffle.participants.push(participant);
        hasJoined[raffleId][participant] = true;
        raffle.prizePool += msg.value;

        emit ParticipantJoined(raffleId, participant, raffle.participants.length);

        // Auto-draw if raffle is full
        if (raffle.participants.length == raffle.maxParticipants) {
            _drawWinner(raffleId);
        }
    }

    /**
     * @dev Draw winner manually (can be called by anyone after end time)
     */
    function drawWinner(uint256 raffleId) external {
        Raffle storage raffle = raffles[raffleId];
        
        require(raffle.isActive, "Raffle is not active");
        require(
            block.timestamp >= raffle.endTime || 
            raffle.participants.length == raffle.maxParticipants,
            "Raffle conditions not met for drawing"
        );
        require(raffle.participants.length > 0, "No participants");

        _drawWinner(raffleId);
    }

    /**
     * @dev Internal function to draw winner
     */
    function _drawWinner(uint256 raffleId) internal {
        Raffle storage raffle = raffles[raffleId];
        
        // Simple randomness (use Chainlink VRF in production)
        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.difficulty,
                    raffle.participants.length,
                    _nonce++
                )
            )
        ) % raffle.participants.length;

        address winner = raffle.participants[randomIndex];
        raffle.winner = winner;
        raffle.isActive = false;
        raffle.prizeClaimable = true;

        emit WinnerDrawn(raffleId, winner, raffle.prizePool);
        emit RaffleEnded(raffleId);
    }

    /**
     * @dev Winner claims their prize
     */
    function claimPrize(uint256 raffleId) external {
        Raffle storage raffle = raffles[raffleId];
        address claimer = _msgSender();

        require(raffle.winner == claimer, "Not the winner");
        require(raffle.prizeClaimable, "Prize not claimable");
        require(raffle.prizePool > 0, "No prize to claim");

        uint256 prizeAmount = raffle.prizePool;
        raffle.prizePool = 0;
        raffle.prizeClaimable = false;

        (bool success, ) = payable(claimer).call{value: prizeAmount}("");
        require(success, "Prize transfer failed");

        emit PrizeClaimed(raffleId, claimer, prizeAmount);
    }

    /**
     * @dev Cancel raffle (only creator, only if no participants)
     */
    function cancelRaffle(uint256 raffleId) external {
        Raffle storage raffle = raffles[raffleId];
        
        require(raffle.creator == _msgSender(), "Not the creator");
        require(raffle.isActive, "Raffle not active");
        require(raffle.participants.length == 0, "Cannot cancel with participants");

        raffle.isActive = false;

        // Refund creator's seed money
        if (raffle.prizePool > 0) {
            uint256 refundAmount = raffle.prizePool;
            raffle.prizePool = 0;
            (bool success, ) = payable(raffle.creator).call{value: refundAmount}("");
            require(success, "Refund failed");
        }

        emit RaffleEnded(raffleId);
    }

    /**
     * @dev Get raffle details
     */
    function getRaffle(uint256 raffleId) external view returns (
        uint256 id,
        address creator,
        string memory title,
        string memory description,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 endTime,
        uint256 participantCount,
        address winner,
        uint256 prizePool,
        bool isActive,
        bool prizeClaimable
    ) {
        Raffle storage raffle = raffles[raffleId];
        return (
            raffle.id,
            raffle.creator,
            raffle.title,
            raffle.description,
            raffle.entryFee,
            raffle.maxParticipants,
            raffle.endTime,
            raffle.participants.length,
            raffle.winner,
            raffle.prizePool,
            raffle.isActive,
            raffle.prizeClaimable
        );
    }

    /**
     * @dev Get raffle participants
     */
    function getRaffleParticipants(uint256 raffleId) external view returns (address[] memory) {
        return raffles[raffleId].participants;
    }

    /**
     * @dev Get active raffles count
     */
    function getActiveRafflesCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < _raffleIdCounter; i++) {
            if (raffles[i].isActive && block.timestamp < raffles[i].endTime) {
                count++;
            }
        }
    }

    /**
     * @dev Get all raffle IDs (for frontend pagination)
     */
    function getAllRaffleIds() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](_raffleIdCounter);
        for (uint256 i = 0; i < _raffleIdCounter; i++) {
            ids[i] = i;
        }
        return ids;
    }

    /**
     * @dev Check if user has joined a specific raffle
     */
    function userHasJoined(uint256 raffleId, address user) external view returns (bool) {
        return hasJoined[raffleId][user];
    }

    /**
     * @dev Get current raffle ID counter
     */
    function getCurrentRaffleId() external view returns (uint256) {
        return _raffleIdCounter;
    }
} 