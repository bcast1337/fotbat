"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTransformers = exports.generateTransformers = exports.fallbacksAliases = exports.fallbacksProvidePluginConfig = exports.configFactory = exports.html = exports.fallbacks = exports.WebpackBundler = void 0;
var webpack_bundler_1 = require("./webpack-bundler");
Object.defineProperty(exports, "WebpackBundler", { enumerable: true, get: function () { return webpack_bundler_1.WebpackBundler; } });
var webpack_fallbacks_1 = require("./config/webpack-fallbacks");
Object.defineProperty(exports, "fallbacks", { enumerable: true, get: function () { return webpack_fallbacks_1.fallbacks; } });
var html_1 = require("./config/html");
Object.defineProperty(exports, "html", { enumerable: true, get: function () { return html_1.html; } });
var webpack_config_1 = require("./config/webpack.config");
Object.defineProperty(exports, "configFactory", { enumerable: true, get: function () { return webpack_config_1.configFactory; } });
var webpack_fallbacks_provide_plugin_config_1 = require("./config/webpack-fallbacks-provide-plugin-config");
Object.defineProperty(exports, "fallbacksProvidePluginConfig", { enumerable: true, get: function () { return webpack_fallbacks_provide_plugin_config_1.fallbacksProvidePluginConfig; } });
var webpack_fallbacks_aliases_1 = require("./config/webpack-fallbacks-aliases");
Object.defineProperty(exports, "fallbacksAliases", { enumerable: true, get: function () { return webpack_fallbacks_aliases_1.fallbacksAliases; } });
var transformers_1 = require("./transformers");
Object.defineProperty(exports, "generateTransformers", { enumerable: true, get: function () { return transformers_1.generateTransformers; } });
Object.defineProperty(exports, "runTransformers", { enumerable: true, get: function () { return transformers_1.runTransformers; } });
//# sourceMappingURL=index.js.map