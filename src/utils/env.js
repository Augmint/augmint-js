/*
    set process.env vars from .env files, based on NODE_ENV setting, in this order:
    1. .env                                     - loadded first
    2. .env.[development|test|production]       - Environment-specific settings.
    3. .env.local                               - Local overrides. This file is loaded for all environments except test.
    4. .env.[development|test|production].local - Local overrides of environment-specific settings.
    5. environment variables                    - never overwritten
*/
"use strict";

const fs = require("fs");
const dotenvConfig = require("dotenv").config;
const DOTENV_PATH = ".env";

module.exports = (NODE_ENV = process.env.NODE_ENV) => {
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
    ].filter(Boolean);

// Load environment variables from .env* files. Suppress warnings using silent if this file is missing.
// dotenv will never modify any environment variables that have already been set. https://github.com/motdotla/dotenv
    dotenvFiles.forEach(dotenvFile => {
        if (fs.existsSync(dotenvFile)) {
            dotenvConfig({
                path: dotenvFile
            });
            // require("dotenv").config({
            //     path: dotenvFile
            // });
        }
    });

    return process.env;
};
