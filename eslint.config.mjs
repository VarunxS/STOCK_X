import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { FlatCompat } = require('@eslint/eslintrc')
const compat = new FlatCompat({ baseDirectory: process.cwd() })

export default [
  { ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'verdict-backend/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]
