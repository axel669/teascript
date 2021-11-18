import update1 from "../output/update.mjs"
import update2 from "../output/tea.mjs"

const source = {a: 10, b: 12}
const actions = {
    "a.$set": 100
}

// console.log(
//     update1(source, actions)
// )
// console.log(
//     update2(source, actions)
// )

const run = (label, count, func) => {
    let current = 0
    console.time(label)
    while (current < count) {
        current += 1
        func()
    }
    console.timeEnd(label)
}

const count = 1000000
run("tea", count, () => update2(source, actions))
run("current", count, () => update1(source, actions))
