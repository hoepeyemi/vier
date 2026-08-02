// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MockFlareContractRegistry {
    mapping(string => address) public contractsByName;

    function setContractAddressByName(string calldata name, address target) external {
        contractsByName[name] = target;
    }

    function getContractAddressByName(string calldata name) external view returns (address) {
        return contractsByName[name];
    }
}