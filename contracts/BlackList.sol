// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import {AccessControl}  from "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract BlackList is AccessControl {
   
    event AddedToBlackList(address indexed _address);
    event RemovedFromBlackList(address indexed _address);
    event BlackListedTokensBurned(address indexed _address, uint256 _amount);
   
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE"); 
    // blacklist (address to bool mapping)
    mapping (address => bool) public isBlackListed;

    ////////////////////////
    // MODIFIERS
    ////////////////////////

    /**
     * @dev Modifier to make a function callable only when sender is  blacklisted.
     */
    modifier blackListed(address _address) {
        require(isBlackListed[_address], "Address is not blacklisted");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when sender is not blacklisted.
     */
    modifier notBlackListed(address _address) {
        require(!isBlackListed[_address], "Address is blacklisted");
        _;
    }

    ////////////////////////
    // PUBLIC FUNCTIONS
    ////////////////////////

    function addToBlackList (address _address) public onlyRole(COMPLIANCE_ROLE) {
        isBlackListed[_address] = true;
        emit AddedToBlackList(_address);
    }

    function removeFromBlackList (address _address) public onlyRole(COMPLIANCE_ROLE) {
        isBlackListed[_address] = false;
        emit RemovedFromBlackList(_address);
    }

    ////////////////////////
    // VIEW FUNCTIONS
    ////////////////////////

    function getBlackListStatus(address _address) external view returns (bool) {
        return isBlackListed[_address];
    }
}