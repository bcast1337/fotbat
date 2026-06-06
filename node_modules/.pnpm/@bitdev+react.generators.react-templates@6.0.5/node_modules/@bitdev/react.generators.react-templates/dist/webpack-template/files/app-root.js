"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppRootFile = void 0;
const AppRootFile = (context) => {
    const { name, namePascalCase: Name } = context;
    return {
        relativePath: `${name}.app-root.tsx`,
        content: `import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ${Name} } from './${name}.js';

const domNode = document.getElementById('root');

if (domNode) hydrateRoot(
  domNode,
  <BrowserRouter>
    <${Name} />
  </BrowserRouter>
);
`,
    };
};
exports.AppRootFile = AppRootFile;
//# sourceMappingURL=app-root.js.map