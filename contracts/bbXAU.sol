// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {BlackList} from "./BlackList.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract bbXAU is ERC20, AccessControl, Ownable, Pausable, BlackList {
    uint256 public constant MAX_TRANSFER_FEE = 50; // 0.5%
    uint256 public constant TRANSFER_FEE_PRECISION = 10000;

    uint256 public transferFee = 0;
    // called when new tokens are minted
    event Mint(address indexed _address, uint256 _amount);
    // called when tokens are redeemed
    event Burn(address indexed _address, uint256 _amount);
    // called if fee changed
    event TransferFee(uint256 _fee);

    constructor(
        address _owner,
        address _compliance
    ) ERC20("BitBanker XAU (Gold)", "bbXAU") Ownable(_owner) {
        _setRoleAdmin(COMPLIANCE_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(COMPLIANCE_ROLE, _compliance);
    }

    ////////////////////////
    // VIEW FUNCTIONS
    ////////////////////////

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    ////////////////////////
    // PUBLIC FUNCTIONS
    ////////////////////////

    /**
     * @dev transfer token for a specified address
     * @param _to The address to transfer to
     * @param _value The amount to be transferred
     */
    function transfer(
        address _to,
        uint256 _value
    )
        public
        override
        whenNotPaused
        notBlackListed(_msgSender())
        notBlackListed(_to)
        returns (bool)
    {
        if (transferFee == 0) return super.transfer(_to, _value);

        uint256 fee = (_value * transferFee) / TRANSFER_FEE_PRECISION;
        uint256 amount = _value - fee;
        _update(_msgSender(), _to, amount);
        _update(_msgSender(), owner(), fee);
        return true;
    }

    /**
     * @dev transfer tokens from one address to another
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    )
        public
        override
        whenNotPaused
        notBlackListed(_from)
        notBlackListed(_to)
        returns (bool)
    {
        if (transferFee == 0) return super.transferFrom(_from, _to, _value);
        uint256 feeAmount = (_value * transferFee) / TRANSFER_FEE_PRECISION;
        uint256 transferAmount = _value - feeAmount;
        _update(_from, _to, transferAmount);
        _update(_from, owner(), feeAmount);
        return true;
    }

    ////////////////////////
    // SERVICE FUNCTIONS
    ////////////////////////

    /**
     * @dev burn tokens from blacklisted account
     *@param _address blacklisted account
     */
    function burnBlackListed(
        address _address
    ) public onlyRole(COMPLIANCE_ROLE) blackListed(_address) {
        uint256 amount = balanceOf(_address);
        _burn(_address, amount);
        emit BlackListedTokensBurned(_address, amount);
    }

    /**
     * @dev mint a new amount of tokens
     * @param _to address of tokens receiver
     * @param _amount number of tokens to be minted
     */
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    /**
     * @dev burn tokens from owner account
     * @param _amount number of tokens to be burnt
     */
    function burn(uint256 _amount) public onlyOwner {
        _burn(owner(), _amount);
        emit Burn(owner(), _amount);
    }

    /**
     * @dev set transfer fee
     * @param _newFee number of tokens to be burnt
     */
    function setTransferFee(uint256 _newFee) public onlyOwner {
        require(_newFee <= MAX_TRANSFER_FEE, "Invalid transfer fee value");
        transferFee = _newFee;
        emit TransferFee(_newFee);
    }

    /**
     * @dev pause transfers
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev unpause transfers
     */
    function unpause() public onlyOwner {
        _unpause();
    }
}
