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
pragma solidity ^0.8.4;
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
  bytes32 public constant BODY_TYPE_HASH = keccak256("Body(uint256 id,bool raw,address minter,uint128 price,uint64 start,uint64 end,address royaltyReceiver,uint96 royaltyAmount,bytes32 merkleHash,bytes32 puzzleHash)");
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Struct declaration
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  struct Body {
    uint256 id;
    uint128 price;
    uint64 start;
    uint64 end;
    bool raw; // 0: dag-pb, 1: raw
    address minter;
    address royaltyReceiver;
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
    bool raw; // 0: dag-pb, 1: raw
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
  mapping(uint256 => bool) private raw;
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
  receive() external payable {}
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Token functions
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  function give(Gift[] calldata gifts) external payable onlyOwner {
    for(uint i=0;i<gifts.length;) {
      Gift calldata gift = gifts[i];
      _safeMint(gift.receiver, gift.id);
      if (gift.royaltyReceiver != address(0x0)) {
        royalty[gift.id] = Royalty(gift.royaltyReceiver, gift.royaltyAmount);
      }
      unchecked { ++i; }
    }
  }
  function mint(Body[] calldata bodies, Proof[] calldata proofs) external payable {
    require(state == 0, "0");
    uint val;
    for(uint i=0; i<bodies.length;) {
      Body calldata body = bodies[i];
      Proof calldata proof = proofs[i];
      bytes32 bodyhash = keccak256(abi.encode(
        BODY_TYPE_HASH,
        body.id,
        body.raw,
        body.minter,
        body.price,
        body.start,
        body.end,
        body.royaltyReceiver,
        body.royaltyAmount,
        body.merkleHash,
        body.puzzleHash
      ));
      // 1. Signature check
      require(_hashTypedDataV4(bodyhash).recover(body.signature) == owner(), "1");
      // 2. Minter check
      // if body.minter is specified, _msgSender() must equal body.minter
      // if body.minter is not specified, anyone can mint
      if (body.minter != address(0x0)) require(body.minter == _msgSender(), "2");
      // 3. Time check
      require(body.start <= block.timestamp, "3");
      require(body.end >= block.timestamp, "4");
      // 4. Hash preimage proof => the hash of the solution equals the puzzle
      if (body.puzzleHash != 0) {
        require(proof.puzzle.length > 0 && keccak256(proof.puzzle) == body.puzzleHash, "5");
      }
      // 5. Minter merkle proof => the computed root of the proof.minter + msg.sender matches the minter merkle root (body.minter_group) 
      if (body.merkleHash != 0) {
        require(proof.merkle.length > 0 && verify(body.merkleHash, proof.merkle, _msgSender()), "6");
      }
      // 6. Mint
      _safeMint(_msgSender(), body.id);
      // 7. Set raw/dag-pb info
      if (body.raw) raw[body.id] = body.raw;
      // 8. Set royalty
      if (body.royaltyReceiver != address(0x0)) {
        royalty[body.id] = Royalty(body.royaltyReceiver, body.royaltyAmount);
      }
      unchecked {
        val+=body.price;
        ++i;
      }
    }
    // 9. Revert everything if not enough money was sent
    require(val == msg.value, "8");
  }
  function burn(uint _tokenId) external {
    require(_isApprovedOrOwner(_msgSender(), _tokenId), "9");
    _burn(_tokenId);
  }
  function tokenURI(uint tokenId) public view override(ERC721Upgradeable) returns (string memory) {
    require(_exists(tokenId), "10");
    bytes32 data = bytes32(tokenId);
    bytes memory alphabet = bytes("abcdefghijklmnopqrstuvwxyz234567");
    string memory base = (bytes(baseURI).length > 0 ? baseURI : "ipfs://");
    bytes memory cid = bytes(abi.encodePacked(base, (raw[tokenId] ? "bafkrei" : "bafybei")));
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
  function setBaseURI(string calldata b) external onlyOwner {
    baseURI = b;
    emit BaseURIUpdated(b);
  }
  function setState(uint _state) external onlyOwner {
    require(state != 2, "14");
    state = _state;
    emit StateUpdated(_state);
  }
}
