const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("bbRUB", function () {
    async function setup() {
        const [owner, compliance, accountant, user] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("bbRUB");
        const bbRUB = await Factory.connect(owner).deploy("BitBanker Ruble","bbRUB",owner, compliance, accountant);
        return {
            owner,
            compliance,
            accountant,
            user,
            bbRUB
        }
    }

    context("Scenarios", function () {
        specify("Setup", async function () {
            const { owner, compliance, accountant, user, bbRUB } = await setup()

            expect(await owner.getAddress()).to.be.eq(await bbRUB.owner());
            expect(await bbRUB.hasRole(await bbRUB.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.eq(true)
            expect(await bbRUB.hasRole(await bbRUB.COMPLIANCE_ROLE(), await compliance.getAddress())).to.be.eq(true)
            expect(await bbRUB.hasRole(await bbRUB.DEFAULT_ADMIN_ROLE(), await compliance.getAddress())).to.be.eq(false)
            expect(await bbRUB.totalSupply()).to.be.eq(0);
        })

        specify("Transfers", async function() {
            const { owner, compliance, accountant, user, bbRUB } = await setup()

            await bbRUB.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            await expect(bbRUB.connect(user).transfer(await owner.getAddress(), 1000000)).to.be.reverted
            await bbRUB.connect(owner).transfer(await user.getAddress(), 1000000)
            expect(await bbRUB.balanceOf(await user.getAddress())).to.be.gt(0)

            const ownerBalanceBefore = await bbRUB.balanceOf(await owner.getAddress())

            await expect(bbRUB.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 1000000)).to.be.reverted
            await bbRUB.connect(user).approve(await owner.getAddress(), 500000)
            bbRUB.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 500000)
            await expect(bbRUB.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 500000)).to.be.reverted
            expect(await bbRUB.balanceOf(await user.getAddress())).to.be.gt(0)
            expect(await bbRUB.balanceOf(await owner.getAddress())).to.be.gt(ownerBalanceBefore)
        })

        specify("Pause", async function() {
            const { owner, compliance, user, bbRUB } = await setup()

            await bbRUB.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            await expect(bbRUB.connect(user).pause()).to.be.reverted
            await expect(bbRUB.connect(compliance).pause()).to.be.reverted
            await bbRUB.connect(owner).pause()

            await expect(bbRUB.connect(owner).transfer(await user.getAddress(), 1000000)).to.be.reverted
            await bbRUB.connect(owner).approve(await user.getAddress(), 1000000)

            await expect(bbRUB.connect(user).transferFrom(await owner.getAddress(), await user.getAddress(), 1000000)).to.be.reverted

            await expect(bbRUB.connect(user).unpause()).to.be.reverted
            await expect(bbRUB.connect(compliance).unpause()).to.be.reverted
            await bbRUB.connect(owner).unpause()

            await bbRUB.connect(owner).transfer(await user.getAddress(), 1000000)
            const userBalanceBefore = await bbRUB.balanceOf(user.getAddress())
            expect(userBalanceBefore).to.be.gt(0)
            await bbRUB.connect(owner).approve(await user.getAddress(), 0)
            await bbRUB.connect(owner).approve(await user.getAddress(), 2000000)
            await bbRUB.connect(user).transferFrom(await owner.getAddress(), await user.getAddress(), 2000000)
            expect(await bbRUB.balanceOf(user.getAddress())).to.be.gt(userBalanceBefore)
        })

        specify("BlackList operations", async function() {
            const { owner, compliance, user, bbRUB } = await setup()

            await bbRUB.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            await expect(bbRUB.connect(user).addToBlackList(await user.getAddress())).to.be.reverted
            await expect(bbRUB.connect(owner).addToBlackList(await user.getAddress())).to.be.reverted
            
            await bbRUB.connect(owner).transfer(await user.getAddress(), 1000000)
          
            await bbRUB.connect(compliance).addToBlackList(await user.getAddress())

            await expect(bbRUB.connect(user).transfer(await owner.getAddress(), 1000000)).to.be.reverted

            await bbRUB.connect(user).approve(await owner.getAddress(), 1000000)

            await expect(bbRUB.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 1000000)).to.be.reverted

            await bbRUB.connect(compliance).burnBlackListed(await user.getAddress())
            expect(await bbRUB.balanceOf(await user.getAddress())).to.be.eq(0)

            await bbRUB.connect(compliance).removeFromBlackList(await user.getAddress())

            await bbRUB.connect(owner).transfer(await user.getAddress(), 1000000)

            await expect(bbRUB.connect(user).transfer(await owner.getAddress(), 1000000)).to.not.be.reverted

            await expect(bbRUB.connect(owner).transfer(await user.getAddress(), 1000000)).to.not.be.reverted

            await expect(bbRUB.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 1000000)).to.not.be.reverted
        })

        specify("Mint and Burn", async function() {
            const { owner, compliance, user, bbRUB } = await setup()

            await bbRUB.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            const ownerBalanceBefore = await bbRUB.balanceOf(await owner.getAddress())

            await expect(bbRUB.connect(user).mint(await owner.getAddress(), 1000000)).to.be.reverted
            await expect(bbRUB.connect(compliance).mint(await owner.getAddress(), 1000000)).to.be.reverted
            await bbRUB.connect(owner).mint(await owner.getAddress(), 1000000)

            expect(await bbRUB.balanceOf(await owner.getAddress())).to.be.gt(ownerBalanceBefore)

            await expect(bbRUB.connect(user).burn(1000000)).to.be.reverted
            await expect(bbRUB.connect(compliance).burn(1000000)).to.be.reverted
            await bbRUB.connect(owner).burn(1000000)

            expect(await bbRUB.balanceOf(await owner.getAddress())).to.be.eq(ownerBalanceBefore)

        })

        specify("Add and remove liquidity", async function() {
            const { owner, compliance, accountant, user, bbRUB } = await setup()

            await bbRUB.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            const ownerBalanceBefore = await bbRUB.balanceOf(await owner.getAddress())
            await expect(bbRUB.connect(user).addLiquidity(1000000)).to.be.reverted 
            await expect(bbRUB.connect(owner).addLiquidity(1000000)).to.be.reverted 
            await expect(bbRUB.connect(compliance).addLiquidity(1000000)).to.be.reverted 
            await expect(bbRUB.connect(accountant).addLiquidity(1000000)).to.not.be.reverted 
            let ownerBalanceAfter = await bbRUB.balanceOf(await owner.getAddress())
            expect(ownerBalanceBefore + 1000000n).to.eq(ownerBalanceAfter)
            await expect(bbRUB.connect(user).removeLiquidity(1000000)).to.be.reverted 
            await expect(bbRUB.connect(owner).removeLiquidity(1000000)).to.be.reverted 
            await expect(bbRUB.connect(compliance).removeLiquidity(1000000)).to.be.reverted 
            await expect(bbRUB.connect(accountant).removeLiquidity(1000000)).to.not.be.reverted 
            ownerBalanceAfter = await bbRUB.balanceOf(await owner.getAddress())
            expect(ownerBalanceBefore).to.eq(ownerBalanceAfter)
            await expect(bbRUB.connect(accountant).removeLiquidity(5000 * 10**6 + 1000000)).to.be.reverted 
            await expect(bbRUB.connect(accountant).removeLiquidity(1000000)).to.be.reverted
            await expect(bbRUB.connect(accountant).addLiquidity(1000000)).to.not.be.reverted 
            await expect(bbRUB.connect(accountant).removeLiquidity(1000000)).to.not.be.reverted
             
        })

        specify("SafeERC20 Integration Test", async function() {
            const { owner, compliance, user, bbRUB } = await setup()

            const Factory = await ethers.getContractFactory("IntegrationTest");
            const IntegrationTest = await Factory.connect(owner).deploy(await bbRUB.getAddress());

            const owner_addr = await owner.getAddress()
            const compliance_addr = await compliance.getAddress()
            const user_addr = await user.getAddress()
            const IntegrationTest_addr = await IntegrationTest.getAddress()

            await bbRUB.connect(owner).mint(IntegrationTest_addr, 5000 * 10**6)

            let integrationTestBalanceBefore = await bbRUB.balanceOf(IntegrationTest_addr)

            await IntegrationTest.safeTransfer_test(owner_addr, 1000 * 10**6)

            expect(integrationTestBalanceBefore).to.be.gt(await bbRUB.balanceOf(IntegrationTest_addr))
            expect(await bbRUB.balanceOf(owner_addr)).to.be.gt(0)

            integrationTestBalanceBefore = await bbRUB.balanceOf(IntegrationTest_addr)

            await bbRUB.connect(owner).approve(IntegrationTest_addr, 1000 * 10**6)

            await IntegrationTest.safeTransferFrom_test(owner_addr, IntegrationTest_addr, 1000 * 10**6)

            expect(await bbRUB.balanceOf(IntegrationTest_addr)).to.be.gt(integrationTestBalanceBefore)
            expect(await bbRUB.balanceOf(owner_addr)).to.be.eq(0)

            await IntegrationTest.safeIncreaseAllowance_test(owner_addr, 1000 * 10**6)
            expect(await bbRUB.allowance(IntegrationTest_addr, owner_addr)).to.be.gt(0)

            await IntegrationTest.safeDecreaseAllowance_test(owner_addr, 1000 * 10**6)
            expect(await bbRUB.allowance(IntegrationTest_addr, owner_addr)).to.be.eq(0)

            await IntegrationTest.forceApprove_test(owner_addr, 1000 * 10**6)
            expect(await bbRUB.allowance(IntegrationTest_addr, owner_addr)).to.be.gt(0)
        })
    
    })
})