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
const actions = {
    a: 10,
    b: 12,
};
const arr = _range(0, 100, 1, (x) => x ** 2);
console.log(arr.join(" "));
