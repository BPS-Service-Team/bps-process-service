const { itemFileValidations } = require("./validations");

const objShipmentType = {
  X: "relocation",
  E: "putaway",
  A: "picking",
};

const date = new Date();
const getFormatDate = () => {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  let day = date.getDate();
  let hh = date.getHours();
  let mm = date.getMinutes();
  let ss = date.getSeconds();
  return `${year}${month.toString().padStart(2, "0")}${day}${hh}${mm}${ss}`;
};

const itemValidations = (
  file,
  shipmentType,
  arrValidationsResultTemp,
  endpoint
) => {
  const itemValid = itemFileValidations(file, shipmentType);
  if (itemValid.status === 400) {
    arrValidationsResultTemp?.push({
      ...itemValid,
      endpoint: objShipmentType[endpoint],
    });
    return false;
  }
  return true;
};

const getHeaderPropertiesAndObj = (type, items, dataFile, fileName) => {
  return {
    INTERFACE_NAME: fileName,
    BATCHID: getFormatDate(),
    [`${type}_LIST`]: [
      {
        [`${type === "GR" ? "PA" : type}_LIST_NO`]:
          dataFile?.WarehouseNo + dataFile?.ToNumber + "-1",
        [`${type}_LIST_ITEM`]: items,
      },
    ],
  };
};

const commonProperties = (dataFile, file, type) => {
  const typeItemDCS = type === "SRE" ? "TR" : type;
  const typeItemsPSSB = type === "SRE" ? "FR_" : "";
  return {
    [`${typeItemDCS}_DATE`]: dataFile?.CreatedDate?.split(".")
      ?.reverse()
      ?.join("/"),
    [`${typeItemDCS}_CODE`]: dataFile?.WarehouseNo + dataFile?.ToNumber,
    [`${typeItemDCS}D_SEQ`]: file?.ItemNo?.toString(),
    [`${typeItemsPSSB}PLANT`]: file?.Plant === "A001" ? "ALC" : "LMA",
    [`${typeItemsPSSB}STO_LOC`]: file?.StorageLocation,
    [`${typeItemsPSSB}STOCK_TYPE`]: "UU",
    [`${typeItemsPSSB}BATCH_NO`]: file?.Batch,
    STOCK_NO: file?.Material,
    UOM: file?.UoM,
    PACK_KEY: null,
    SERIAL_NO: null,
    PRIORITY: 1,
  };
};

