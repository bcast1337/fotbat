"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactWebpackAppTemplate = void 0;
const index_file_1 = require("./files/index-file");
const app_1 = require("./files/app");
const react_app_1 = require("./files/react-app");
const composition_1 = require("./files/composition");
const app_root_1 = require("./files/app-root");
const docs_1 = require("../app-template/files/docs");
class ReactWebpackAppTemplate {
    constructor(name = 'react-webpack-app', description = 'create a webpack-based static React app template', hidden = false, env, isApp = true) {
        this.name = name;
        this.description = description;
        this.hidden = hidden;
        this.env = env;
        this.isApp = isApp;
    }
    generateFiles(context) {
        return [
            (0, index_file_1.indexFile)(context),
            (0, composition_1.compositionFile)(context),
            (0, app_1.AppFile)(context),
            (0, react_app_1.reactAppFile)(context),
            (0, docs_1.appDocsFile)(context),
            (0, app_root_1.AppRootFile)(context),
        ];
    }
    static from(options = {}) {
        return () => new ReactWebpackAppTemplate(options.name, options.description, options.hidden, options.env);
    }
}
exports.ReactWebpackAppTemplate = ReactWebpackAppTemplate;
//# sourceMappingURL=app-template.js.map