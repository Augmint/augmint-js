const dotenvConfig  = require("dotenv").config;
const fs = require("fs");
const DOTENV_PATH = ".env";

const loadEnv = (NODE_ENV = process.env.NODE_ENV) => {
    if (!NODE_ENV) {
        throw new Error("The NODE_ENV environment variable is required but was not specified.");
    }

    // https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
    const dotenvFiles = [
        `${DOTENV_PATH}.${NODE_ENV}.local`,
        `${DOTENV_PATH}.${NODE_ENV}`,
        // Don't include `.env.local` for `test` environment since normally you expect tests to produce the same results for everyone
        NODE_ENV !== "test" && `${DOTENV_PATH}.local`,
        DOTENV_PATH // the base .env
    ].filter((x) => x !== null);

    // Load environment variables from .env* files. Suppress warnings using silent if this file is missing.
    // dotenv will never modify any environment variables that have already been set. https://github.com/motdotla/dotenv
    dotenvFiles.forEach(dotenvFile => {
        if (fs.existsSync(dotenvFile)) {
            dotenvConfig({
                path: dotenvFile
            });
        }
    });

    return process.env;
};

module.exports = loadEnv;
