// const orders = require("./input/orders.json");
// const symbols = require("./input/symbols.json");
const symbolInfoFile = require("./symbolInfo");
const helpers = require("./helpers");
const fs = require("fs");
const path = require("path");
const symbolMap = symbolInfoFile.symbolMap;

helpers.extendArrayMethods();

const symbolsToLog = [];
const includeHistory = false;

run();

async function run() {
  console.log("start script");

  const ordersCsv = await fs.promises.readFile("./input/orders.csv", "utf-8");
  if (!ordersCsv) {
    console.log("unable to find orders.csv file in inputs folder");
    return;
  }

  const ordersArr = helpers.parseCsvToJson(ordersCsv, ",");
  const ordersArrWithValues = ordersArr.filter(
    (order) => !!order.Date && !!order["Trade Price"]
  );
  await fs.promises.writeFile(
    "./output/orders.json",
    JSON.stringify(ordersArrWithValues, null, 2)
  );

  // NOTE: the orders should come sorted in the CSV, so we don't need to worry about that
  const simpleOrders = ordersArrWithValues.map((order) => {
    const csvFuturesCode = order["Futures Code"];
    const symbolDataForCode = symbolMap[csvFuturesCode];
    if (!symbolDataForCode) {
      console.log("missing symbol data for code: " + csvFuturesCode);
      console.log(order);
      return;
    }

    return {
      date: order.Date,
      side: Number(order.Buy) > 0 ? "Buy" : "Sell",
      csvFuturesCode,
      symbolRoot: symbolDataForCode.symbolRoot,
      commission:
        Number(order["Posted Commission"]) +
        Number(order["Posted Clearing Fee"]) +
        Number(order["Posted NFA Fee"]),
      price: Number(order["Trade Price"]),
      quantity: Number(order.Buy) || Number(order.Sell),
    };
  });
  await fs.promises.writeFile(
    "./output/simpleOrders.json",
    JSON.stringify(simpleOrders, null, 2)
  );

  // totals up the gains/losses for each symbol and outputs it into a .json file for us to peruse
  await addUpGainsAndLosses(simpleOrders);

  console.log("end script");
}

async function addUpGainsAndLosses(simpleOrders) {
  // add up gains/losses by symbol
  const gainsBySymbol = {};
  const ordersByCsvFuturesCode = helpers.groupBy(
    simpleOrders,
    "csvFuturesCode"
  );
  for (const code in ordersByCsvFuturesCode) {
    const symbolInfo = symbolMap[code];
    if (!symbolInfo) {
      console.log(code + " has no symbol info");
      continue;
    }

    const orders = ordersByCsvFuturesCode[code];
    if (!orders.length) {
      console.log(code + " has no orders");
      continue;
    }

    gainsBySymbol[code] = addUpGainsForOrders(orders, symbolInfo);
  }

  // include total gains/losses/commissions
  const gainsData = {
    totalDollarsGainOrLoss: 0,
    totalCommissions: 0,
    totalDollarsGainOrLossIncludingCommissions: 0,
  };
  for (const symbol in gainsBySymbol) {
    gainsData.totalDollarsGainOrLoss += formatMoney(
      gainsBySymbol[symbol].dollarsGainOrLoss
    );
    gainsData.totalCommissions += formatMoney(
      gainsBySymbol[symbol].commissions
    );
    gainsData.totalDollarsGainOrLossIncludingCommissions += formatMoney(
      gainsBySymbol[symbol].totalDollarsGainOrLossIncludingCommissions
    );
    gainsData[symbol] = gainsBySymbol[symbol];
  }

  await fs.promises.writeFile(
    `${path.join(__dirname, "./")}/output/futuresMarketGains.json`,
    JSON.stringify(gainsData, null, 2)
  );
}

