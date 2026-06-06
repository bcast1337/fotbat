import {
  ComponentContext,
  ComponentFile,
  ComponentTemplate,
} from '@teambit/generator';
import { indexFile } from './files/index-file';
import { AppFile } from './files/app';
import { reactAppFile } from './files/react-app';
import { compositionFile } from './files/composition';
import { AppRootFile } from './files/app-root';
import { serverRootFile } from './files/server-root';
import { indexHtml } from './files/index-html';
import { appDocsFile } from './files/docs';

// TODO: replace this with "import {ComponentTemplateOptions} from '@teambit/generator';" once v1.3 is released
export type ReactAppTemplateOptions = Partial<
  Pick<ComponentTemplate, 'name' | 'description' | 'hidden' | 'env'>
>;

export class ReactWebpackTemplate implements ComponentTemplate {
  constructor(
    readonly name = 'react-cjs-app',
    readonly description = 'create a webpack-based React app with SSR for CJS support',
    readonly hidden = false,
    readonly env?: string,
    readonly installMissingDependencies = true,
    readonly isApp = true
  ) {}

  generateFiles(context: ComponentContext): ComponentFile[] {
    return [
      indexFile(context),
      compositionFile(context),
      AppFile(context),
      reactAppFile(context),
      AppRootFile(context),
      serverRootFile(context),
      appDocsFile(context),
      indexHtml(),
    ];
  }

  static from(options: ReactAppTemplateOptions = {}) {
    return () =>
      new ReactWebpackTemplate(
        options.name,
        options.description,
        options.hidden,
        options.env
      );
  }
}
