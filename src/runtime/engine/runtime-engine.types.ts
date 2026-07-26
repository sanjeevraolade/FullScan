import type { ILocalizationEngine } from '@/localization';
import type { IConfigurationEngine } from '@/runtime/configuration';
import type { IWidgetRegistryEngine } from '@/runtime/registry';
import type { IThemeEngine } from '@/theme';

/**
 * Constructor-injected dependencies, all optional — defaults are the real
 * engines. Lets tests substitute fakes without hidden module-level coupling.
 */
export interface VerificationRuntimeEngineDependencies {
  readonly configurationEngine?: IConfigurationEngine;
  readonly widgetRegistry?: IWidgetRegistryEngine;
  readonly themeEngine?: IThemeEngine;
  readonly localizationEngine?: ILocalizationEngine;
}