function addUpGainsForOrders(simpleOrders, symbolInfo) {
  let metrics = {
    symbol: symbolInfo.symbolRoot,
    name: symbolInfo.description,
    orders: simpleOrders.length,
    dollarsPerPoint: symbolInfo.pointValue,
    dollarsPerCsvPoint: symbolInfo.csvPointValue,
    commissions: 0,
    pointsGainOrLoss: 0,
    dollarsGainOrLoss: 0,
    totalDollarsGainOrLossIncludingCommissions: 0,
    openTrades: [],
    history: [],
  };

  let openTrades = [];
  let openTradesSide = null;
  simpleOrders.forEach((order) => {
    if (
      symbolsToLog.includes(symbolInfo.symbolRoot) ||
      symbolsToLog.includes("all")
    ) {
      console.log(metrics.pointsGainOrLoss);
      console.log(order);
    }
    if (includeHistory) {
      metrics.history.push(order);
    }
    metrics.commissions += order.commission;

    // no open trades
    if (!openTradesSide) {
      openTradesSide = order.side;
      openTrades.push(order);
      if (
        symbolsToLog.includes(symbolInfo.symbolRoot) ||
        symbolsToLog.includes("all")
      ) {
        console.log("add to open trades");
      }
      return;
    }

    // open trades are the same side
    if (openTradesSide === order.side) {
      openTrades.push(order);
      if (
        symbolsToLog.includes(symbolInfo.symbolRoot) ||
        symbolsToLog.includes("all")
      ) {
        console.log("add to open trades");
      }
      return;
    }

    // close out open trades
    let processingOrder = true;
    while (processingOrder) {
      // if a previous iteration of the loop closed out the last open order
      // then make this the new open order
      if (!openTrades.length) {
        openTradesSide = order.side;
        openTrades.push(order);
        if (
          symbolsToLog.includes(symbolInfo.symbolRoot) ||
          symbolsToLog.includes("all")
        ) {
          console.log("add to open trades");
        }
        return;
      }

      const oldestOpenTrade = openTrades[0];
      const pointsDiffPerQuantity = oldestOpenTrade.price - order.price;
      const pointsGainOrLossPerQuantity =
        openTradesSide === "Buy"
          ? pointsDiffPerQuantity * -1
          : pointsDiffPerQuantity;

      // oldest trade has more than enough quantity to satisfy current order
      if (oldestOpenTrade.quantity > order.quantity) {
        openTrades[0].quantity -= order.quantity;
        const totalPointsGainOrLoss =
          pointsGainOrLossPerQuantity * order.quantity;
        metrics.pointsGainOrLoss += totalPointsGainOrLoss;
        if (
          symbolsToLog.includes(symbolInfo.symbolRoot) ||
          symbolsToLog.includes("all")
        ) {
          console.log("adjust total points by " + totalPointsGainOrLoss);
        }
        processingOrder = false;
        // return since this order is done
        return;
      }

      // current order will close out the oldest open trade
      openTrades.shift();

      // perfect amount to close the open trade and satisfy the current order
      if (oldestOpenTrade.quantity === order.quantity) {
        const totalPointsGainOrLoss =
          pointsGainOrLossPerQuantity * order.quantity;
        metrics.pointsGainOrLoss += totalPointsGainOrLoss;
        if (
          symbolsToLog.includes(symbolInfo.symbolRoot) ||
          symbolsToLog.includes("all")
        ) {
          console.log("adjust total points by " + totalPointsGainOrLoss);
        }
        processingOrder = false;
        // return since this order is done
        return;
      }

      // current order has more quantity that the oldest open trade can satisfy
      // use up the oldest open order, reduce order quantity, then do the next iteration of the loop
      const totalPointsGainOrLoss =
        pointsGainOrLossPerQuantity * oldestOpenTrade.quantity;
      metrics.pointsGainOrLoss += totalPointsGainOrLoss;
      if (
        symbolsToLog.includes(symbolInfo.symbolRoot) ||
        symbolsToLog.includes("all")
      ) {
        console.log("adjusting order quantity for partial processing");
        console.log("adjust total points by " + totalPointsGainOrLoss);
      }
      order.quantity -= oldestOpenTrade.quantity;
    }
  });

  if (
    symbolsToLog.includes(symbolInfo.symbolRoot) ||
    symbolsToLog.includes("all")
  ) {
    console.log(metrics.pointsGainOrLoss);
  }

  metrics.dollarsGainOrLoss = formatMoney(
    metrics.pointsGainOrLoss * metrics.dollarsPerCsvPoint
  );
  metrics.commissions = formatMoney(metrics.commissions);
  metrics.totalDollarsGainOrLossIncludingCommissions = formatMoney(
    metrics.dollarsGainOrLoss + metrics.commissions
  );
  metrics.openTrades = openTrades;
  return metrics;
}

function formatMoney(amt) {
  return Math.round(amt * 100) / 100;
}
