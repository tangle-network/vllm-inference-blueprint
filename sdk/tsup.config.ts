import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/wagmi.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  // viem is a peer; @wagmi/core is an optional peer. Never bundle them.
  external: ["viem", "viem/accounts", "@wagmi/core"],
});
