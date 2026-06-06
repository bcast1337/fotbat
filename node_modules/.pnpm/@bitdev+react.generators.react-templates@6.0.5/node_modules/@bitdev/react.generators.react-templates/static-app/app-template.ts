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
import { appDocsFile } from '../app-template/files/docs';

// TODO: replace this with "import {ComponentTemplateOptions} from '@teambit/generator';" once v1.3 is released
export type ReactAppTemplateOptions = Partial<
  Pick<ComponentTemplate, 'name' | 'description' | 'hidden' | 'env'>
>;

export class ReactWebpackAppTemplate implements ComponentTemplate {
  constructor(
    readonly name = 'react-webpack-app',
    readonly description = 'create a webpack-based static React app template',
    readonly hidden = false,
    readonly env?: string,
    readonly isApp = true,
  ) {}

  generateFiles(context: ComponentContext): ComponentFile[] {
    return [
      indexFile(context),
      compositionFile(context),
      AppFile(context),
      reactAppFile(context),
      appDocsFile(context),
      AppRootFile(context),
    ];
  }

  static from(options: ReactAppTemplateOptions = {}) {
    return () =>
      new ReactWebpackAppTemplate(
        options.name,
        options.description,
        options.hidden,
        options.env
      );
  }
}
