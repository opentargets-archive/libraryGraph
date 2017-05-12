module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module'
  },
  env: {
    browser: true
  },
  globals: {
    'cordova': true,
    'DEV': true,
    'PROD': true,
    '__THEME': true
  },
  // https://github.com/feross/standard/blob/master/RULES.md#javascript-standard-style
  extends: 'airbnb-base',
  // required to lint *.vue files
  plugins: [
    'html'
  ],
  // add your custom rules here
  'rules': {
    // allow console log
    // 'no-console': ["error", { allow: ["warn", "error"] }],
    'no-console': 0,

    // allow using functions before defining them
    'no-use-before-define': ["error", { "functions": false }],
      
    // allow double bitwise for converting to int:
    'no-bitwise': 0,  
    // allow paren-less arrow functions
    'arrow-parens': 0,
    'one-var': 0,
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    'brace-style': [2, 'stroustrup', { 'allowSingleLine': true }]
  }
}
