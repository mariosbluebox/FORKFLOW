import { FlatCompat } from '@eslint/eslintrc'
import security from 'eslint-plugin-security'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**'] },
  ...compat.extends('next/core-web-vitals'),
  {
    plugins: { security },
    rules: {
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-bidi-characters': 'error',
      'security/detect-object-injection': 'off',
    },
  },
]

export default eslintConfig
