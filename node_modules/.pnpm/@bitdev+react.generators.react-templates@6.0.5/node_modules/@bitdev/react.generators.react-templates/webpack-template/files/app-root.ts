import { ComponentContext } from '@teambit/generator';

export const AppRootFile = (context: ComponentContext) => {
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
