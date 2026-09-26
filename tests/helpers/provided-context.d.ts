/** Values the global setup hands to every suite through `inject()`. */
declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

export {};
