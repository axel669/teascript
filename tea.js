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

const _at = (source, key) => {
    if (typeof key === "string" || key >= 0) {
        return source[key]
    }
    return source[source.length + key]
}

const nope = 2
const wat = _range(0, 10, nope, (x) => x ** 2)
const min = 2
const other = _range(5, min, 1)
console.log(_at(wat,-2))
console.log(wat)
console.log(other)