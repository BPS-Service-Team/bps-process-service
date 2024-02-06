const { createLogger, format, transports } = require("winston");
const { combine, timestamp, label } = format;
require("winston-daily-rotate-file");
require("dotenv").config();

const PREFIX = process.env.CONFIG_PREFIX_COMPANY || "";
const errorsFolder = process.env.ERRORS_FOLDER;
const logsFolder = process.env.LOGS_FOLDER;

const loggerConfig = {
  level: "info",
  format: combine(
    format.splat(),
    label({
      label: PREFIX ? PREFIX : "",
    }),
    timestamp(),
    format.json()
  ),
  exitOnError: false,
};

const errorLogger = createLogger({
  ...loggerConfig,
  transports: [
    new transports.DailyRotateFile({
      filename: `${errorsFolder}/%DATE%_error.log`,
      level: "error",
      datePattern: "YYYY-MM-DD-HH",
      maxFiles: 5,
      maxSize: "512m",
    }),
  ],
});

const infoLogger = createLogger({
  ...loggerConfig,
  transports: [
    new transports.DailyRotateFile({
      filename: `${logsFolder}/%DATE%.log`,
      datePattern: "YYYY-MM-DD-HH",
      maxFiles: 5,
      maxSize: "512m",
    }),
  ],
});

module.exports = {
  infoLogger,
  errorLogger,
};
