import type { WebpackConfigWithDevServer } from '@teambit/webpack.webpack-dev-server';
export type ConfigEnvDevFactoryOptions = {
    envId: string;
};
export declare function configEnvDevFactory({ envId, }: ConfigEnvDevFactoryOptions): WebpackConfigWithDevServer;
