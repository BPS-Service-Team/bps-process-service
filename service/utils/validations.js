const fileValidations = ({ data, endpoint }, warehouseNo) => {
  const typeOperation =
    endpoint === "relocation" ? "SRE" : endpoint === "picking" ? "DO" : "GR";

  if (!data[`${typeOperation}_LIST`]?.length) {
    console.error(
      "Error: [fileValidations] Items list not have elements. Data: ",
      data[`${typeOperation}_LIST`]?.length
    );
    return {
      status: 400,
      error: "Items list not have elements",
      dataFile: data,
    };
  }

  if (warehouseNo !== "W01") {
    console.error(
      `Error: [fileValidations] Warehouse isn't valid. Data: `,
      warehouseNo
    );
    return {
      status: 400,
      error: "WarehouseNo is invalid",
      dataFile: data,
    };
  }

  return {
    status: 0,
    error: "",
    dataFile: data,
  };
};

const getMoreInfoFrom = (data) => {
  let info = [];
  const type = typeof data;
  if (type === 'string') {
    for (let i = 0; i < data.length; i++) {
      info.push(data.charCodeAt(i));
    }
  }
  info.push(type);

  return `[${info.join(' | ')}]`;
};

const itemFileValidations = (itemFile, shipmentType) => {
  if (itemFile?.IsSerialNumberManaged === "Y") {
    console.error(
      `Error: [fileValidations] IsSerialNumberManaged equals 'Y'. Data: ${itemFile?.IsSerialNumberManaged} ${getMoreInfoFrom(itemFile?.IsSerialNumberManaged)}`
    );
    return {
      status: 400,
      error: `IsSerialNumberManaged equals 'Y'. Item ${itemFile?.Material} ${getMoreInfoFrom(itemFile?.Material)}`,
    };
  }

  if (itemFile?.IsCableLayerManaged === "Y") {
    console.error(
      `Error: [fileValidations] IsCableLayerManaged equals 'Y'. Data: ${itemFile?.IsCableLayerManaged} ${getMoreInfoFrom(itemFile?.IsCableLayerManaged)}`
    );
    return {
      status: 400,
      error: `IsCableLayerManaged equals 'Y'. Item ${itemFile?.Material} ${getMoreInfoFrom(itemFile?.Material)}`,
    };
  }

  if (itemFile?.SpecialStockIndicator !== "") {
    console.error(
      `Error: [fileValidations] SpecialStockIndicator isn't empty. Data: ${itemFile?.SpecialStockIndicator} ${getMoreInfoFrom(itemFile?.SpecialStockIndicator)}`
    );
    return {
      status: 400,
      error: `SpecialStockIndicator is not empty. Item ${itemFile?.Material}`,
    };
  }

  if (itemFile?.RackType === "") {
    console.error(
      `Error: [fileValidations] RackType is empty. Data: ${itemFile?.RackType}`
    );
    return {
      status: 400,
      error: `RackType is empty. Item ${itemFile?.Material}`,
    };
  }

  if (itemFile?.SkuCategory === "") {
    console.error(
      `Error: [fileValidations] SkuCategory is empty. Data: ${itemFile?.SkuCategory}`
    );
    return {
      status: 400,
      error: `SkuCategory is empty. Item ${itemFile?.Material}`,
    };
  }

  let blnReturn = false;
  switch (shipmentType) {
    case "E":
      blnReturn = shipmentTypeValidation([itemFile?.DestinationStorageType]);
      if (!blnReturn) {
        console.error(
          "Error: [itemFileValidations] Putaway fail destination: ",
          itemFile?.DestinationStorageType
        );
        return {
          status: 400,
          error: `Putaway fail destination, should be 101 or 102. Data: ${itemFile?.DestinationStorageType}. Item ${itemFile?.Material}`,
        };
      }
      break;
    case "A":
      blnReturn = shipmentTypeValidation([itemFile?.SourceStorageType]);
      if (!blnReturn) {
        console.error(
          "Error: [itemFileValidations] Picking fail source: ",
          itemFile?.SourceStorageType
        );
        return {
          status: 400,
          error: `Picking fail source, should be 101 or 102. Data: ${itemFile?.SourceStorageType}. Item ${itemFile?.Material}`,
        };
      }
      break;
    case "X":
      blnReturn = shipmentTypeValidation([
        itemFile?.DestinationStorageType,
        itemFile?.SourceStorageType,
      ]);
      if (!blnReturn) {
        console.error(
          "Error: [itemFileValidations] Relocation fail locations: ",
          [itemFile?.DestinationStorageType, itemFile?.SourceStorageType]
        );
        return {
          status: 400,
          error: `Relocation fail locations, some should be 101 or 102. Data: ${itemFile?.DestinationStorageType},${itemFile?.SourceStorageType}. Item ${itemFile?.Material}`,
        };
      }
      break;
  }

  return {
    status: 0,
  };
};

const shipmentTypeValidation = (arrayItems) => {
  let isValid = false;
  if (arrayItems?.length) {
    arrayItems?.map((item) => {
      if (item === "101" || item === "102") {
        isValid = true;
      }
    });
  }
  return isValid;
};

module.exports = {
  fileValidations,
  itemFileValidations,
};
