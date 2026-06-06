import type { Bundler, BundlerResult, Target, BundlerContextMetaData } from '@teambit/bundler';
import type { Logger } from '@teambit/logger';
import type { Configuration } from 'webpack';
import { EnvContext } from '@teambit/envs';
import { PubsubMain } from '@teambit/pubsub';
import { WebpackBundlerOptions } from './webpack-bundler-options';
export type BundlerAppContext = {
    logger: Logger;
};
type WebpackBundlerAspectsContext = {
    logger: Logger;
    workspacePath?: string;
    pubsub?: PubsubMain;
};
export declare class WebpackBundler implements Bundler {
    /**
     * targets to bundle.
     */
    private targets;
    /**
     * webpack configuration.
     */
    private configs;
    private logger;
    private webpackModulePath;
    private metaData?;
    private readonly webpack;
    constructor(
    /**
     * targets to bundle.
     */
    targets: Target[], 
    /**
     * webpack configuration.
     */
    configs: Configuration[], logger: Logger, webpackModulePath?: string, metaData?: BundlerContextMetaData | undefined);
    run(): Promise<BundlerResult[]>;
    private getErrors;
    private getAssets;
    private getEntriesAssetsMap;
    private getCompressedSize;
    private getComponents;
    static from(options: WebpackBundlerOptions): (context: EnvContext) => WebpackBundler;
    static create(options: WebpackBundlerOptions, aspectContext: WebpackBundlerAspectsContext): WebpackBundler;
}
export {};
