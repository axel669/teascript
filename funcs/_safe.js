const _safe = (func) => {
    try {
        return func()
    }
    catch (err) {
        return err
    }
}

module.exports = _safe
