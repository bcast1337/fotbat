"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webpackTransformerFile = void 0;
const webpackTransformerFile = () => {
    return {
        relativePath: './config/webpack.config.ts',
        content: `import type { WebpackConfigMutator } from '@teambit/webpack';

/**
 * modifies the webpack config for the components preview bundle.
 * @see https://bit.dev/reference/webpack/webpack-config
 */
export const webpackTransformer = (
  configMutator: WebpackConfigMutator
): WebpackConfigMutator => configMutator;`,
    };
};
exports.webpackTransformerFile = webpackTransformerFile;
//# sourceMappingURL=webpack-transformer.js.map