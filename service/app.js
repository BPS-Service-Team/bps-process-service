const fs = require("fs");
const path = require("path");
const https = require("https");
const { getObjProcessed } = require("./utils/processFile");
const axios = require("axios");
const cron = require("node-cron");
const { fileValidations } = require("./utils/validations");
const { errorLogger, infoLogger } = require("./utils/logger");
require("dotenv").config();

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const requestFolder = process.env.REQUEST_FOLDER;
const errorsFolder = process.env.ERRORS_FOLDER;
const logsFolder = process.env.LOGS_FOLDER;
const processFolder = process.env.PROCESS_FOLDER;
const useLogger = process.env.USE_LOGGER || "false";

const arrFilesProcessed = [];
const removeElementOfArray = (element) => {
  const indexElement = arrFilesProcessed.indexOf(element);
  arrFilesProcessed.splice(indexElement, 1);
};

const checkFilesInFolder = () => {
  try {
    const files = fs.readdirSync(requestFolder);
    if (files.length) {
      files.map((file) => {
        if (arrFilesProcessed.indexOf(file) === -1) {
          arrFilesProcessed.push(file);
          processFile(file);
        }
      });
    }
  } catch (error) {
    console.error("Error reading the files in the folder", error);
  }
};

const readFile = (fileName) => {
  try {
    const dataFile = fs.readFileSync(`${requestFolder}/${fileName}`, {
      encoding: "utf-8",
    });
    const data = JSON.parse(dataFile);
    return data;
  } catch (error) {
    console.error("Error reading file", error);
    return [];
  }
};

const requestApi = (endpoint, dataFile) => {
  console.log("[requestApi] API URL: ", `${process.env.API_URL}/${endpoint}`);
  console.log("[requestApi] API Key: ", process.env.API_KEY);
  return new Promise((resolve) => {
    axios
      .post(`${process.env.API_URL}/${endpoint}`, dataFile, {
        httpsAgent: agent,
        headers: {
          "x-api-key": process.env.API_KEY,
        },
      })
      .then((res) => {
        resolve({
          status: res?.data?.errno,
          error: res?.data?.message,
          dataFile,
        });
      })
      .catch((err) => {
        console.error(
          "[requestApi] Response error from api call: ",
          err?.response?.data ? err.response.data : err
        );
        resolve({
          status: err?.response?.status || 500,
          error:
            JSON.stringify(err?.response?.data?.errors) ||
            err?.response?.data?.message ||
            "api not able to reach",
          dataFile,
        });
      });
  });
};

const buildObj = (level, message, dataFile, objContent = {}) => {
  return {
    label: "process-files",
    level,
    message,
    input: dataFile,
    content: objContent,
  };
};

const processFile = async (fileName) => {
  try {
    const dataFile = readFile(fileName);
    const arrValidationsResultTemp = [];
    const { arrData, arrWarehouseNo } = getObjProcessed(
      dataFile,
      fileName,
      arrValidationsResultTemp
    );
    if (arrData.length) {
      let validateData = {};
      let index = 0;
      for (const dataIterator of arrData) {
        validateData = fileValidations(dataIterator, arrWarehouseNo[index]);
        if (validateData.status !== 400) {
          const responseData = await requestApi(dataIterator.endpoint, dataIterator.data);
          createObjAndFile(
            ["relocation", "picking", "putaway"],
            fileName,
            [{ ...responseData, endpoint: dataIterator.endpoint }],
            dataFile
          );
        } else {
          arrValidationsResultTemp.push({
            ...validateData,
            endpoint: dataIterator.endpoint,
          });
        }
        index++;
      }
    }

    if (arrValidationsResultTemp.length) {
      createObjAndFile(
        ["relocation", "picking", "putaway", "NA"],
        fileName,
        arrValidationsResultTemp,
        dataFile
      );
    }

    moveToFolder(fileName);
    removeElementOfArray(fileName);
  } catch (error) {
    onError(fileName, error?.message);
  }
};

const createObjAndFile = (endpoints, fileName, arrTemp, dataFile) => {
  try {
    let arrSuccessTemp = [],
      arrErrorsTemp = [],
      endpoint = "";
    endpoints.forEach((endpointItem) => {
      const itemOperation = arrTemp.filter(
        (item) => item.endpoint === endpointItem
      );
      if (itemOperation.length) {
        arrSuccessTemp = [];
        arrErrorsTemp = [];
        endpoint = itemOperation[0]?.endpoint;

        itemOperation.forEach((responseItem) => {
          if (useLogger === "true") {
            let msg = responseItem.status === 0 ? "success" : "error";
            loggerMethod(
              responseItem.status === 0 ? false : true,
              `File process ${msg}, ${responseItem.error}`,
              {
                input: fileName,
                // content: responseItem.dataFile,
                type: endpointItem,
              }
            );
          } else {
            if (responseItem.status === 0) {
              arrSuccessTemp.push(
                JSON.stringify(
                  buildObj(
                    "info",
                    "File process success",
                    dataFile,
                    responseItem.dataFile
                  )
                )
              );
            } else {
              arrErrorsTemp.push(
                JSON.stringify(
                  buildObj(
                    "error",
                    `File process error: ${responseItem.error}`,
                    dataFile,
                    responseItem.dataFile
                  )
                )
              );
            }
          }
        });

        if (useLogger === "false") {
          if (arrSuccessTemp.length) {
            appendFile(fileName, logsFolder, arrSuccessTemp, false, endpoint);
          }
          if (arrErrorsTemp.length) {
            appendFile(fileName, errorsFolder, arrErrorsTemp, true, endpoint);
          }
        }
      }
    });
  } catch (error) {
    onError(fileName, error?.message);
  }
};

const loggerMethod = (isError, message, loggerContent) => {
  if (isError) {
    errorLogger.error(message, loggerContent);
  } else {
    infoLogger.info(message, loggerContent);
  }
};

const onError = (fileName, errorMsg) => {
  if (useLogger === "true") {
    loggerMethod(true, "Error process file", errorMsg);
  } else {
    appendFile(
      fileName,
      errorsFolder,
      [
        JSON.stringify(
          buildObj("error", `Error process file: ${errorMsg}`, [])
        ),
      ],
      true,
      "NA"
    );
  }
  moveToFolder(fileName);
  removeElementOfArray(fileName);
};

const appendFile = (fileName, folder, contentFile, isError, typeRequest) => {
  const fileNameParsed = path.parse(fileName).name;
  const filePath = `${folder}/${fileNameParsed}_${typeRequest}${
    isError ? "_error" : ""
  }.log`;
  try {
    fs.appendFileSync(filePath, contentFile.join("\n") + "\n");
    console.log(`Append file successfully`);
  } catch (error) {
    console.error("Error append file", error);
  }
};

const moveToFolder = (fileName) => {
  try {
    fs.renameSync(
      `${requestFolder}/${fileName}`,
      `${processFolder}/${fileName}`
    );
    console.log(`File ${fileName} moved`);
  } catch (error) {
    console.error(`Error moving file ${fileName}`, error);
  }
};

(() => {
  cron.schedule("*/20 * * * * *", () => {
    checkFilesInFolder();
  });
})();
