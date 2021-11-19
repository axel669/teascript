const _range = require("@axel669/teascript/funcs/_range.js");
const actions = {
    a: 10,
    b: 12,
};
const arr = _range(0, 100, 1, (x) => x ** 2);
console.log(arr.join(" "));
