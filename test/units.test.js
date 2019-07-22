const { assert } = require("chai");
const { Wei, Tokens, Ratio } = require("../dist/index.js");

describe("Units", () => {

    it("params are required", () => {
        [Ratio, Wei, Tokens].forEach(Type => {
            assert.throws(() => new Type());
            assert.throws(() => new Type(null));
        })
    });

    it("no operations accross types", () => {
        assert.throws(() => Wei.of(1).add(Tokens.of(100)));
        assert.throws(() => Wei.of(1).mul(Tokens.of(100)));
        assert.throws(() => Wei.of(1).toTokensAt(Ratio.of(1), Tokens.of(100)));
    });

    it("conversions", () => {
        assert.equal(Tokens.of(100.01).toString(), "10001");
        assert.equal(Tokens.of(100.01).toString(16), "2711");
        assert.equal(Ratio.of(1.01).toNumber(), 1.01);
        assert.equal(JSON.stringify({ tokens: Tokens.of(100.01) }), '{"tokens":"10001"}');
        assert.equal("10001", Tokens.parse("10001").toString());
        assert.equal("10001", Tokens.parse(10001).toString());
        assert.throws(() => Tokens.parse(null));
        assert.isNull(Tokens.parse("0").zeroToNull());
        assert.equal("10001", Tokens.parse(10001).zeroToNull().toString());
    });

    it("rounds Ratio properly", () => {
        assert.equal(Ratio.of(1.025).toString(), "1025000");
        assert.equal(Ratio.of(1/3).toString(), "333333");
        assert.equal(Ratio.of(2/3).toString(), "666667");
    })

    it("rounds Wei properly", () => {
        assert.equal(Wei.of(1.025).toString(), "1025000000000000000");
        assert.equal(Wei.of(1.025).toNumber(), 1.025);
    })

    it("rounds Tokens properly", () => {
        assert.equal(Tokens.of(1.02).toString(), "102");
        assert.equal(Tokens.of(1.02).toNumber(), 1.02);
    })

    it("ratio multiplication", () => {
        assert.strictEqual(Ratio.of(2.5).mul(Ratio.of(1.5)).toNumber(), 3.75);
        assert.strictEqual(Ratio.parse(2500000).mul(Ratio.parse(1500000)).toString(), "3750000");

        assert.strictEqual(Tokens.of(25.00).mul(Ratio.of(1.5)).toNumber(), 37.50);
        assert.strictEqual(Tokens.parse(2500).mul(Ratio.parse(1500000)).toString(), "3750");

        assert.strictEqual(Wei.of(0.003).mul(Ratio.of(1.5)).toNumber(), 0.0045);
        assert.strictEqual(Wei.parse(3000000000000000).mul(Ratio.parse(1500000)).toString(), "4500000000000000");

        assert.strictEqual(Wei.of(300).mul(Ratio.of(1.5)).toNumber(), 450);
        assert.strictEqual(Wei.parse(300000000000000000000).mul(Ratio.parse(1500000)).toString(), "450000000000000000000");
    })

    it("ratio division", () => {
        assert.strictEqual(Ratio.of(3.75).div(Ratio.of(1.5)).toNumber(), 2.5);
        assert.strictEqual(Ratio.parse(3750000).div(Ratio.parse(1500000)).toString(), "2500000");

        assert.strictEqual(Tokens.of(37.50).div(Ratio.of(1.5)).toNumber(), 25.00);
        assert.strictEqual(Tokens.parse(3750).div(Ratio.parse(1500000)).toString(), "2500");

        assert.strictEqual(Wei.of(0.0045).div(Ratio.of(1.5)).toNumber(), 0.003);
        assert.strictEqual(Wei.parse(4500000000000000).div(Ratio.parse(1500000)).toString(), "3000000000000000");

        assert.strictEqual(Wei.of(450).div(Ratio.of(1.5)).toNumber(), 300);
        assert.strictEqual(Wei.parse(450000000000000000000).div(Ratio.parse(1500000)).toString(), "300000000000000000000");
    })

    it("addition beyond MAX_SAFE_INTEGER", () => {
        // add 1 ETH and 1 WEI
        assert.strictEqual(Wei.of(1).add(Wei.parse(1)).toString(), "1000000000000000001");
        assert.strictEqual(Wei.parse(1).add(Wei.of(1)).toString(), "1000000000000000001");
    })
});
