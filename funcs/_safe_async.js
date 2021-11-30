const _safe_async = async (func) => {
    try {
        return await func()
    }
    catch (err) {
        return err
    }
}

module.exports = _safe_async
