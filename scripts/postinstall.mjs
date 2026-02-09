/**
 * Postinstall fix: class-transformer/storage subpath export
 *
 * `class-transformer` v0.5.x has `cjs/storage.js` and `esm5/storage.js`
 * but no root-level `storage.js` and no `exports` field in package.json.
 * `@nestjs/mapped-types` does `require('class-transformer/storage')` inside
 * a try-catch, but Vite's esbuild pre-bundler treats it as a hard dependency
 * and fails during dependency optimization.
 *
 * This script creates a root-level proxy so the subpath resolves correctly.
 */
import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '../node_modules/class-transformer/storage.js');

if (!existsSync(target)) {
  writeFileSync(target, `"use strict";\nmodule.exports = require("./cjs/storage.js");\n`);
  console.log('[postinstall] Created class-transformer/storage.js proxy');
} else {
  console.log('[postinstall] class-transformer/storage.js already exists');
}
