/**
 * Babel for the tests only — the production build has its own config via react-scripts.
 *
 * `preset-react` is here so a module containing JSX can be imported by a test at all. Without
 * it `@babel/preset-typescript` parses a .tsx file as plain TypeScript and the first `<` is a
 * syntax error, which meant **no component in the app could be tested** and logic had to be
 * moved out of components to become testable at all.
 */
module.exports = {
  presets: [['@babel/preset-env', {targets: {node: 'current'}}],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
};
