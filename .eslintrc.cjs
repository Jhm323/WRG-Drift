module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignorePatterns: ['dist', 'node_modules', 'apps/api/generated'],
  overrides: [
    {
      files: ['apps/web/**/*.jsx', 'apps/web/**/*.js'],
      plugins: ['react', 'react-hooks', 'react-refresh'],
      extends: [
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
      ],
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      settings: {
        react: { version: '19.2' },
      },
      rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        // No PropTypes/TS in this codebase — component props aren't runtime-validated.
        'react/prop-types': 'off',
      },
    },
  ],
};
