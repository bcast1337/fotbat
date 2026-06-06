import { ComponentContext, ComponentFile, ComponentTemplate } from '@teambit/generator';
export type ReactAppTemplateOptions = Partial<Pick<ComponentTemplate, 'name' | 'description' | 'hidden' | 'env'>>;
export declare class ReactWebpackAppTemplate implements ComponentTemplate {
    readonly name: string;
    readonly description: string;
    readonly hidden: boolean;
    readonly env?: string | undefined;
    readonly isApp: boolean;
    constructor(name?: string, description?: string, hidden?: boolean, env?: string | undefined, isApp?: boolean);
    generateFiles(context: ComponentContext): ComponentFile[];
    static from(options?: ReactAppTemplateOptions): () => ReactWebpackAppTemplate;
}
