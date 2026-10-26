// Build an Electron prebuild for opencv4nodejs without the unpublished
// @nut-tree/opencv-build-<platform> packages.
//
// Required env:
//   OPENCV_DIR        e.g. C:\opencv\opencv\build
//   ELECTRON_TARGET   e.g. 25.9.8
// Optional env:
//   GH_TOKEN          GitHub token, only used when IS_TAG=true
//   IS_TAG            "true" to upload the prebuild to the matching GitHub release
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const cwd = process.cwd();
const opencvRoot = process.env.OPENCV_DIR || "C:\\opencv\\opencv\\build";
const electronTarget = process.env.ELECTRON_TARGET || "25.9.8";
const isTag = process.env.IS_TAG === "true";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

function fail(msg) {
  console.error("[opencv-prebuilt] " + msg);
  process.exit(1);
}

function log(msg) {
  console.log("[opencv-prebuilt] " + msg);
}

// --- locate OpenCV ------------------------------------------------------
const includeDir = path.join(opencvRoot, "include");
if (!fs.existsSync(path.join(includeDir, "opencv2", "opencv.hpp"))) {
  fail("OpenCV headers not found in " + includeDir);
}

const x64Dir = path.join(opencvRoot, "x64");
if (!fs.existsSync(x64Dir)) fail("OpenCV x64 dir not found: " + x64Dir);

const toolsetDirs = fs
  .readdirSync(x64Dir)
  .filter((d) => fs.existsSync(path.join(x64Dir, d, "lib")));
if (!toolsetDirs.length) fail("no OpenCV lib dir under " + x64Dir);
// prefer the newest toolset (vc16 > vc15 > vc14)
toolsetDirs.sort();
const libDir = path.join(x64Dir, toolsetDirs[toolsetDirs.length - 1], "lib");
const binDir = path.join(path.dirname(libDir), "bin");
log("OpenCV lib dir: " + libDir);

const libFiles = fs.readdirSync(libDir).filter((f) => /^opencv_.*\.lib$/i.test(f));
if (!libFiles.length) fail("no opencv_*.lib found in " + libDir);

// Prefer the world library when present: one import lib for every module.
const worldLib = libFiles.find((f) => /^opencv_world.*\.lib$/i.test(f));
let libraries;
let defines = [];
if (worldLib) {
  libraries = [path.join(libDir, worldLib)];
  log("using world library: " + worldLib);
  // Module availability for OpenCV >= 3.2 comes from <opencv2/opencv_modules.hpp>,
  // which the world build generates with every module it contains.
} else {
  libraries = libFiles.map((f) => path.join(libDir, f));
  defines = libFiles.map(
    (f) =>
      "OPENCV4NODEJS_FOUND_LIBRARY_" +
      f
        .replace(/^opencv_/i, "")
        .replace(/[0-9]+\.lib$/i, "")
        .toUpperCase()
  );
  log("using module libraries: " + libFiles.join(", "));
}

// --- stage runtime DLLs next to the binding -----------------------------
const releaseDir = path.join(cwd, "build", "Release");
fs.mkdirSync(releaseDir, { recursive: true });

const dllFiles = fs.readdirSync(binDir).filter((f) => /\.dll$/i.test(f));
let copied = 0;
for (const f of dllFiles) {
  if (worldLib) {
    // world build: copy the world dll and the ffmpeg plugin, nothing else
    if (!/opencv_world|videoio_ffmpeg/i.test(f)) continue;
  } else if (/^opencv_world/i.test(f)) {
    continue;
  }
  fs.copyFileSync(path.join(binDir, f), path.join(releaseDir, f));
  copied++;
}
log("copied " + copied + " OpenCV dll(s) into build/Release");

// --- run prebuild -------------------------------------------------------
const prebuildBin = require.resolve("prebuild/bin.js");
const args = [
  prebuildBin,
  "--runtime=electron",
  "--target=" + electronTarget,
  "--arch=" + process.arch,
  "--include-regex=\\.(node|dll)$",
  "--verbose",
];
if (isTag && token) {
  args.push("-u", token);
}

log("running: node " + args.join(" "));
const res = spawnSync(process.execPath, args, {
  cwd,
  stdio: "inherit",
  env: Object.assign({}, process.env, {
    OPENCV4NODEJS_DEFINES: defines.join("\n"),
    OPENCV4NODEJS_INCLUDES: includeDir,
    OPENCV4NODEJS_LIBRARIES: libraries.join("\n"),
  }),
});

if (res.error) fail(res.error.message);
if (res.status !== 0) fail("prebuild exited with code " + res.status);

for (const f of fs.readdirSync(releaseDir)) {
  const p = path.join(releaseDir, f);
  log("built: " + f + " (" + fs.statSync(p).size + " bytes)");
}
