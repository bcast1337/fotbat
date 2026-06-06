"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppRootFile = void 0;
const AppRootFile = (context) => {
    const { name, namePascalCase: Name } = context;
    return {
        relativePath: `${name}.app-root.tsx`,
        content: `import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { ${Name} } from "./${name}.js";

const container = document.getElementById('root');
const root = createRoot(container!);

/**
 * uncomment to render the app with routing (react-router-dom)
 */
root.render(
  <BrowserRouter>
    <${Name} />
  </BrowserRouter>
);`,
    };
};
exports.AppRootFile = AppRootFile;
//# sourceMappingURL=app-root.js.map