// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BlackList} from "./BlackList.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
contract bbRUB is
    IERC20,
    IERC20Metadata,
    IERC20Errors,
    AccessControl,
    Ownable,
    ReentrancyGuard,
    Pausable,
    BlackList
{
    using Math for uint256;
    string private _name;
    string private _symbol;

    uint256 private _totalSupply;
    uint256 private _totalLiquidity;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 public constant MAX_TRANSFER_FEE = 50; // 0.5%
    uint256 public constant TRANSFER_FEE_PRECISION = 10000;

    uint256 public transferFee = 0;

    bytes32 public constant ACCOUNANT_ROLE = keccak256("ACCOUNANT_ROLE");

    event Mint(address indexed user, uint256 amount);
    event Burn(address indexed user, uint256 amount);
    event TransferFee(uint256 _fee);

    event LiquidityChanged(
        uint256 oldLiquidity,
        uint256 newlLiquidity
    );


    constructor(
        string memory name_,
        string memory symbol_,
        address _owner,
        address _compliance,
        address _accountant
    ) Ownable(_owner) {
        _name = name_;
        _symbol = symbol_;
        _setRoleAdmin(COMPLIANCE_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(ACCOUNANT_ROLE, DEFAULT_ADMIN_ROLE);
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(COMPLIANCE_ROLE, _compliance);
        _grantRole(ACCOUNANT_ROLE, _accountant);
    }

    ////////////////////////
    // VIEW FUNCTIONS
    ////////////////////////

    /**
     * @dev token name
     */
    function name() public view override returns (string memory) {
        return _name;
    }

    /**
     * @dev token symbol
     */
    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev token decimals
     */
    function decimals() public pure override returns (uint8) {
        return 8;
    }

    /**
     * @dev account balance (shared liquidity)
     * @param _account account address
     */
    function balanceOf(address _account) public view override returns (uint256) {
        return getLiquidityAmount(_balances[_account]);
    }

    /**
     * @dev allowance 
     * @param _owner from address
     * @param _spender to address
     */
    function allowance(
        address _owner,
        address _spender
    ) public view override returns (uint256) {
        return _allowances[_owner][_spender];
    }

    function totalSupply() public view override returns (uint256) {
        return _totalLiquidity;
    }

    function totalLiquidity() public view returns (uint256) {
        return _totalLiquidity;
    }

    function getScaledAmount(uint256 _amount) public view returns (uint256) {
        return _totalLiquidity == 0 ? _amount : Math.mulDiv(_amount,_totalSupply,_totalLiquidity, Math.Rounding.Floor);
    }

    function getLiquidityAmount(uint256 _value) public view returns (uint256) {
        return _totalSupply == 0 ?  0 : Math.mulDiv(_value,_totalLiquidity, _totalSupply,Math.Rounding.Ceil);
    }

    ////////////////////////
    // PUBLIC FUNCTIONS
    ////////////////////////

    /**
     * @dev mint tokens to account
     * @param _account account address
     * @param _amount  tokens to mint
     */
    function mint(address _account, uint256 _amount) public onlyOwner {
        _mint(_account, _amount);
    }

    /**
     * @dev burn tokens from owner account
     * @param _amount tokens to burn
     */
    function burn(uint256 _amount) public onlyOwner {
        _burn(owner(), _amount);
    }

    /**
     * @dev transfer tokens
     * @param _to receiver
     * @param _value tokens to send
     */
    function transfer(
        address _to,
        uint256 _value
    )
        public
        whenNotPaused
        notBlackListed(_msgSender())
        notBlackListed(_to)
        returns (bool)
    {
         if (_to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        uint256 amount = getScaledAmount(_value);
        if ( transferFee == 0) {
            _transfer(_msgSender(), _to, amount);
             emit Transfer(_msgSender(), _to, getLiquidityAmount(amount));
        } else {
            uint256 fee = (amount * transferFee) / TRANSFER_FEE_PRECISION;
            _transfer(_msgSender(), _to, amount - fee);
            if (fee > 0) {
                _transfer(_msgSender(), owner(), fee);
                emit Transfer(_msgSender(), owner(), getLiquidityAmount(fee));
            }
            emit Transfer(_msgSender(), _to, getLiquidityAmount(amount - fee));
        }
        return true;
    }
    /**
     * @dev transfer tokens between to accounts
     * @param _from sender
     * @param _to receiver
     * @param _value tokns
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    )
        public
        whenNotPaused
        notBlackListed(_from)
        notBlackListed(_to)
        returns (bool)
    {
        if (_from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (_to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        uint256 allowance_ = _allowances[_from][_to];
        if ( allowance_ < _value) {
            revert ERC20InsufficientAllowance(_from, allowance_, _value);
        }
    
        // if allowance == type(uint256).max) don't decrease  
        if (allowance_ < type(uint256).max) {
            _allowances[_from][_to] -= _value;
        }

        uint256 amount = getScaledAmount(_value);
        if ( transferFee == 0) {
            _transfer(_from, _to, amount);
             emit Transfer(_from, _to, getLiquidityAmount(amount ));
        } else {
            uint256 fee = (amount * transferFee) / TRANSFER_FEE_PRECISION;
            _transfer(_from, _to, amount - fee);
            if (fee > 0) {
                _transfer(_from, owner(), fee);
                emit Transfer(_from, owner(), getLiquidityAmount(fee));
            }
            emit Transfer(_from, _to, getLiquidityAmount(amount - fee));
        }
        return true;
    }

    /**
     * @dev approve transfer
     * @param _spender spender address
     * @param _value tokens
     */
    function approve(address _spender, uint256 _value) public returns (bool) {
        _allowances[_msgSender()][_spender] = _value;
        emit Approval(_msgSender(), _spender, _value);
        return true;
    }

    /**
     * @dev add liquidity (backed funds)
     * @param _liquidity liquidity to add
     */
    function addLiquidity(uint256 _liquidity) public onlyRole(ACCOUNANT_ROLE) nonReentrant {
        _addLiquidity(_liquidity);
    }

    /**
     * @dev add liquidity (backed funds) and mint tokens in one transaction
     * @param _to receiver address
     * @param _liquidity liquidity to add
     */
    function addLiquidityAndMint(address _to, uint256 _liquidity) public onlyOwner nonReentrant {
        _addLiquidity( _liquidity);
        _mint(_to, _liquidity);
    }
    /**
     * @dev remove liquidity (backed funds)
     * @param _liquidity liquidity to remove
     */
    function removeLiquidity(
        uint256 _liquidity
    ) public onlyRole(ACCOUNANT_ROLE) nonReentrant {
        _removeLiquidity(_liquidity);
    }

    /**
     * @dev remove liquidity (backed funds) and burn tokens in one transaction
     * @param _liquidity liquidity to remove
     */
    function removeLiquidityAndBurn(
        address _from,
        uint256 _liquidity
    ) public onlyOwner nonReentrant {
        _burn(_from, _liquidity);
        _removeLiquidity(_liquidity);
    }

    /**
     * @dev set transfer fee
     * @param _value new transfer fee
     */
    function setTransferFee(uint256 _value) public onlyOwner {
        require(_value <= MAX_TRANSFER_FEE, "Invalid transfer fee value");
        transferFee = _value;
        emit TransferFee(_value);
    }

    /**
     * @dev pause transfers
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev resume transfers
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev burn tokens from blacklisted account
     * @param _address blacklisted account address
     */
    function burnBlackListed(
        address _address
    ) public onlyRole(COMPLIANCE_ROLE) blackListed(_address) {
        uint256 amount = _balances[_address];
        _balances[_address] = 0;
        _totalSupply -= amount;
        emit BlackListedTokensBurned(_address, amount);
    }

    ////////////////////////
    // INTERNAL FUNCTIONS
    ////////////////////////

    /**
     * @dev mint tokens to account
     * @param _account account address
     * @param _amount  tokens to mint
     */
    function _mint(address _account, uint256 _amount) internal {
        if (_account == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        uint256 scaledAmount = getScaledAmount(_amount);
        _totalSupply += scaledAmount;
        _totalLiquidity += _amount;
        _balances[_account] += scaledAmount;

        emit Mint(_account, _amount);
    }

    /**
     * @dev burn tokens from account
     * @param _amount tokens to burn
     */
    function _burn(address _account, uint256 _amount) internal {
        uint256 scaledAmount = getScaledAmount(_amount);
        _totalSupply -= scaledAmount;
        _totalLiquidity -= _amount;
        _balances[_account] -= scaledAmount;
        emit Burn(_account, _amount);
    }

    /**
     * @dev add liquidity (backed funds)
     * @param _liquidity liquidity to add
     */
    function _addLiquidity(uint256 _liquidity) internal {
        uint256 oldTotalLiquidity = _totalLiquidity;
        _totalLiquidity += _liquidity;
        require(
            _totalLiquidity >= _totalSupply,
            "Total liquidity < total supply"
        );
        emit LiquidityChanged(oldTotalLiquidity, _totalLiquidity);
    }

    /**
     * @dev remove liquidity (backed funds)
     * @param _liquidity liquidity to remove
     */
    function _removeLiquidity(
        uint256 _liquidity
    ) public onlyRole(ACCOUNANT_ROLE) {
        require(
            _liquidity <= _totalLiquidity,
            "Liquidity to be removed > total liquidity"
        );
        uint256 oldTotalLiquidity = _totalLiquidity;
        _totalLiquidity -= _liquidity;
        require(
            _totalLiquidity >= _totalSupply,
            "Total liquidity < total supply"
        );
        emit LiquidityChanged(oldTotalLiquidity, _totalLiquidity);
    }
    /**
     * @dev transfer tokens
     * @param _from sender
     * @param _to receiver
     * @param _amount tokens
     */
    function _transfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal returns (bool) {
        if (_from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (_to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        require(_balances[_from] >= _amount, "Invalid amount");
        _balances[_from] -= _amount;
        _balances[_to] += _amount;

        return true;
    }
}
