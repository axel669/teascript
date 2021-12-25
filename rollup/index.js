const tea = require("../compile.js")

module.exports = {
    transform: async (code, id) => {
        if (id.endsWith(".tea") === true) {
            const result = await tea(code, { target: "es6" })

            if (result instanceof Error) {
                throw result
            }

            return result[0]
        }
        return code
    }
}
