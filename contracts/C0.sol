// SPDX-License-Identifier: MIT
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  
//    cell/c0
//
//    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@@# ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,@@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@    ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@(@@@@@@       ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@          ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@            ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,/@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@%               ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@                  @@@@@@@@@&&&,,,,,,,,,,,,,,,,,,@@@@@@%@@@@@@@@@
//    @@@@@@@@#@@@@@@                  @@@@@@@@@@@@@@@,,,,,,,,,,,,,,,,,,@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@                  @@@@@@@@@@@@@@@@@@,,,,,,,,,,,,,,,,,,@@@@@@@@@@@@@
//    @@@@@@@@@@@@                  @@@@@@@@@@@@@@@@@@@@@,,,,,,,,,,,,,,,,,&@@@@@@@@@@@
//    @@@@@@@@@@&                 *@@@@@@@@@@@@@@@@@@@@@@@,,,,,,,,,,,,,,,,,,@@@@@@@@@@
//    @@@@@@@@@@@                  @@@@@@@@@@@@@@@@@@@@@@@.................,@@@@@@@@@@
//    @@@@@@@@@@@@                  @@@@@@@@@@@@@@@@@@@@..................@@@@@@@@@@@@
//    @@@@@@@@@@@@@@                  @@@@@@@@@@@@@@@@@..................@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@                  @@@@@@@@@@@@@@,.................@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@/                 ..............................@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@               ..............................@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@            ..............................@@@@@@%@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@         ..............................@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@      ..............................@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@,   ..............................@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@@@ ..............................@@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@(@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
//    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
pragma solidity ^0.8.9;
import "./ERC721.sol";
//import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
interface IToken {
  function burned(uint256 tokenId) external view returns (address);
  function ownerOf(uint256 tokenId) external view returns (address);
  function balanceOf(address account) external view returns (uint256);
}
contract C0 is Initializable, ERC721Upgradeable, OwnableUpgradeable, EIP712Upgradeable {
  using ECDSAUpgradeable for bytes32;

  //
  // Events
  //
  event WithdrawerUpdated(Withdrawer withdrawer);
  event StateUpdated(uint indexed state);
  event BaseURIUpdated(string uri);
  event NSUpdated(string name, string symbol);
  bytes32 public constant TOKEN_TYPE_HASH = keccak256("Token(uint8 role,address addr,uint256 id)");
  bytes32 public constant BODY_TYPE_HASH = keccak256("Body(uint256 id,uint8 encoding,address sender,address receiver,uint128 value,uint64 start,uint64 end,address royaltyReceiver,uint96 royaltyAmount,bytes32 merkleHash,bytes32 puzzleHash,Token[] burned,Token[] owns,Token[] balance)Token(uint8 role,address addr,uint256 id)");
  bytes32 private constant EMPTY_ARRAY_HASH = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470; // keccak256(abi.encodePacked(new bytes32[](0)))

  //
  // Struct declaration
  //
  struct Token {
    uint8 role;     // 0: sender; 1: receiver
    address addr;   // contract address
    uint256 id;     // tokenId/value
  }
  struct Body {
    uint256 id;
    uint128 value;
    uint64 start;
    uint64 end;
    uint8 encoding; // 0: raw, 1: dag-pb
    address sender;
    address receiver;
    address royaltyReceiver;
    uint96 royaltyAmount;
    bytes32 merkleHash;
    bytes32 puzzleHash;
    Token[] burned;
    Token[] owns;
    Token[] balance;
    bytes signature;
  }
  struct Gift {
    uint256 id;
    address receiver;
    address royaltyReceiver;
    uint96 royaltyAmount;
    uint8 encoding; // 0: raw, 1: dag-pb
  }
  struct Input {
    address receiver;
    bytes puzzle;
    bytes32[] merkle;
  }
  struct Royalty {
    address receiver;
    uint96 amount;
  }
  struct Withdrawer {
    address account;
    bool permanent;
  }
  struct Hash {
    bytes32[] burn;
    bytes32[] own;
    bytes32[] balance;
  }

  //
  // Member variables
  //
  mapping(uint256 => Royalty) public royalty;
  mapping(uint256 => uint8) public encoding;
  mapping(uint256 => address) public burned;
  Withdrawer public withdrawer;
  string public baseURI;
  uint public state;  // 0: open, 1: paused, 2: frozen

  //
  // Core interface functions
  //
  function initialize(string calldata name, string calldata symbol) initializer external {
    __ERC721_init(name, symbol);
    __EIP712_init(name, "1");
    __Ownable_init();
  }

  //
  // Allow direct receiving of funds
  //
  receive() external payable {}

  //
  // gift tokens (c0.gift.send())
  //
  function gift(Gift[] calldata gifts) external payable onlyOwner {
    for(uint i=0;i<gifts.length;) {
      Gift calldata g = gifts[i];
      _mint(g.receiver, g.id);
      if (g.royaltyReceiver != address(0x0)) {
        royalty[g.id] = Royalty(g.royaltyReceiver, g.royaltyAmount);
      }
      unchecked { ++i; }
    }
  }

  //
  // mint tokens (c0.token.send())
  //
  function token(Body[] calldata bodies, Input[] calldata inputs) external payable {
    require(state == 0, "0");
    uint val;
    for(uint i=0; i<bodies.length;) {
      Body calldata body = bodies[i];
      Input calldata input = inputs[i];

      //
      // 1. Burned check: disallow reminting if already burned
      //
      require(burned[body.id] == address(0x0), "1");

      //
      // 2. Signature check
      //
      if (body.burned.length == 0 && body.owns.length == 0 && body.balance.length == 0) {
        // split out into 2 chunks because of the stack limit
        bytes32 bodyhash = keccak256(
          bytes.concat(
            abi.encode(
              BODY_TYPE_HASH,
              body.id,
              body.encoding,
              body.sender,
              body.receiver,
              body.value,
              body.start,
              body.end
            ),
            abi.encode(
              body.royaltyReceiver,
              body.royaltyAmount,
              body.merkleHash,
              body.puzzleHash,
              EMPTY_ARRAY_HASH,
              EMPTY_ARRAY_HASH,
              EMPTY_ARRAY_HASH
            )
          )
        );
        require(_hashTypedDataV4(bodyhash).recover(body.signature) == owner(), "2");
      } else {
        Hash memory hash = Hash(new bytes32[](body.burned.length), new bytes32[](body.owns.length), new bytes32[](body.balance.length));
        if (body.burned.length > 0) {
          for(uint k=0; k<body.burned.length;) {
            hash.burn[k] = keccak256(abi.encode(
              TOKEN_TYPE_HASH,
              body.burned[k].role,
              body.burned[k].addr,
              body.burned[k].id
            ));
            unchecked { ++k; }
          }
        }
        if (body.owns.length > 0) {
          for(uint k=0; k<body.owns.length;) {
            hash.own[k] = keccak256(abi.encode(
              TOKEN_TYPE_HASH,
              body.owns[k].role,
              body.owns[k].addr,
              body.owns[k].id
            ));
            unchecked { ++k; }
          }
        }
        if (body.balance.length > 0) {
          for(uint k=0; k<body.balance.length;) {
            hash.balance[k] = keccak256(abi.encode(
              TOKEN_TYPE_HASH,
              body.balance[k].role,
              body.balance[k].addr,
              body.balance[k].id
            ));
            unchecked { ++k; }
          }
        }
        bytes32 bodyhash = keccak256(
          bytes.concat(
            abi.encode(
              BODY_TYPE_HASH,
              body.id,
              body.encoding,
              body.sender,
              body.receiver,
              body.value,
              body.start,
              body.end,
              body.royaltyReceiver,
              body.royaltyAmount,
              body.merkleHash,
              body.puzzleHash
            ),
            abi.encode(
              (hash.burn.length > 0 ? keccak256(abi.encodePacked(hash.burn)) : EMPTY_ARRAY_HASH),
              (hash.own.length > 0 ? keccak256(abi.encodePacked(hash.own)) : EMPTY_ARRAY_HASH),
              (hash.balance.length > 0 ? keccak256(abi.encodePacked(hash.balance)) : EMPTY_ARRAY_HASH)
            )
          )
        );
        require(_hashTypedDataV4(bodyhash).recover(body.signature) == owner(), "2");
      }

      //
      // 3. Sender check: if body.sender is specified, the body.sender must match _msgSender()
      //
      if (body.sender != address(0x0)) require(body.sender == _msgSender(), "3");

      //
      // 4. Start timelock check
      //
      require(body.start <= block.timestamp, "4");

      //
      // 5. End timelock check
      //
      require(body.end >= block.timestamp, "5");

      //
      // 6. Puzzle input check => the hash of the provided preimage string (input.puzzle) must match the hash (body.puzzleHash)
      //
      if (body.puzzleHash != 0) {
        require(input.puzzle.length > 0 && keccak256(input.puzzle) == body.puzzleHash, "6");
      }

      //
      // 7. Merkle input check => The _msgSender() must be included in the merkle tree specified by the body.merkleHash (verified using merkleproof input.merkle)
      //
      if (body.merkleHash != 0) {
        require(input.merkle.length > 0 && verify(body.merkleHash, input.merkle, _msgSender()), "7");
      }

      // Who receives the token when minted?
      // if body.receiver is set (not 0) => body.receiver
      // if body.receiver is NOT set => input.receiver
      address receiver = (body.receiver != address(0) ? body.receiver : input.receiver);

      //
      // 8. Burner check => if body.burned is not empty, the _msgSender() must have burned all the tokens in the body.burned array
      //
      if (body.burned.length > 0) {
        for(uint j=0; j<body.burned.length;) {
          Token memory b = body.burned[j];
          if (b.addr == address(0)) {
            if (b.role == 0) {                                    // sender
              require(burned[b.id] == _msgSender(), "8");
            } else {                                              // receiver
              require(burned[b.id] == receiver, "8");
            }
          } else {
            if (b.role == 0) {                                    // sender
              require(IToken(b.addr).burned(b.id) == _msgSender(), "8");
            } else {                                              // receiver
              require(IToken(b.addr).burned(b.id) == receiver, "8");
            }
          }
          unchecked {
            ++j;
          }
        }
      }

      //
      // 9. Owner check => if body.owns is not empty, the _msgSender() must own all the tokens in the body.owns array
      //
      if (body.owns.length > 0) {
        for(uint j=0; j<body.owns.length;) {
          Token memory o = body.owns[j];
          if (o.addr == address(0)) {
            if (o.role == 0) {                                    // sender
              require(ownerOf(o.id) == _msgSender(), "9");
            } else {                                              // receiver
              require(ownerOf(o.id) == receiver, "9");
            }
          } else {
            if (o.role == 0) {                                    // sender
              require(IToken(o.addr).ownerOf(o.id) == _msgSender(), "9");
            } else {                                              // receiver
              require(IToken(o.addr).ownerOf(o.id) == receiver, "9");
            }
          }
          unchecked {
            ++j;
          }
        }
      }

      //
      // 9. Balance check => if body.balance is not empty, the _msgSender() must have at least the balance specified in the body.balance array
      //
      if (body.balance.length > 0) {
        for(uint j=0; j<body.balance.length;) {
          Token memory b = body.balance[j];
          if (b.addr == address(0)) {
            if (b.role == 0) {                                    // sender
              require(balanceOf(_msgSender()) >= b.id, "10");
            } else {                                              // receiver
              require(balanceOf(receiver) >= b.id, "10");
            }
          } else {
            if (b.role == 0) {                                    // sender
              require(IToken(b.addr).balanceOf(_msgSender()) >= b.id, "10");
            } else {                                              // receiver
              require(IToken(b.addr).balanceOf(receiver) >= b.id, "10");
            }
          }
          unchecked {
            ++j;
          }
        }
      }

      //
      //
      // A. Token storage logic => The token is actually created
      //
      //

      //
      // A.1. Set CID encoding: 0 if raw, 1 if dag-pb
      //      (In most cases it will be "raw" since metadata JSON files are small files and will be encoded as "raw", therefore saving gas)
      //
      if (body.encoding != 0) encoding[body.id] = body.encoding;

      //
      // A.2. Set royalty: EIP-2981
      //
      if (body.royaltyReceiver != address(0x0)) {
        royalty[body.id] = Royalty(body.royaltyReceiver, body.royaltyAmount);
      }

      //
      // A.3. Mint the token
      //
      _mint(receiver, body.id);

      unchecked {
        val+=body.value;
        ++i;
      }
    }

    //
    // 10. Revert everything if not enough money was sent
    //
    require(val == msg.value, "11");
  }
  function burn(uint[] calldata _tokenIds) external {
    for(uint i=0; i<_tokenIds.length;) {
      uint _tokenId = _tokenIds[i];
      require(_isApprovedOrOwner(_msgSender(), _tokenId), "15");
      _burn(_tokenId);
      burned[_tokenId] = _msgSender();
      unchecked {
        ++i;
      }
    }
  }

  //
  // Universal tokenId engine: tokenId to CID
  //
  function tokenURI(uint tokenId) public view override(ERC721Upgradeable) returns (string memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
    bytes32 data = bytes32(tokenId);
    bytes memory alphabet = bytes("abcdefghijklmnopqrstuvwxyz234567");
    string memory base = (bytes(baseURI).length > 0 ? baseURI : "ipfs://");
    bytes memory cid = bytes(abi.encodePacked(base, (encoding[tokenId] == 0 ? "bafkrei" : "bafybei")));
    uint bits = 2;
    uint buffer = 24121888;
    uint bitsPerChar = 5;
    uint mask = uint((1 << bitsPerChar) - 1);
    for(uint i=0; i<data.length; ++i) {
      bytes1 char = bytes1(bytes32(tokenId << (8*i)));
      buffer = (uint32(buffer) << 8) | uint(uint8(char));
      bits += 8;
      while (bits > bitsPerChar) {
        bits -= bitsPerChar;
        cid = abi.encodePacked(cid, alphabet[mask & (buffer >> bits)]);
      }
    }
    if (bits > 0) {
      cid = abi.encodePacked(cid, alphabet[mask & (buffer << (bitsPerChar-bits))]);
    }
    return string(cid);
  }

  //
  // Merkle proof verifier
  //
  function verify(bytes32 root, bytes32[] calldata proof, address account) internal pure returns (bool) {
    bytes32 computedHash = keccak256(abi.encodePacked(account));
    for (uint256 i = 0; i < proof.length;) {
      bytes32 proofElement = proof[i];
      if (computedHash <= proofElement) {
        computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
      } else {
        computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
      }
      unchecked { ++i; }
    }
    return computedHash == root;
  }

  //
  // Royalty functions
  //
  function royaltyInfo(uint tokenId, uint value) external view returns (address receiver, uint256 royaltyAmount) {
    Royalty memory r = royalty[tokenId];
    return (r.receiver, value * r.amount/1000000);
  }
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721Upgradeable) returns (bool) {
    return (interfaceId == 0x2a55205a || super.supportsInterface(interfaceId));
  }

  //
  // Admin functions
  //
  function setWithdrawer(Withdrawer calldata _withdrawer) external onlyOwner {
    require(!withdrawer.permanent, "20");
    withdrawer = _withdrawer; 
    emit WithdrawerUpdated(_withdrawer);
  }
  function withdraw(uint value) external payable {

    //
    // Authorization: Either the owner or the withdrawer (in case it's set) can initiate withdraw()
    //
    require(_msgSender() == owner() || _msgSender() == withdrawer.account, "30");

    //
    // Custom withdrawl: value + receiver
    //

    //
    // Value: If specified (value > 0), withdraw that amount. Otherwise withdraw all.
    //
    uint amount = (value > 0 ? value : address(this).balance);

    //
    // Receiver: If "withdrawer" is set, the withdrawer. Otherwise, the contract owner
    //
    (bool sent1, ) = payable(withdrawer.account == address(0) ? owner() : withdrawer.account).call{value: amount}("");
    require(sent1, "31");

  }
  function setState(uint _state) external onlyOwner {
    require(state != 2, "40");
    state = _state;
    emit StateUpdated(_state);
  }
  function setBaseURI(string calldata b) external onlyOwner {
    require(state == 0, "50");
    baseURI = b;
    emit BaseURIUpdated(b);
  }
  function setNS(string calldata name_, string calldata symbol_) external onlyOwner {
    require(state == 0, "60");
    _name = name_; 
    _symbol = symbol_;
    emit NSUpdated(_name, _symbol);
  }
}
