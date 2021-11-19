function isPal(..._args) {
    const num = _args[0];
    const f = num.toString();
    const b = f.split("").reverse().join("");
    return f === b;
}
function* pal(..._args) {
    for (
        let _pos = 999, _end = 900, _start = _pos, _inc = 1;
        _end < _start ? _pos > _end : _pos < _end;
        _end < _start ? (_pos -= _inc) : (_pos += _inc)
    ) {
        const a = _pos;
        for (
            let _pos = 999, _end = 900, _start = _pos, _inc = 1;
            _end < _start ? _pos > _end : _pos < _end;
            _end < _start ? (_pos -= _inc) : (_pos += _inc)
        ) {
            const b = _pos;
            yield a * b;
        }
    }
}
console.log(Math.max(...[...pal()].filter(isPal)));
