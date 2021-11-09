const _range = (start, end, inc, map = i => i) => {
    if (start > end) {
        const array_r = []
        for (let item = start; item > end; item -= inc) {
            array_r.push(
                map(item)
            )
        }
        return array_r
    }

    const array = []
    for (let item = start; item < end; item += inc) {
        array.push(
            map(item)
        )
    }
    return array
}

import fetch from "node-fetch"
const source = {
a: _range(0, 10, 1),
b: 12,
c: 14
}
const {a, ...rest} = source
const [a1, a2, a3, ...aRest] = a
console.log(a)
console.log(rest)
console.log(a1, a2, a3)
console.log(aRest)