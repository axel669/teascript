const _set = (source, key, value) => {
    if (typeof key === "string" || key >= 0) {
        source[key] = value
        return
    }
    source[source.length + key] = value
}
