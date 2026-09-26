import type { BootstrapContext } from './BootstrapContext';

export interface BootstrapStep {
  readonly name: string;
  execute(context: BootstrapContext): Promise<void>;
}
