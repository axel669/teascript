const _at = require("@axel669/teascript/funcs/_at.js")
const _set = require("@axel669/teascript/funcs/_set.js")
const actions = {
    $set: function (current, value) {
        return value
    },
    $unset: function (...args) {
        const source = args[0]
        const names = args[1]
        const dest = {
            ...source,
        }
        for (const name of names) {
            delete dest[name]
        }
        return dest
    },
    $push: function (current, value) {
        return [...current, value]
    },
    $append: function (current, value) {
        return [...current, ...value]
    },
    $apply: function (current, func) {
        return func(current)
    },
    $filter: function (current, condition) {
        return current.filter(condition)
    },
    $merge: function (current, value) {
        return {
            ...current,
            ...value,
        }
    },
}
function copyObject(...args) {
    const source = args[0]
    const createIfVoid = args[1] ?? false
    if (Array.isArray(source) === true) {
        return [...source]
    }
    if (source === undefined && createIfVoid === true) {
        return {}
    }
    if (typeof source !== "object" || source === null) {
        return source
    }
    if (source instanceof Map === true) {
        return new Map(source)
    }
    if (source instanceof Set === true) {
        return new Set(source)
    }
    if (source.constructor !== Object) {
        return source
    }
    return {
        ...source,
    }
}
function setValues(...args) {
    const info = args[0] ?? {}
    const { dest, key, pos, value, create } = info
    const name = _at(key, pos, false)
    if (pos === key.length - 1) {
        return _at(actions, name, false)(dest, value)
    }
    const next = copyObject(dest, create)
    _set(
        next,
        name,
        setValues({
            dest,
            key,
            pos: pos + 1,
            value,
            create,
        })
    )
    return next
}
function splitKey(...args) {
    const key = args[0]
    return key
        .replace(/\.\./g, `\x00`)
        .split(".")
        .map(function (name) {
            return name.replace(/\x00/g, ".")
        })
}
function update(...args) {
    const source = args[0]
    const updates = args[1]
    const createIfVoid = args[2] ?? false
    return Object.keys(updates).reduce(function (source, key) {
        return setValues({
            key: splitKey(key),
            pos: 0,
            dest: source,
            value: _at(updates, key, false),
            create: createIfVoid,
        })
    }, source)
}
update.actions = actions
export default update
