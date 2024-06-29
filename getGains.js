const orders = require("./input/orders.json");
const symbols = require("./input/symbols.json");
const fs = require("fs");
const path = require("path");

const symbolsToLog = ["QN"];

async function run() {
  console.log("start script");

  // creates an organized and sorted .json file for us to peruse
  await organizeAndSortOrders();

  // totals up the gains/losses for each symbol and outputs it into a .json file for us to peruse
  await addUpGainsAndLosses();

  console.log("end script");
}

async function organizeAndSortOrders() {
  const symbolInfoByRoot = keyBy(symbols.Symbols, "Root");

  const sortedAndOrganizedOrders = {};
  const simpleSortedAndOrganizedOrders = {};
  orders.Orders.forEach((order) => {
    sortedAndOrganizedOrders[order.StatusDescription] =
      sortedAndOrganizedOrders[order.StatusDescription] || [];
    sortedAndOrganizedOrders[order.StatusDescription].push(order);
    simpleSortedAndOrganizedOrders[order.StatusDescription] =
      simpleSortedAndOrganizedOrders[order.StatusDescription] || [];
    simpleSortedAndOrganizedOrders[order.StatusDescription].push(order);
  });

  for (const status in sortedAndOrganizedOrders) {
    const sortedOrders = sortedAndOrganizedOrders[status].sort((a, b) =>
      a.ClosedDateTime.localeCompare(b.ClosedDateTime)
    );
    sortedAndOrganizedOrders[status] = sortedOrders;
  }

  for (const status in simpleSortedAndOrganizedOrders) {
    const sortedOrders = simpleSortedAndOrganizedOrders[status].sort((a, b) =>
      a.ClosedDateTime.localeCompare(b.ClosedDateTime)
    );
    const simpleSortedOrders = sortedOrders.map((order) => {
      const assetType = order.Legs[0].AssetType;
      const rootSymbol =
        assetType === "FUTURE"
          ? order.Legs[0].Underlying
          : order.Legs[0].Symbol;
      const symbolInfo = symbolInfoByRoot[rootSymbol];
      let symbolName =
        assetType === "FUTURE" && symbolInfo && symbolInfo.Description;

      return {
        assetType: order.Legs[0].AssetType,
        id: order.OrderID,
        date: order.ClosedDateTime,
        rootSymbol: rootSymbol,
        name: symbolName,
        side: order.Legs[0].BuyOrSell,
        quantity: Number(order.Legs[0].ExecQuantity),
        price: Number(order.FilledPrice),
        commission: Number(order.CommissionFee),
      };
    });
    simpleSortedAndOrganizedOrders[status] = simpleSortedOrders;
  }

  await fs.promises.writeFile(
    `${path.join(__dirname, "./")}/output/sortedOrders.json`,
    JSON.stringify(sortedAndOrganizedOrders, null, 2)
  );
  await fs.promises.writeFile(
    `${path.join(__dirname, "./")}/output/simpleSortedOrders.json`,
    JSON.stringify(simpleSortedAndOrganizedOrders, null, 2)
  );
}

