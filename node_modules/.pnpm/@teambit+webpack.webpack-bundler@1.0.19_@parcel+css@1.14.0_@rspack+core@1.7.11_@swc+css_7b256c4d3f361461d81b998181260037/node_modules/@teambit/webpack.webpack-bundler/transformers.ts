import { Target } from '@teambit/bundler';
import { Logger } from '@teambit/logger';
import {
  generateAddAliasesFromPeersTransformer,
  generateExternalsTransformer,
  WebpackConfigDevServerTransformContext,
  WebpackConfigDevServerTransformer,
  WebpackConfigMutator,
  WebpackConfigTransformContext,
  WebpackConfigTransformer,
} from '@teambit/webpack';

export function runTransformers(
  config: WebpackConfigMutator,
  transformers: Array<
    WebpackConfigTransformer | WebpackConfigDevServerTransformer
  > = [],
  // context: WebpackConfigTransformContext | WebpackConfigDevServerTransformContext
  context: any
): WebpackConfigMutator {
  if (!Array.isArray(transformers)) return config;
  const newConfig = transformers.reduce(
    (acc, transformer) => transformer(acc, context),
    config
  );
  return newConfig;
}

export function generateTransformers(
  logger: Logger,
  _bundlerContext?: WebpackConfigTransformContext,
  devServerContext?: WebpackConfigDevServerTransformContext,
  target?: Target
): Array<WebpackConfigTransformer> {
  const transformers: WebpackConfigTransformer[] = [];
  // TODO: handle dev server
  const hostDeps =
    target?.hostDependencies || devServerContext?.hostDependencies;
  if (hostDeps) {
    if (
      target?.aliasHostDependencies ||
      devServerContext?.aliasHostDependencies
    ) {
      const peerAliasesTransformer = generateAddAliasesFromPeersTransformer(
        hostDeps,
        logger
      );
      transformers.push(peerAliasesTransformer);
    }
    if (
      target?.externalizeHostDependencies ||
      devServerContext?.externalizeHostDependencies
    ) {
      const externalsTransformer = generateExternalsTransformer(hostDeps);
      transformers.push(externalsTransformer);
    }
  }
  return transformers;
}
