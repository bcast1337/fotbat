import { ComponentContext } from '@teambit/generator';

export const reactAppFile = (context: ComponentContext) => {
  const { name } = context;

  return {
    relativePath: `${name}.react-18-app.cjs`,
    content: `/** @type {import("@teambit/react.apps.react-app-types").ReactAppOptions} */
module.exports.default = {
  name: "${name}",
  entry: [require.resolve("./${name}.app-root")],
};`,
  };
};
