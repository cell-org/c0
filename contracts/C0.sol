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
pragma solidity ^0.8.13;
import "./ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
contract C0 is Initializable, ERC721Upgradeable, OwnableUpgradeable, EIP712Upgradeable {
  using ECDSAUpgradeable for bytes32;
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Events
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  event WithdrawerUpdated(Withdrawer withdrawer);
  event StateUpdated(uint indexed state);
  event BaseURIUpdated(string uri);
  event NSUpdated(string name, string symbol);
  bytes32 public constant BODY_TYPE_HASH = keccak256("Body(uint256 id,uint8 encoding,address sender,address receiver,uint128 value,uint64 start,uint64 end,address royaltyReceiver,uint96 royaltyAmount,uint256[] burned,bytes32 merkleHash,bytes32 puzzleHash)");
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Struct declaration
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  struct Body {
    uint256 id;
    uint128 value;
    uint64 start;
    uint64 end;
    uint8 encoding; // 0: raw, 1: dag-pb
    address sender;
    address receiver;
    address royaltyReceiver;
    uint256[] burned;
    uint96 royaltyAmount;
    bytes32 merkleHash;
    bytes32 puzzleHash;
    bytes signature;
  }
  struct Gift {
    uint256 id;
    address receiver;
    address royaltyReceiver;
    uint96 royaltyAmount;
    uint8 encoding; // 0: raw, 1: dag-pb
  }
  struct Proof {
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
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Member variables
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  mapping(uint256 => Royalty) public royalty;
  mapping(uint256 => uint8) public encoding;
  mapping(uint256 => address) private burned;
  Withdrawer public withdrawer;
  string public baseURI;
  uint public state;  // 0: open, 1: paused, 2: frozen
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Core interface functions
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  function initialize(string calldata name, string calldata symbol) initializer external {
    __ERC721_init(name, symbol);
    __EIP712_init(name, "1");
    __Ownable_init();
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Allow direct receiving of funds
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  receive() external payable {}
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Token functions
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
  function token(Body[] calldata bodies, Proof[] calldata proofs) external payable {
    require(state == 0, "0");
    uint val;
    for(uint i=0; i<bodies.length;) {
      Body calldata body = bodies[i];
      Proof calldata proof = proofs[i];
      require(burned[body.id] == address(0x0), "1");
      bytes32 bodyhash = keccak256(abi.encode(
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
        keccak256(abi.encodePacked(body.burned)),
        body.merkleHash,
        body.puzzleHash
      ));
      // 1. Signature check
      require(_hashTypedDataV4(bodyhash).recover(body.signature) == owner(), "2");
      // 2. Sender check
      // if body.sender is specified, _msgSender() must equal body.sender
      // if body.sender is not specified, anyone can mint
      if (body.sender != address(0x0)) require(body.sender == _msgSender(), "3");
      // 3. Time check
      require(body.start <= block.timestamp, "4");
      require(body.end >= block.timestamp, "5");
      // 4. Hash preimage proof => the hash of the solution equals the puzzle
      if (body.puzzleHash != 0) {
        require(proof.puzzle.length > 0 && keccak256(proof.puzzle) == body.puzzleHash, "6");
      }
      // 5. Sender merkle proof => the computed root of the proof.sender + msg.sender matches the sender merkle root (body.senders)
      if (body.merkleHash != 0) {
        require(proof.merkle.length > 0 && verify(body.merkleHash, proof.merkle, _msgSender()), "7");
      }
      // 6. Set raw/dag-pb info
      if (body.encoding != 0) encoding[body.id] = body.encoding;
      // 7. Set royalty
      if (body.royaltyReceiver != address(0x0)) {
        royalty[body.id] = Royalty(body.royaltyReceiver, body.royaltyAmount);
      }
      // 8. burner condition
      if (body.burned.length > 0) {
        for(uint j=0; j<body.burned.length;) {
          require(burned[body.burned[j]] == _msgSender(), "8");
          unchecked {
            ++j;
          }
        }
      }
      // 8. Mint
      _mint(
        (body.receiver == address(0x0) ? _msgSender() : body.receiver), 
        body.id
      );
      unchecked {
        val+=body.value;
        ++i;
      }
    }
    // 9. Revert everything if not enough money was sent
    require(val == msg.value, "9");
  }
  function burn(uint[] calldata _tokenIds) external {
    for(uint i=0; i<_tokenIds.length;) {
      uint _tokenId = _tokenIds[i];
      require(_isApprovedOrOwner(_msgSender(), _tokenId), "10");
      _burn(_tokenId);
      burned[_tokenId] = _msgSender();
      unchecked {
        ++i;
      }
    }
  }
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
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Royalty functions
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  function royaltyInfo(uint tokenId, uint value) external view returns (address receiver, uint256 royaltyAmount) {
    Royalty memory r = royalty[tokenId];
    return (r.receiver, value * r.amount/1000000);
  }
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721Upgradeable) returns (bool) {
    return (interfaceId == 0x2a55205a || super.supportsInterface(interfaceId));
  }
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Admin functions
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  function setWithdrawer(Withdrawer calldata _withdrawer) external onlyOwner {
    require(!withdrawer.permanent, "11");
    withdrawer = _withdrawer; 
    emit WithdrawerUpdated(_withdrawer);
  }
  function withdraw(uint value) external payable {
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Authorization
    // - Either the owner or the withdrawer (in case it's set) can initiate withdraw()
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    require(_msgSender() == owner() || _msgSender() == withdrawer.account, "12");
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Transfer
    // 1. If the value is 0, withdraw all. Otherwise, only withdraw the specified amount
    // 2. Who to send to?
    //   - if the withdrawer.account is not set (0x0 address), withdraw balance to owner
    //   - if the withdrawer.account is set, withdraw balance to withdrawer.account
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    uint amount = (value > 0 ? value : address(this).balance);
    (bool sent1, ) = payable( withdrawer.account == address(0) ? owner() : withdrawer.account).call{value: amount}("");
    require(sent1, "13");
  }
  function setState(uint _state) external onlyOwner {
    require(state != 2, "14");
    state = _state;
    emit StateUpdated(_state);
  }
  function setBaseURI(string calldata b) external onlyOwner {
    require(state == 0, "15");
    baseURI = b;
    emit BaseURIUpdated(b);
  }
  function setNS(string calldata name_, string calldata symbol_) external onlyOwner {
    require(state == 0, "16");
    _name = name_; 
    _symbol = symbol_;
    emit NSUpdated(_name, _symbol);
  }
}
