const helpers = require("./helpers");
const fs = require("fs");
const path = require("path");

helpers.extendArrayMethods();

run();

async function run() {
  console.log("start script");

  const ordersCsv = await fs.promises.readFile("./input/orders.csv", "utf-8");
  if (!ordersCsv) {
    console.log("unable to find orders.csv file in inputs folder");
    return;
  }

  const ordersArr = helpers.parseCsvToJson(ordersCsv, ",");
  await fs.promises.writeFile(
    `${path.join(__dirname, "./")}/output/orders.json`,
    JSON.stringify({ ordersArr }, null, 2)
  );

  console.log("end script");
}
