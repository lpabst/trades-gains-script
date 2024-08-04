function parseCsvToJson(csv = "", delimiter = ",") {
  if (!csv) {
    return [];
  }

  var lines = csv.split("\n");

  var result = [];
  var headers = lines[0].split(delimiter);
  for (var i = 1; i < lines.length; i++) {
    var obj = {};
    var currentline = lines[i].split(delimiter);

    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j];
    }

    result.push(obj);
  }

  return result;
}

function keyBy(arr, key) {
  const keyedMap = {};
  arr.forEach((item) => {
    keyedMap[item[key]] = item;
  });
  return keyedMap;
}

function groupBy(arr, key) {
  const keyedMap = {};
  arr.forEach((item) => {
    keyedMap[item[key]] = keyedMap[item[key]] || [];
    keyedMap[item[key]].push(item);
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

module.exports = {
  extendArrayMethods,
  clone,
  keyBy,
  groupBy,
  parseCsvToJson,
};
