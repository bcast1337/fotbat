"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactAppFile = void 0;
const reactAppFile = (context) => {
    const { name } = context;
    return {
        relativePath: `${name}.react-18-app.cjs`,
        content: `/** @type {import("@teambit/react.apps.react-app-types").ReactAppOptions} */
module.exports.default = {
  name: "${name}",
  entry: [require.resolve("./${name}.app-root")],
};`,
    };
};
exports.reactAppFile = reactAppFile;
//# sourceMappingURL=react-app.js.map