import { ComponentContext } from '@teambit/generator';

export const AppFile = (context: ComponentContext) => {
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
