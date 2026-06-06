import { PubsubMain } from '@teambit/pubsub';
import { WebpackConfigWithDevServer } from './webpack-config-with-dev-server';
export declare function configFactory(devServerID: string, workspaceDir: string, entryFiles: string[], publicRoot: string, publicPath: string, pubsub: PubsubMain, title?: string, favicon?: string): WebpackConfigWithDevServer;
