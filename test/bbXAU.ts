const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("bbXAU", function () {
    async function setup() {
        const [owner, compliance, user] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("bbXAU");
        const bbXAU = await Factory.connect(owner).deploy(owner, compliance);
        return {
            owner,
            compliance,
            user,
            bbXAU
        }
    }

    context("Scenarios", function () {
        specify("Setup", async function () {
            const { owner, compliance, user, bbXAU } = await setup()

            expect(await owner.getAddress()).to.be.eq(await bbXAU.owner());
            expect(await bbXAU.hasRole(await bbXAU.DEFAULT_ADMIN_ROLE(), await owner.getAddress())).to.be.eq(true)
            expect(await bbXAU.hasRole(await bbXAU.COMPLIANCE_ROLE(), await compliance.getAddress())).to.be.eq(true)
            expect(await bbXAU.hasRole(await bbXAU.DEFAULT_ADMIN_ROLE(), await compliance.getAddress())).to.be.eq(false)
            expect(await bbXAU.totalSupply()).to.be.eq(0);
        })
       
        specify("Transfers", async function() {
            const { owner, compliance, user, bbXAU } = await setup()

            await bbXAU.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            await expect(bbXAU.connect(user).transfer(await owner.getAddress(), 1000000)).to.be.reverted
            await bbXAU.connect(owner).transfer(await user.getAddress(), 1000000)
            expect(await bbXAU.balanceOf(await user.getAddress())).to.be.gt(0)

            const ownerBalanceBefore = await bbXAU.balanceOf(await owner.getAddress())

            await expect(bbXAU.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 1000000)).to.be.reverted
            await bbXAU.connect(user).approve(await owner.getAddress(), 500000)
            bbXAU.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 500000)
            await expect(bbXAU.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 500000)).to.be.reverted
            expect(await bbXAU.balanceOf(await user.getAddress())).to.be.gt(0)
            expect(await bbXAU.balanceOf(await owner.getAddress())).to.be.gt(ownerBalanceBefore)
        })
 
        specify("Pause", async function() {
            const { owner, compliance, user, bbXAU } = await setup()

            await bbXAU.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            await expect(bbXAU.connect(user).pause()).to.be.reverted
            await expect(bbXAU.connect(compliance).pause()).to.be.reverted
            await bbXAU.connect(owner).pause()

            await expect(bbXAU.connect(owner).transfer(await user.getAddress(), 1000000)).to.be.reverted
            await bbXAU.connect(owner).approve(await user.getAddress(), 1000000)

            await expect(bbXAU.connect(user).transferFrom(await owner.getAddress(), await user.getAddress(), 1000000)).to.be.reverted

            await expect(bbXAU.connect(user).unpause()).to.be.reverted
            await expect(bbXAU.connect(compliance).unpause()).to.be.reverted
            await bbXAU.connect(owner).unpause()

            await bbXAU.connect(owner).transfer(await user.getAddress(), 1000000)
            const userBalanceBefore = await bbXAU.balanceOf(user.getAddress())
            expect(userBalanceBefore).to.be.gt(0)
            await bbXAU.connect(owner).approve(await user.getAddress(), 0)
            await bbXAU.connect(owner).approve(await user.getAddress(), 2000000)
            await bbXAU.connect(user).transferFrom(await owner.getAddress(), await user.getAddress(), 2000000)
            expect(await bbXAU.balanceOf(user.getAddress())).to.be.gt(userBalanceBefore)
        })
        
        specify("BlackList operations", async function() {
            const { owner, compliance, user, bbXAU } = await setup()

            await bbXAU.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            await expect(bbXAU.connect(user).addToBlackList(await user.getAddress())).to.be.reverted
            await expect(bbXAU.connect(owner).addToBlackList(await user.getAddress())).to.be.reverted
            
            await bbXAU.connect(owner).transfer(await user.getAddress(), 1000000)
          
            await bbXAU.connect(compliance).addToBlackList(await user.getAddress())

            await expect(bbXAU.connect(user).transfer(await owner.getAddress(), 1000000)).to.be.reverted

            await bbXAU.connect(user).approve(await owner.getAddress(), 1000000)

            await expect(bbXAU.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 1000000)).to.be.reverted

            await bbXAU.connect(compliance).burnBlackListed(await user.getAddress())
            expect(await bbXAU.balanceOf(await user.getAddress())).to.be.eq(0)

            await bbXAU.connect(compliance).removeFromBlackList(await user.getAddress())

            await bbXAU.connect(owner).transfer(await user.getAddress(), 1000000)

            await expect(bbXAU.connect(user).transfer(await owner.getAddress(), 1000000)).to.not.be.reverted

            await expect(bbXAU.connect(owner).transfer(await user.getAddress(), 1000000)).to.not.be.reverted

            await expect(bbXAU.connect(owner).transferFrom(await user.getAddress(), await owner.getAddress(), 1000000)).to.not.be.reverted
        })
        
        specify("Mint and Burn", async function() {
            const { owner, compliance, user, bbXAU } = await setup()

            await bbXAU.connect(owner).mint(await owner.getAddress(), 5000 * 10**6)

            const ownerBalanceBefore = await bbXAU.balanceOf(await owner.getAddress())

            await expect(bbXAU.connect(user).mint(await owner.getAddress(), 1000000)).to.be.reverted
            await expect(bbXAU.connect(compliance).mint(await owner.getAddress(), 1000000)).to.be.reverted
            await bbXAU.connect(owner).mint(await owner.getAddress(), 1000000)

            expect(await bbXAU.balanceOf(await owner.getAddress())).to.be.gt(ownerBalanceBefore)

            await expect(bbXAU.connect(user).burn(1000000)).to.be.reverted
            await expect(bbXAU.connect(compliance).burn(1000000)).to.be.reverted
            await bbXAU.connect(owner).burn(1000000)

            expect(await bbXAU.balanceOf(await owner.getAddress())).to.be.eq(ownerBalanceBefore)

        })
        
        specify("SafeERC20 Integration Test", async function() {
            const { owner, compliance, user, bbXAU } = await setup()

            const Factory = await ethers.getContractFactory("IntegrationTest");
            const IntegrationTest = await Factory.connect(owner).deploy(await bbXAU.getAddress());

            const owner_addr = await owner.getAddress()
            const compliance_addr = await compliance.getAddress()
            const user_addr = await user.getAddress()
            const IntegrationTest_addr = await IntegrationTest.getAddress()

            await bbXAU.connect(owner).mint(IntegrationTest_addr, 5000 * 10**6)

            let integrationTestBalanceBefore = await bbXAU.balanceOf(IntegrationTest_addr)

            await IntegrationTest.safeTransfer_test(owner_addr, 1000 * 10**6)

            expect(integrationTestBalanceBefore).to.be.gt(await bbXAU.balanceOf(IntegrationTest_addr))
            expect(await bbXAU.balanceOf(owner_addr)).to.be.gt(0)

            integrationTestBalanceBefore = await bbXAU.balanceOf(IntegrationTest_addr)

            await bbXAU.connect(owner).approve(IntegrationTest_addr, 1000 * 10**6)

            await IntegrationTest.safeTransferFrom_test(owner_addr, IntegrationTest_addr, 1000 * 10**6)

            expect(await bbXAU.balanceOf(IntegrationTest_addr)).to.be.gt(integrationTestBalanceBefore)
            expect(await bbXAU.balanceOf(owner_addr)).to.be.eq(0)

            await IntegrationTest.safeIncreaseAllowance_test(owner_addr, 1000 * 10**6)
            expect(await bbXAU.allowance(IntegrationTest_addr, owner_addr)).to.be.gt(0)

            await IntegrationTest.safeDecreaseAllowance_test(owner_addr, 1000 * 10**6)
            expect(await bbXAU.allowance(IntegrationTest_addr, owner_addr)).to.be.eq(0)

            await IntegrationTest.forceApprove_test(owner_addr, 1000 * 10**6)
            expect(await bbXAU.allowance(IntegrationTest_addr, owner_addr)).to.be.gt(0)
        })
            
    })
})