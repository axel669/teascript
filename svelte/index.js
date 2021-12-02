const tea = require("../compile.js")

module.exports = {
    script: async (input) => {
        if (input.attributes.type === "tea") {
            const result = await tea(input.content, { es6: true })

            if (result instanceof Error) {
                throw result
            }
            return { code: result[0] }
        }
        return { code: input.content }
    }
}
