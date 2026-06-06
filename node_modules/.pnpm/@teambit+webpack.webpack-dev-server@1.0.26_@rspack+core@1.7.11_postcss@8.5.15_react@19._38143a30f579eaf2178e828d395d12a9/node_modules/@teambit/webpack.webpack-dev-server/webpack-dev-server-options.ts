import { DevServerContext } from '@teambit/bundler';
import { WebpackConfigTransformer } from '@teambit/webpack';

export type WebpackDevServerOptions = {
  /**
   * path to load the webpack instance from
   */
  webpackModulePath?: string;

  /**
   * path to load the webpack dev server instance from.
   */
  webpackDevServerModulePath?: string;

  /**
   * name of the dev server.
   */
  name?: string;

  /**
   * context of the dev server execution.
   */
  devServerContext: DevServerContext;

  /**
   * array of transformers to apply on webpack config.
   */
  transformers?: WebpackConfigTransformer[];
};
