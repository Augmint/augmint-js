const { mine } = require("./ganache.js");

module.exports = { issueToken };

async function issueToken(augmint, sender, to, _amount) {
    const amount = (_amount * (await augmint.token.decimalsDiv)).toString();
    const MONETARYSUPERVISOR_PERMISSION = augmint.ethereumConnection.web3.utils.asciiToHex("MonetarySupervisor");
    const token = (await augmint.token).instance;
    const web3 = augmint.ethereumConnection.web3;

    token.methods.grantPermission(sender, MONETARYSUPERVISOR_PERMISSION).send({ from: sender });
    await mine(web3, 1); // we mine instead of waiting for blockTimeout to mine in ganache to speed up tests

    token.methods.issueTo(to, amount).send({ from: sender });
    await mine(web3, 1);

    token.methods.revokePermission(sender, MONETARYSUPERVISOR_PERMISSION).send({ from: sender });
    await mine(web3, 1);
}
