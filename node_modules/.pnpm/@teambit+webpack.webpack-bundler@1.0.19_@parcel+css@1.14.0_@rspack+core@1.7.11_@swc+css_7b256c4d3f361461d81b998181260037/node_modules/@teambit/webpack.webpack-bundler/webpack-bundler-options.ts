import { BundlerContext, Target } from '@teambit/bundler';
import { WebpackConfigTransformer } from '@teambit/webpack';
import type { Configuration } from 'webpack';

export type WebpackBundlerOptions = {
  /**
   * path to load the webpack instance from
   */
  webpackModulePath?: string;

  /**
   * name of the webpack bundler.
   */
  name?: string;

  /**
   * the configuration for the webpack compiler.
   */
  config?: Configuration | any;

  /**
   * array of targets to bundle.
   */
  targets: Target[];

  /**
   * array of transformers to apply on webpack config.
   */
  transformers: WebpackConfigTransformer[];

  /**
   * bundler context
   */
  bundlerContext: BundlerContext;
};
