import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts', 'src/mcp.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  banner: ({ format }) => {
    // Add shebang only for cli entry
    return {};
  },
});
