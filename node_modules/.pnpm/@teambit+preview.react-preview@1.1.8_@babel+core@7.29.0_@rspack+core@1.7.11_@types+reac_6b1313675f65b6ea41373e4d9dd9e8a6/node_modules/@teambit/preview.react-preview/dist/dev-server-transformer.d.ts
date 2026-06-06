import type { WebpackConfigTransformer } from '@teambit/webpack';
import { Workspace } from '@teambit/workspace';
import { DevServerContext } from '@teambit/bundler';
export declare function createDevServerTransformers(context: DevServerContext, workspace: Workspace): WebpackConfigTransformer;
