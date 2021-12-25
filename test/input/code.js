const _range = require("@axel669/teascript/funcs/_range.js")
console.log(_range(0, 1000, 1)
    .filter(function (n) {
        return (n % 3) === 0 || (n % 5) === 0
    })
    .reduce(function (total, n) {
        return total + n
    }, 0))
async function test(..._args) {

    const items = _args[0]
    return await Promise.all(items.map(function (item) {
        return item.asyncThing()
    }))
}
console.log((_ref1 = 10, _ref1 = _ref1 + 1, _ref1 = (_ref1 * 2) + _ref1, _ref1 =
    function () {
        return _ref1
    }))