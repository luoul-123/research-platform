#!/usr/bin/env node
"use strict";

/**
 * 把从页面「导出」得到的 JSON 转成 assets/private/state.js。
 *
 * 用法：
 *   node tools/make-private-state.js "C:\path\to\research_workbench_2026-11-04.json"
 *
 * 生成的文件只用于本地，已被 .gitignore 忽略。
 */

const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) {
  console.error(
    'Usage: node tools/make-private-state.js "<exported-json-file>"',
  );
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(path.resolve(src), "utf8"));
} catch (e) {
  console.error("Cannot read JSON: " + e.message);
  process.exit(1);
}

if (!data || !Array.isArray(data.entries)) {
  console.error("Not a valid Research Platform export: entries[] is missing.");
  process.exit(1);
}

const out = path.resolve(__dirname, "..", "assets", "private", "state.js");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  "window.PRIVATE_STATE = " + JSON.stringify(data, null, 2) + ";\n",
  "utf8",
);
console.log("Wrote " + out);
