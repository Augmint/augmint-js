module.exports = {
    revertSnapshot,
    takeSnapshot
};

//let snapshotCount = 0;
function takeSnapshot(web3) {
    //dirty hack for web3@1.0.0 support for localhost testrpc, see https://github.com/trufflesuite/truffle-contract/issues/56#issuecomment-331084530
    if (typeof web3.currentProvider.sendAsync !== "function") {
        web3.currentProvider.sendAsync = function() {
            return web3.currentProvider.send.apply(web3.currentProvider, arguments);
        };
    }

    return new Promise(function(resolve, reject) {
        web3.currentProvider.sendAsync(
            {
                method: "evm_snapshot",
                params: [],
                jsonrpc: "2.0",
                id: new Date().getTime()
            },
            function(error, res) {
                if (error) {
                    reject(new Error("Can't take snapshot with web3\n" + error));
                } else {
                    resolve(res.result);
                }
            }
        );
    });
}

function revertSnapshot(web3, snapshotId) {
    return new Promise(function(resolve, reject) {
        web3.currentProvider.sendAsync(
            {
                method: "evm_revert",
                params: [snapshotId],
                jsonrpc: "2.0",
                id: new Date().getTime()
            },
            function(error, res) {
                if (error) {
                    // TODO: this error is not bubbling up to truffle test run :/
                    reject(new Error("Can't revert snapshot with web3. snapshotId: " + snapshotId + "\n" + error));
                } else {
                    resolve(res);
                }
            }
        );
    });
}
