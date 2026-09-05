import { spawnSync } from 'node:child_process'

const root = process.cwd()
const result = spawnSync('node', ['node_modules/tsdown/dist/run.mjs', '--config', 'tsdown.config.ts', '--out-dir', 'lib'], { cwd: root, stdio: 'inherit' })
if (result.error !== undefined) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
