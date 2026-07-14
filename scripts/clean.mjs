import { rm } from 'node:fs/promises'

const targets = ['.next', '.turbo', 'tsconfig.tsbuildinfo']

for (const target of targets) {
  await rm(target, { recursive: true, force: true })
}
