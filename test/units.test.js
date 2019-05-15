const { assert, expect } = require("chai");
const { Wei, Tokens, Percent } = require("../dist/index.js");

describe("Units", () => {

    it("params are required", () => {
    	[Percent, Wei, Tokens].forEach(Type => {
	        assert.throws(() => new Type());
	        assert.throws(() => new Type(null));
    	})
 	});

    it("no operations accross types", () => {
    	assert.throws(() => Wei.of(1).add(Tokens.of(100)));
    	assert.throws(() => Wei.of(1).mul(Tokens.of(100)));
    	assert.throws(() => Wei.of(1).toTokensAt(Percent.of(1), Tokens.of(100)));	
    });

    it("conversions", () => {
    	assert.equal(Tokens.of(100.01).toString(), "10001");
    	assert.equal(Percent.of(1.01).toNumber(), 1.01);
    	assert.equal(JSON.stringify({tokens: Tokens.of(100.01) }), '{"tokens":"10001"}');
    });

});