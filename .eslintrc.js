/**
 * Enterprise-grade ESLint configuration for FullScan Mobile Platform.
 *
 * Enforces:
 *  - Strict TypeScript typing (no implicit any, no unsafe operations)
 *  - React & React Hooks correctness
 *  - React Native platform hygiene (no inline styles, no color literals, no raw text)
 *  - Accessibility (jsx-a11y)
 *  - Secure coding (eslint-plugin-security)
 *  - Consistent imports (grouping, ordering, alias resolution for `@/`)
 *  - Modern JS/TS best practices (unicorn, sonarjs, promise)
 *  - Test hygiene (jest, testing-library)
 *  - Prettier formatting as ESLint errors
 */
module.exports = {
  root: true,
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:react-native/all',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:jsx-a11y/recommended',
    'plugin:security/recommended-legacy',
    'plugin:promise/recommended',
    'plugin:sonarjs/recommended-legacy',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-native',
    'import',
    'jsx-a11y',
    'unicorn',
    'security',
    'promise',
    'sonarjs',
  ],
  env: {
    'react-native/react-native': true,
    es2024: true,
    node: true,
    jest: true,
  },
  settings: {
    react: { version: 'detect' },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      'babel-module': {},
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.ios.ts', '.android.ts'],
      },
    },
  },
  rules: {
    // ---------- Prettier ----------
    'prettier/prettier': 'error',

    // ---------- TypeScript (strict) ----------
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',

    // ---------- React ----------
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/self-closing-comp': 'error',
    'react/jsx-no-useless-fragment': 'warn',
    'react/jsx-boolean-value': ['error', 'never'],
    'react/no-array-index-key': 'warn',
    'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',

    // ---------- React Native ----------
    // Enforces project rule: NO inline styles (see AGENTS.md)
    'react-native/no-inline-styles': 'error',
    'react-native/no-color-literals': 'error',
    'react-native/no-unused-styles': 'error',
    'react-native/no-single-element-style-arrays': 'error',
    // Enforces project rule: all strings must be localized (en/hi/te)
    'react-native/no-raw-text': [
      'error',
      { skip: ['Trans', 'Translate'] },
    ],
    'react-native/split-platform-components': 'off',

    // ---------- Imports ----------
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'object',
          'type',
        ],
        pathGroups: [
          { pattern: 'react', group: 'external', position: 'before' },
          { pattern: 'react-native', group: 'external', position: 'before' },
          { pattern: '@/**', group: 'internal', position: 'before' },
        ],
        pathGroupsExcludedImportTypes: ['react', 'react-native'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-default-export': 'off',
    'import/no-unresolved': 'error',
    'import/no-cycle': ['error', { maxDepth: 5 }],
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',
    'import/no-duplicates': 'error',

    // ---------- Unicorn ----------
    'unicorn/filename-case': 'off',
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/no-null': 'off',
    'unicorn/no-array-reduce': 'off',
    'unicorn/no-useless-undefined': 'off',
    'unicorn/prefer-module': 'off',
    'unicorn/prefer-top-level-await': 'off',
    'unicorn/consistent-function-scoping': 'warn',

    // ---------- SonarJS ----------
    'sonarjs/cognitive-complexity': ['warn', 15],
    'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],

    // ---------- Security ----------
    'security/detect-object-injection': 'off', // too noisy for TS
    'security/detect-non-literal-fs-filename': 'off',

    // ---------- General ----------
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    curly: ['error', 'all'],
    'prefer-const': 'error',
  },
  overrides: [
    // Test files: relax strict typing & rules
    {
      files: [
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/__tests__/**/*.{ts,tsx,js,jsx}',
        '**/tests/**/*.{ts,tsx,js,jsx}',
      ],
      extends: [
        'plugin:jest/recommended',
        'plugin:testing-library/react',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'react-native/no-inline-styles': 'off',
        'react-native/no-color-literals': 'off',
        'react-native/no-raw-text': 'off',
        'sonarjs/no-duplicate-string': 'off',
      },
    },
    // Config files
    {
      files: ['*.config.js', '*.config.ts', 'metro.config.js', 'babel.config.js', 'jest.config.js'],
      rules: {
        'unicorn/prefer-module': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-commonjs': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'ios/',
    'android/',
    'build/',
    'dist/',
    'coverage/',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
    'jest.config.js',
    '.eslintrc.js',
  ],
};
