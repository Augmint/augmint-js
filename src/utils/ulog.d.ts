declare module "ulog" {
    function logger(moduleName?: string): Logger;

    enum LogLevel {
        ERROR = 1,
        WARN = 2,
        INFO = 3,
        LOG = 4,
        DEBUG = 5,
        TRACE = 6
    }

    class Logger {
        public ERROR: LogLevel;
        public WARN: LogLevel;
        public INFO: LogLevel;
        public LOG: LogLevel;
        public DEBUG: LogLevel;
        public TRACE: LogLevel;

        public level: LogLevel;

        constructor(moduleName?: string);
        error(...args: any[]): void;
        warn(...args: any[]): void;
        info(...args: any[]): void;
        log(...args: any[]): void;
        debug(...args: any[]): void;
        trace(...args: any[]): void;
        verbose(...args: any[]): void;
        silly(...args: any[]): void;
    }

    export = logger;
}
