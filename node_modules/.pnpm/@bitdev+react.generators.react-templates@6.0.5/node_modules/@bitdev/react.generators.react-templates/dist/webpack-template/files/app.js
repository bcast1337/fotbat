"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppFile = void 0;
const AppFile = (context) => {
    const { name, namePascalCase: Name } = context;
    return {
        relativePath: `${name}.tsx`,
        content: `import { Routes, Route } from 'react-router-dom';

export function ${Name}() {
  return (
    <Routes>
      <Route path="/" element={<h1>Hello React SSR!</h1>} />
    </Routes>
  );
}`,
    };
};
exports.AppFile = AppFile;
//# sourceMappingURL=app.js.map