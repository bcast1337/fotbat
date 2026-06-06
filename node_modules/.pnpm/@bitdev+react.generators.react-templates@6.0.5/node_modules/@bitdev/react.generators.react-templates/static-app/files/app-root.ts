import { ComponentContext } from '@teambit/generator';

export const AppRootFile = (context: ComponentContext) => {
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
