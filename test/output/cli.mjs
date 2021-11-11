function arraydest(..._args) {
    const { names, rest } = _args[0] ?? {};
    const parts = (function () {
        const temp = genJS(names);
        if (rest == undefined) {
            return temp;
        }
        return [...temp, genJS(rest)];
    })();
    return `[${parts.join(", ")}]`;
}
