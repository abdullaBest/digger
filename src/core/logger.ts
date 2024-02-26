enum LogCode {
	info = 0,
	warn = 1,
	error = 2,
	details = 3
}

class Logger {
	private static _instance;
	callback: Function;
	print_console: boolean;
	
	/**
	 * Current logging level less value produces more output
	 */
	level: number;

	constructor() {
		this.level = 0;
		this.print_console = true;
	}

	static get instance(): Logger {
		if (!Logger._instance) {
			Logger._instance = new Logger();
		}

		return Logger._instance;
	}

	init(callback: (code: LogCode, level: number, ...args) => void) {
		this.callback = callback;
	}

	print(code: LogCode, level: number, ...args) {
		if (level < this.level) {
			return;
		}

		if (this.callback) {
			this.callback(code, level, ...args);
		}

		if (!this.print_console) {
			return;
		}

		switch(code) {
			case LogCode.warn:
				console.warn(...args);
				break;
			case LogCode.error:
				console.error(...args);
				break;
			default:
				console.log(...args);
		}
	}

	log(...args) {
		this.print(LogCode.info, 0, ...args);
	}

	warn(...args) {
		this.print(LogCode.warn, 0, ...args);
	}

	error(...args) {
		this.print(LogCode.error, 0, ...args);
	}
}

const logger = Logger.instance;

export default logger;
export { logger, Logger, LogCode }
