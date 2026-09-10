// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title AvalTestToken
/// @notice A mock stablecoin for testnet demos of ERC20-settled instruments. Mints freely to
/// anyone, it has no value, it exists only to show AvalInstrument settling in a token instead of
/// native CTC. Not deployed to, or intended for, anything but testnet.
contract AvalTestToken is ERC20 {
    constructor() ERC20("Aval Test USD", "aTUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
