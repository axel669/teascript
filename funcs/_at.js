const _at = (source, key, optional) => {
    if (optional === true && source === undefined) {
        return undefined
    }
    if (typeof key === "string" || key >= 0) {
        return source[key]
    }
    return source[source.length + key]
}

module.exports = _at
