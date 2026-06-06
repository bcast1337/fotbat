import '@bitdev/react.webpack.refresh-overlay';
import { Configuration } from 'webpack';
export type ConfigComponentDevFactoryOptions = {
    envId: string;
    componentPathsRegExps: RegExp[];
};
export declare function configComponentDevFactory({ envId, componentPathsRegExps, }: ConfigComponentDevFactoryOptions): Configuration;
