module.exports = {
  'apps/api/**/*.ts': ['eslint --fix --max-warnings=0', 'prettier --write'],
  'apps/mobile/**/*.{ts,tsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,md}': ['prettier --write'],
};
