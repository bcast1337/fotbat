"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallbacksProvidePluginConfig = void 0;
exports.fallbacksProvidePluginConfig = {
    process: require.resolve('process/browser'),
    Buffer: [require.resolve('buffer/'), 'Buffer'],
};
//# sourceMappingURL=webpack-fallbacks-provide-plugin-config.js.map