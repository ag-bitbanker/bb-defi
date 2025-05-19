import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("bbXAU", (m) => {
    const creator = m.getAccount(0);
    const owner =  m.getParameter('owner',creator);
    const compliance =  m.getParameter('compliance',creator);
    const bbXAU = m.contract("bbXAU", [owner,compliance]);
    return { bbXAU };
});