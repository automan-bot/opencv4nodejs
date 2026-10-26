const { opencvLibDir } = require("./dirs");
const { readdirSync, existsSync } = require("fs");
const { resolvePath } = require('./commons');
const { join } = require("path");

// binding.gyp evaluates this to bundle the OpenCV libraries when they come
// from the legacy @nut-tree/opencv-build-<platform> package. That package is
// no longer published; when OpenCV is provided through
// OPENCV4NODEJS_INCLUDES/OPENCV4NODEJS_LIBRARIES there is nothing to bundle.
if (existsSync(opencvLibDir)) {
    for (const file of readdirSync(opencvLibDir)) {
        console.log(resolvePath(join(opencvLibDir, file)));
    }
}
