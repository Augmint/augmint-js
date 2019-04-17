const expect = require("chai").expect;
const promiseTimeout = require("../dist/utils/promiseTimeout.js");

describe("promiseTimeout", () => {
    it("should handle throw", async () => {
        const rejectingFx = async () => {
            throw new Error("expected reject");
        };

        await promiseTimeout(1000, rejectingFx).catch(error => {
            expect(error.message).to.equal("expected reject");
        });
    });

    it("should resolve", async () => {
        const resolvingPromise = new Promise(resolve => {
            resolve(true);
        });
        const returnValue = await promiseTimeout(1000, resolvingPromise);
        expect(returnValue).to.equal(true);
    });

    it("should timeout", async () => {
        await promiseTimeout(1, () => {
            return new Promise(() => {}); // never resolves
        }).catch(error => {
            expect(error.message).toContain("timed out");
        });
    });
});
