const tea = require("../api.js")

module.exports = {
    script: async (input) => {
        if (input.attributes.type === "tea") {
            const result = await tea(input.content, { target: "es6" })

            if (result instanceof Error) {
                throw result
            }
            return { code: result.code }
        }
        return { code: input.content }
    }
}
