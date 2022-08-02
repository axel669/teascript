# TeaScript Language Reference

TeaScript was made to have a stricter syntax than JS, so that the same tasks
could be written using less code. Some of the syntax compiles into very long
but (hopefully) optimized JS. At some point I will actually make more detailed
benchmarks and save them in this repo.

The syntax of this language will probably make people angry at first (even I
had to get used to some of it), but I ask that people try it with an open mind.
Some of the features are things I thought might be interesting, but I don't
know how well they will actually work as code bases grow larger, and if they
turn out to suck then at least we know more about what doesn't work.

## Planned Features
- bitwise ops
- block regex

### Possible Features
- [chained comparison](https://coffeescript.org/#comparisons)
- `has` keyword for testing keys in objects without using access
    (currently can cause performance problems if imported code has awful getters
    and setters in custom objects/classes)
- `nil` keyword, it felt cool in ruby

### Undecided Features
- `await`/`yield` in do
- have `await`/`yield` auto convert the function to async/generator

## FAQ
This is pretty new, there aren't any frequent questions (yet?).

## Removed Features

### Classes
I won't be adding classes to the language, don't bother asking.

### Else
See the section on if statements, probably never adding this, but I'm open to
discuss use cases that would warrant adding it back in.

### With
Most linters yell at people not to use this, it's pretty much universally
accepted that its not a great thing.

### Coerscing Equality Operators
The arguments for using the ==/!= in JS tend to be "just know better" which
is great if you expect everyone to be an expert, but it's real bad for people
new to the language, and worse for people new to programming.
TeaScript uses ==/!= but it compiles down to ===/!==.

### While Loops
Iterating over ranges and collections is the primary goal of loops, and those
are both done in the for loop. Infinite loops are also done with for loops, so
while loops dont really need to exist in the language.

### Switch
Objects with functions as values and guard clauses cover all the use cases of
switches with fewer potential bugs and more readability, so switches are out.
Will hear arguments if people really want them, but pretty unlikely that I'll
add them in.
