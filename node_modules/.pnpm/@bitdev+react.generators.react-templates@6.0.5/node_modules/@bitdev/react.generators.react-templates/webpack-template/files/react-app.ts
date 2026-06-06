import { ComponentContext } from '@teambit/generator';

export const reactAppFile = (context: ComponentContext) => {
  const { name } = context;

  return {
    relativePath: `${name}.bit-app.js`,
    content: `import { ReactSsr } from '@bitdev/react.app-types.react-ssr';

export default ReactSsr.from({
  /**
   * name of the app.
   */
  name: "${name}",

  /**
   * name of the artifact, as persisted on the 
   * bit component.
   */
  // artifactName: 'react-ssr-build',

  /**
   * webpack configuration transformers.
   */
  // transformers: [
  //   function (config, context) {
  //     config.addPlugin(
  //       new webpack.DefinePlugin({
  //         'NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  //     }));

  //     return config;
  //   }
  // ],

  /**
   * default port range.
   */
  // defaultPort: [3000, 3200],

  /**
   * root the client side entry.
   */
  clientRoot: "./${name}.app-root",

  /**
   * root for the server side entry.
   */
  serverRoot: './server.app-root',
});
`,
  };
};
