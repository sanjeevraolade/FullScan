/**
 * Test doubles for the React Native globals `FileSystemService` reads local
 * files through — `fetch('file://…')` and `FileReader`. Jest runs on Node,
 * which has a `fetch` that can't open `file://` and no `FileReader` at all, so
 * these stand in with the behaviour the RN native modules have on device:
 * a missing file rejects the fetch; the reader yields a `data:…;base64,` URL.
 */

export interface FakeNativeBlob {
  readonly size: number;
  readonly type: string;
  /** React Native's (untyped) release of the native blob store entry. */
  readonly close: jest.Mock<void, []>;
}

export type FakeFileReaderOutcome =
  | { readonly kind: 'load'; readonly result: unknown }
  | { readonly kind: 'error' }
  | { readonly kind: 'throw' };

export interface NativeFileReadingStubs {
  readonly fetch: jest.Mock<Promise<unknown>, [string]>;
  /** Every blob handed to `FileReader.readAsDataURL`, in order. */
  readonly readBlobs: unknown[];
  /**
   * The next `fetch` resolves with this file, and the reader then behaves as
   * `outcome` says. A blob without `close` stands in for a non-RN `Blob`.
   */
  serveFile(blob: Pick<FakeNativeBlob, 'size' | 'type'>, outcome: FakeFileReaderOutcome): void;
  /** The next `fetch` rejects, as RN's networking does for a missing `file://` path. */
  serveMissingFile(): void;
  restore(): void;
}

export function buildFakeNativeBlob(size = 24, type = 'image/jpeg'): FakeNativeBlob {
  return { size, type, close: jest.fn<void, []>() };
}

function replaceGlobal(name: string, value: unknown): () => void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  return () => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, name, originalDescriptor);
      return;
    }
    Reflect.deleteProperty(globalThis, name);
  };
}

export function installNativeFileReadingStubs(): NativeFileReadingStubs {
  const fetchMock = jest.fn<Promise<unknown>, [string]>();
  const readBlobs: unknown[] = [];
  let readerOutcome: FakeFileReaderOutcome = { kind: 'error' };

  class StubFileReader {
    result: unknown = null;
    error: Error | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    readAsDataURL(blob: unknown): void {
      readBlobs.push(blob);
      const outcome = readerOutcome;
      if (outcome.kind === 'throw') {
        throw new TypeError("Failed to execute 'readAsDataURL' on 'FileReader'");
      }
      // Native reads resolve asynchronously, as on device.
      setTimeout(() => {
        if (outcome.kind === 'load') {
          this.result = outcome.result;
          this.onload?.();
          return;
        }
        this.error = new Error('ERROR_INVALID_BLOB');
        this.onerror?.();
      }, 0);
    }
  }

  const restoreFetch = replaceGlobal('fetch', fetchMock);
  const restoreFileReader = replaceGlobal('FileReader', StubFileReader);

  return {
    fetch: fetchMock,
    readBlobs,
    serveFile: (blob, outcome) => {
      readerOutcome = outcome;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(blob),
      });
    },
    serveMissingFile: () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    },
    restore: () => {
      restoreFetch();
      restoreFileReader();
    },
  };
}
