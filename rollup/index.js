const tea = require("../api.js")

module.exports = {
    transform: async (code, id) => {
        if (id.endsWith(".tea") === true) {
            const result = await tea(code, { target: "es6" })

            if (result instanceof Error) {
                throw result
            }

            return result.code
        }
        return code
    }
}
