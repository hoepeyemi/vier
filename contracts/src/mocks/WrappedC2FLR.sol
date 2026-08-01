// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Simple wrapped C2FLR token for Coston2 testing.
/// @dev Users deposit native C2FLR and receive an ERC20 balance one-to-one.
contract WrappedC2FLR is ERC20, Ownable {
    constructor() ERC20("Wrapped Coston2 Flare", "WC2FLR") Ownable(msg.sender) {}

    function deposit() external payable {
        require(msg.value > 0, "No value");
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
    }
}