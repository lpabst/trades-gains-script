const orders = require("./input/orders.json");
const orders2 = require("./input/orders2.json");
const fs = require("fs");
const path = require("path");

async function run() {
  console.log("start script");

  // creates an organized and sorted .json file for us to peruse
  await compareOrders();

  console.log("end script");
}

async function compareOrders() {
  const filledFutures = orders.Orders.filter(
    (order) =>
      order.StatusDescription === "Filled" &&
      order.Legs[0].AssetType === "FUTURE"
  );
  const filledFutures2 = orders2.Orders.filter(
    (order) =>
      order.StatusDescription === "Filled" &&
      order.Legs[0].AssetType === "FUTURE"
  );
  const filledFuturesById = keyBy(filledFutures, "OrderID");
  const filledFutures2ById = keyBy(filledFutures2, "OrderID");

  const results = {
    ordersWithoutCounterpart: [],
    orders2WithoutCounterpart: [],
    ordersWithDifferences: [],
  };
  filledFutures.forEach((order) => {
    const counterpart = filledFutures2ById[order.OrderID];
    if (!counterpart) {
      results.ordersWithoutCounterpart.push(order);
      return;
    }

    // if we already compared this and found differences on the other side, no need to duplicate the entry
    if (
      results.ordersWithDifferences.find((obj) => obj.OrderID === order.OrderID)
    ) {
      return;
    }

    // compare all of the data for the order
    const orderCopy = clone(order);
    const counterpartCopy = clone(counterpart);
    const leg = orderCopy.Legs[0];
    const counterpartLeg = counterpartCopy.Legs[0];
    delete orderCopy.Legs;
    delete counterpartCopy.Legs;
    delete orderCopy.ConditionalOrders;
    delete counterpartCopy.ConditionalOrders;
    for (const key in orderCopy) {
      if (orderCopy[key] !== counterpartCopy[key]) {
        results.ordersWithDifferences.push(orderCopy);
        console.log({
          id: order.OrderID,
          key,
        });
        return;
      }
    }
    for (const key in leg) {
      if (leg[key] !== counterpartLeg[key]) {
        results.ordersWithDifferences.push(orderCopy);
        console.log({
          id: order.OrderID,
          leg: true,
          key,
        });
        return;
      }
    }
  });
  filledFutures2.forEach((order) => {
    const counterpart = filledFuturesById[order.OrderID];
    if (!counterpart) {
      results.orders2WithoutCounterpart.push(order);
      return;
    }

    // if we already compared this and found differences on the other side, no need to duplicate the entry
    if (
      results.ordersWithDifferences.find((obj) => obj.OrderID === order.OrderID)
    ) {
      return;
    }

    // compare all of the data for the order
    const orderCopy = clone(order);
    const counterpartCopy = clone(counterpart);
    const leg = orderCopy.Legs[0];
    const counterpartLeg = counterpartCopy.Legs[0];
    delete orderCopy.Legs;
    delete counterpartCopy.Legs;
    delete orderCopy.ConditionalOrders;
    delete counterpartCopy.ConditionalOrders;
    for (const key in orderCopy) {
      if (orderCopy[key] !== counterpartCopy[key]) {
        results.ordersWithDifferences.push(orderCopy);
        console.log({
          id: order.OrderID,
          key,
        });
        return;
      }
    }
    for (const key in leg) {
      if (leg[key] !== counterpartLeg[key]) {
        results.ordersWithDifferences.push(orderCopy);
        console.log({
          id: order.OrderID,
          leg: true,
          key,
        });
        return;
      }
    }
  });

  await fs.promises.writeFile(
    `${path.join(__dirname, "./")}/output/comparedOrders.json`,
    JSON.stringify(results, null, 2)
  );
}

function keyBy(arr, key) {
  const keyedMap = {};
  arr.forEach((item) => {
    keyedMap[item[key]] = item;
  });
  return keyedMap;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
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
