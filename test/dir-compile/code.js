const _range = require("@axel669/teascript/funcs/_range.js")
const _at = require("@axel669/teascript/funcs/_at.js")
function rnd(...args) {
    return Math.random() < 0.5
}
let board = _range(0, 50, 1, (x) => _range(0, 50, 1, (x) => rnd()))
function nextGeneration(...args) {
    const alive = args[0]
    const neighbors = args[1]
    return alive
}
function iteration(...args) {
    const board = args[0]
    return board.map(function (row, y) {
        return row.map(function (alive, x) {
            return nextGeneration(alive, [
                _at(_at(board, y - 1, false), x - 1, true),
                _at(_at(board, y - 1, false), x, true),
                _at(_at(board, y - 1, false), x + 1, true),
                _at(_at(board, y, false), x + 1, false),
                _at(_at(board, y + 1, false), x + 1, true),
                _at(_at(board, y + 1, false), x, true),
                _at(_at(board, y + 1, false), x - 1, true),
                _at(_at(board, y, false), x - 1, false),
            ])
        })
    })
}
iteration(board)
