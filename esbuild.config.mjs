import esbuild from "esbuild";
import { builtinModules } from "node:module";

await esbuild.build({
  entryPoints: ["main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtinModules],
  format: "cjs",
  platform: "node",
  target: "es2020",
  outfile: "main.js",
});