const typeOfOperation = (
  shipmentType,
  dataFile,
  arrWarehouseNoTemp,
  fileName,
  arrValidationsResultTemp
) => {
  if (!dataFile?.ToItem?.length) {
    arrValidationsResultTemp.push({
      status: 400,
      error: "ToItem list dont have elements",
      dataFile,
      endpoint: objShipmentType[shipmentType],
    });
    return { data: {} };
  }
  switch (shipmentType) {
    case "E":
      const arrPutawayTemp = [];
      let isValidE = false;
      dataFile?.ToItem?.forEach((file) => {
        isValidE = itemValidations(
          file,
          shipmentType,
          arrValidationsResultTemp,
          "E"
        );
        if (isValidE) {
          arrWarehouseNoTemp.push(dataFile.WarehouseNo);
          arrPutawayTemp.push({
            ...commonProperties(dataFile, file, "GR"),
            GRA_SEQ: file?.ItemNo?.toString(),
            VAL_TYPE: file?.ValuationType,
            ITM_NAME: file?.MaterialShortText,
            SUG_PA_QTY: file?.Quantity,
            LENGTH: file?.Length,
            WIDTH: file?.Width,
            HEIGHT: file?.Height,
            CBM: 0,
            NET_WEIGHT: 0,
            GROSS_WEIGHT: 0,
            EXPIRY_DATE: null,
            MANU_DATE: null,
            MIN_STOCK_LV_AGV: null,
            MIN_STOCK_LV_AGF: null,
            WES_LOC: file?.DestinationStorageType === "101" ? "AGV" : "AGF",
            RACK_TYPE: file?.RackType,
            SKU_CATEGORY: file?.SkuCategory,
          });
        }
      });
      let dataPutaway = {};
      if (arrPutawayTemp.length) {
        dataPutaway = getHeaderPropertiesAndObj(
          "GR",
          arrPutawayTemp,
          dataFile,
          fileName
        );
      }
      return { endpoint: "putaway", data: dataPutaway };
    case "A":
      let isValidA = false;
      const arrPickingTemp = [];
      dataFile?.ToItem?.forEach((file) => {
        isValidA = itemValidations(
          file,
          shipmentType,
          arrValidationsResultTemp,
          "A"
        );
        if (isValidA) {
          arrWarehouseNoTemp.push(dataFile.WarehouseNo);
          arrPickingTemp.push({
            ...commonProperties(dataFile, file, "DO"),
            PLD_SEQ: file?.ItemNo?.toString(),
            VAL_TYPE: file?.ValuationType,
            ITM_NAME: file?.MaterialShortText,
            EXPIRY_DATE: null,
            MANU_DATE: null,
            SUG_PICK_QTY: file?.Quantity,
            WES_LOC: file?.SourceStorageType === "101" ? "AGV" : "AGF",
          });
        }
      });
      let dataPicking = {};
      if (arrPickingTemp.length) {
        dataPicking = getHeaderPropertiesAndObj(
          "DO",
          arrPickingTemp,
          dataFile,
          fileName
        );
      }

      return { endpoint: "picking", data: dataPicking };
    case "X":
      let isValidX;
      const arrReolocationTemp = [];
      dataFile?.ToItem?.forEach((file) => {
        isValidX = itemValidations(
          file,
          shipmentType,
          arrValidationsResultTemp,
          "X"
        );
        if (isValidX) {
          arrWarehouseNoTemp.push(dataFile.WarehouseNo);
          arrReolocationTemp.push({
            ...commonProperties(dataFile, file, "SRE"),
            PO_NO: null,
            ITM_NAME: file?.MaterialShortText,
            LENGTH: file?.Length,
            WIDTH: file?.Width,
            HEIGHT: file?.Height,
            CBM: 0,
            NET_WEIGHT: 0,
            GROSS_WEIGHT: 0,
            FR_VAL_TYPE: file?.ValuationType,
            TO_PLANT: file?.Plant === "A001" ? "ALC" : "LMA",
            TO_STO_LOC: file?.StorageLocation,
            TO_BATCH_NO: file?.Batch,
            TO_VAL_TYPE: file?.ValuationType,
            TO_STOCK_TYPE: "UU",
            TRD_QTY: file?.Quantity,
            FR_LOC:
              file?.SourceStorageType === "101"
                ? "AGV"
                : file?.SourceStorageType === "102"
                ? "AGF"
                : "WMS",
            TO_LOC:
              file?.DestinationStorageType === "101"
                ? "AGV"
                : file?.DestinationStorageType === "102"
                ? "AGF"
                : "WMS",
            RACK_TYPE: file?.RackType,
            SKU_CATEGORY: file?.SkuCategory,
          });
        }
      });
      let dataReolocation = {};
      if (arrReolocationTemp.length) {
        dataReolocation = getHeaderPropertiesAndObj(
          "SRE",
          arrReolocationTemp,
          dataFile,
          fileName
        );
      }
      return { endpoint: "relocation", data: dataReolocation };
    default:
      return { endpoint: "", data: {} };
  }
};

const getObjProcessed = (dataFile, fileName, arrValidationsResultTemp) => {
  if (!dataFile?.TO?.length) {
    arrValidationsResultTemp.push({
      status: 400,
      error: "File dont have elements",
      endpoint: "NA",
    });
    return { arrData: [] };
  }
  const arrDataTemp = [],
    arrWarehouseNoTemp = [];
  dataFile?.TO?.forEach((data, fileIndex) => {
    const processOperation = typeOfOperation(
      dataFile?.TO[fileIndex]?.ShipmentType,
      data,
      arrWarehouseNoTemp,
      fileName,
      arrValidationsResultTemp
    );
    if (Object.keys(processOperation.data).length) {
      arrDataTemp.push(processOperation);
    }
  });
  return { arrData: arrDataTemp, arrWarehouseNo: arrWarehouseNoTemp };
};

module.exports = {
  getObjProcessed,
};
