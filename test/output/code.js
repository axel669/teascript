const _range = (start, end, inc, map = (i) => i) => {
    if (start > end) {
        const array_r = [];
        for (let item = start; item > end; item -= inc) {
            array_r.push(map(item));
        }
        return array_r;
    }

    const array = [];
    for (let item = start; item < end; item += inc) {
        array.push(map(item));
    }
    return array;
};
console.log(
    _range(0, 1000, 1)
        .filter(function (n) {
            return n % 3 === 0 || n % 5 === 0;
        })
        .reduce(function (total, n) {
            return total + n;
        }, 0)
);
