for (let _i = @{start}, _max = @{end}; (_max < 0 ? _i > _max : _i < _max); _i += (_max < 0 ? -1 : 1)) {
    const x = _i
    save = x
    @{loop}
}
