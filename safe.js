const $safe = async (func, args = []) => {
    try {
        return await func(...args)
    }
    catch (err) {
        return err
    }
}
const _safe = (func, args = []) => {
    try {
        return func(...args)
    }
    catch (err) {
        return err
    }
}

module.exports = {_safe, $safe}
