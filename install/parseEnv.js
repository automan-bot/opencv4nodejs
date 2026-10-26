const envName = process.argv[2]

if (!envName) {
  throw new Error('no env name passed to parseEnv')
}

let value = process.env[envName]

// Only fall back to the legacy @nut-tree/opencv-build-<platform> detection
// when the caller did not provide a value. That package is no longer
// published, so requiring it unconditionally breaks every build.
if (value === undefined) {
  const defaults = require("./defaults")
  value = defaults[envName] ? defaults[envName]() : ''
}

if (!value) {
  // print nothing so gyp does not receive an empty define/library entry
  process.exit(0)
}

String(value)
  .split('\n')
  .filter((line) => line.length > 0)
  .forEach((line) => console.log(line))
