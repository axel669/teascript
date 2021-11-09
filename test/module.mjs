import fs from "fs/promises"

import transpile from "./transpile.mjs"

const main = async () => {
    try {
        const js = await transpile()
        await fs.writeFile("test/output/tea.mjs", js)
    }
    catch (error) {
        console.error(error)
    }
}

main()