async function addUpGainsAndLosses() {
  const filledFuturesOrders = orders.Orders.filter(
    (order) =>
      Number(order.FilledPrice) > 0 && order.Legs[0].AssetType === "FUTURE"
  );
  const ordersWithLeg = filledFuturesOrders.map((order) => {
    const orderWithLeg = order;
    orderWithLeg.leg = order.Legs[0];
    if (order.FilledPrice !== order.leg.ExecutionPrice) {
      console.log(
        "Order has price mismatch, check which one we should be using"
      );
      console.log(order);
    }

    orderWithLeg.id = orderWithLeg.OrderID;
    orderWithLeg.quantity = Number(orderWithLeg.leg.ExecQuantity);
    orderWithLeg.price = Number(orderWithLeg.FilledPrice);
    orderWithLeg.commission = Number(orderWithLeg.CommissionFee);
    orderWithLeg.date = orderWithLeg.ClosedDateTime;
    orderWithLeg.side = orderWithLeg.leg.BuyOrSell;
    orderWithLeg.rootSymbol = orderWithLeg.leg.Underlying;
    return orderWithLeg;
  });
  const filledOrders = [];
  const filledOrdersBySymbol = {};
  ordersWithLeg.forEach((order) => {
    filledOrders.push(order);
    const symbol = order.rootSymbol;
    filledOrdersBySymbol[symbol] = filledOrdersBySymbol[symbol] || [];
    filledOrdersBySymbol[symbol].push(order);
  });

  // add up gains/losses by symbol
  const gainsBySymbol = {};
  for (const symbol in filledOrdersBySymbol) {
    const symbolInfo = symbols.Symbols.find((s) => s.Root === symbol);
    if (!symbolInfo) {
      console.log(symbol + " has no symbol info");
      continue;
    }

    const orders = filledOrdersBySymbol[symbol];
    if (!orders.length) {
      console.log(symbol + " has no orders");
      continue;
    }

    gainsBySymbol[symbol] = addUpGainsForOrders(orders, symbolInfo);
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

function addUpGainsForOrders(orders, symbolInfo) {
  let metrics = {
    symbol: symbolInfo.Root,
    name: symbolInfo.Description,
    orders: orders.length,
    dollarsPerPoint: symbolInfo.PriceFormat.PointValue,
    commissions: 0,
    pointsGainOrLoss: 0,
    dollarsGainOrLoss: 0,
    totalDollarsGainOrLossIncludingCommissions: 0,
    openTrades: [],
    // I might add this later
    // history: [],
  };

  let openTrades = [];
  let openTradesSide = null;
  const sortedOrders = orders.sort((a, b) => a.date.localeCompare(b.date));
  sortedOrders.forEach((order) => {
    if (
      symbolsToLog.includes(symbolInfo.Root) ||
      symbolsToLog.includes("all")
    ) {
      console.log(metrics.pointsGainOrLoss);
      console.log({
        date: order.date,
        orderSide: order.side,
        commission: order.commission,
        price: order.price,
        quantity: order.quantity,
      });
    }
    metrics.commissions += order.commission;

    // no open trades
    if (!openTradesSide) {
      openTradesSide = order.side;
      openTrades.push(order);
      if (
        symbolsToLog.includes(symbolInfo.Root) ||
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
        symbolsToLog.includes(symbolInfo.Root) ||
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
          symbolsToLog.includes(symbolInfo.Root) ||
          symbolsToLog.includes("all")
        ) {
          console.log("add to open trades");
          if (order.quantity !== Number(order.leg.ExecQuantity)) {
            console.log({
              msg: "adding partial quantity to open trades",
              quantity: order.quantity,
              ExecQuantity: order.leg.ExecQuantity,
            });
          }
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
          symbolsToLog.includes(symbolInfo.Root) ||
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
          symbolsToLog.includes(symbolInfo.Root) ||
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
        symbolsToLog.includes(symbolInfo.Root) ||
        symbolsToLog.includes("all")
      ) {
        console.log("adjusting order quantity for partial processing");
        console.log("adjust total points by " + totalPointsGainOrLoss);
      }
      order.quantity -= oldestOpenTrade.quantity;
    }
  });

  if (symbolsToLog.includes(symbolInfo.Root) || symbolsToLog.includes("all")) {
    console.log(metrics.pointsGainOrLoss);
  }

  metrics.dollarsGainOrLoss = formatMoney(
    metrics.pointsGainOrLoss * metrics.dollarsPerPoint
  );
  metrics.commissions = formatMoney(metrics.commissions);
  metrics.totalDollarsGainOrLossIncludingCommissions = formatMoney(
    metrics.dollarsGainOrLoss - metrics.commissions
  );
  metrics.openTrades = openTrades.map((order) => ({
    date: order.date,
    orderSide: order.side,
    commission: order.commission,
    price: order.price,
    quantity: order.quantity,
  }));
  return metrics;
}

function formatMoney(amt) {
  return Math.round(amt * 100) / 100;
}

function keyBy(arr, key) {
  const keyedMap = {};
  arr.forEach((item) => {
    keyedMap[item[key]] = item;
  });
  return keyedMap;
}

function extendArrayMethods() {
  Array.prototype.find = function (cb) {
    for (let i = 0; i < this.length; i++) {
      if (cb(this[i])) {
        return this[i];
      }
    }
  };

  Array.prototype.forEach = function (cb) {
    for (let i = 0; i < this.length; i++) {
      cb(this[i], i, this);
    }
  };

  Array.prototype.map = function (cb) {
    let newArr = [];
    this.forEach((item, i, arr) => newArr.push(cb(item, i, arr)));
    return newArr;
  };

  Array.prototype.filter = function (cb) {
    let newArr = [];
    this.forEach((item, i, arr) => {
      if (cb(item, i, arr)) {
        newArr.push(item);
      }
    });
    return newArr;
  };
}

extendArrayMethods();
run();
