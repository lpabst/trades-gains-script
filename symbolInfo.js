// You can get build this info manually for the symbols you trade.
// NOTE: the CSV sometimes has weird point values, like on the copper micro :shrug:
const symbolMap = {
  QG: {
    symbolRoot: "QN",
    description: "E-Mini Natural Gas NG",
    pointValue: 2500,
    csvPointValue: 2500,
  },
  B4: {
    symbolRoot: "MHG",
    description: "MHG COPPER",
    pointValue: 2500,
    csvPointValue: 25,
  },
  YW: {
    symbolRoot: "YW",
    description: "MINI WHEAT",
    pointValue: 10,
    csvPointValue: 10,
  },
  MG: {
    symbolRoot: "MGC",
    description: "E-Micro GOLD",
    pointValue: 10,
    csvPointValue: 10,
  },
  89: {
    symbolRoot: "PL",
    description: "NYM PLATINUM",
    pointValue: 50,
    csvPointValue: 50,
  },
  "W-": {
    symbolRoot: "W",
    description: "WHEAT",
    pointValue: 50,
    csvPointValue: 50,
  },
  YC: {
    symbolRoot: "XC",
    description: "MINI CORN",
    pointValue: 10,
    csvPointValue: 10,
  },
};

module.exports = {
  symbolMap,
};
