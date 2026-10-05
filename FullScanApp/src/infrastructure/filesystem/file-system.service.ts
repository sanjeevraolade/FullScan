import { LoggerService } from '@/infrastructure/logger';

import { FileReadError } from './file-system.errors';
import type { IFileSystemService } from './file-system.interface';

const FILE_NAME = 'file-system.service.ts';

/** Anything already carrying a scheme (`file://`, `content://`, …) is a URI the native layer can open as-is. */
const URI_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

/** `data:<mime type>;base64,` — what both platforms' FileReader puts in front of the encoded bytes. */
const BASE64_DATA_URL_PREFIX_PATTERN = /^data:[^,]*;base64,/;

/** The native layers open files by URI; the camera hands back a plain path. Never prefixed twice. */
function toFileUri(filePath: string): string {
  const hasUriScheme = URI_SCHEME_PATTERN.test(filePath);
  // The path identifies evidence and is never logged.
  LoggerService.info(`${FILE_NAME}: toFileUri: resolving file URI`, { hasUriScheme });
  return hasUriScheme ? filePath : `file://${filePath}`;
}

/**
 * Opens the file through React Native's networking stack with a `blob`
 * response: iOS serves `file://` through `RCTFileRequestHandler` (raw
 * `NSData`, kept by `RCTBlobManager`), Android through `BlobModule`'s URI
 * handler (`ContentResolver.openInputStream`). A missing or inaccessible file
 * makes both reject the request, which `fetch` surfaces as a rejection.
 */
async function fetchFileBlob(fileUri: string): Promise<Blob> {
  LoggerService.info(`${FILE_NAME}: fetchFileBlob: opening local file`);
  let response: Response;
  try {
    response = await fetch(fileUri);
  } catch (error: unknown) {
    LoggerService.warn(`${FILE_NAME}: fetchFileBlob: local file could not be opened`, {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw new FileReadError('unreadable');
  }
  if (!response.ok) {
    LoggerService.warn(`${FILE_NAME}: fetchFileBlob: local file request not ok`, {
      status: response.status,
    });
    throw new FileReadError('unreadable');
  }
  try {
    const blob = await response.blob();
    LoggerService.info(`${FILE_NAME}: fetchFileBlob: local file opened`, { byteLength: blob.size });
    return blob;
  } catch (error: unknown) {
    LoggerService.warn(`${FILE_NAME}: fetchFileBlob: local file body could not be read`, {
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw new FileReadError('readFailed');
  }
}

/**
 * Base64-encodes the blob's bytes natively (iOS `base64EncodedStringWithOptions:0`,
 * Android `Base64.NO_WRAP`): standard alphabet, padded, no line breaks.
 */
function readBlobAsDataUrl(blob: Blob): Promise<string> {
  LoggerService.info(`${FILE_NAME}: readBlobAsDataUrl: encoding file bytes`, {
    byteLength: blob.size,
  });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const { result } = reader;
      const isString = typeof result === 'string';
      LoggerService.info(`${FILE_NAME}: readBlobAsDataUrl: reader finished`, { isString });
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      reject(new FileReadError('unexpectedResult'));
    };
    reader.onerror = () => {
      // The reader's error can echo native blob ids — only its presence is logged.
      LoggerService.warn(`${FILE_NAME}: readBlobAsDataUrl: reader failed`, {
        hasError: reader.error !== null,
      });
      reject(new FileReadError('readFailed'));
    };
    try {
      reader.readAsDataURL(blob);
    } catch (error: unknown) {
      LoggerService.warn(`${FILE_NAME}: readBlobAsDataUrl: reader refused the blob`, {
        errorName: error instanceof Error ? error.name : typeof error,
      });
      reject(new FileReadError('readFailed'));
    }
  });
}

/** The bare base64 payload; never logged, not even in part — only its length. */
function stripDataUrlPrefix(dataUrl: string): string {
  const prefix = BASE64_DATA_URL_PREFIX_PATTERN.exec(dataUrl)?.[0] ?? null;
  LoggerService.info(`${FILE_NAME}: stripDataUrlPrefix: removing data URL prefix`, {
    hasDataUrlPrefix: prefix !== null,
  });
  if (prefix === null) {
    throw new FileReadError('unexpectedResult');
  }
  return dataUrl.slice(prefix.length);
}

/**
 * React Native keeps a blob's bytes in the native blob store until `close()`
 * is called; the TypeScript `Blob` type doesn't declare it, hence the check.
 */
function releaseNativeBlob(blob: Blob): void {
  const canClose = 'close' in blob && typeof blob.close === 'function';
  LoggerService.info(`${FILE_NAME}: releaseNativeBlob: releasing file bytes`, { canClose });
  if ('close' in blob && typeof blob.close === 'function') {
    blob.close();
  }
}

async function readFileAsBase64(filePath: string): Promise<string> {
  LoggerService.info(`${FILE_NAME}: readFileAsBase64: reading local file`);
  const blob = await fetchFileBlob(toFileUri(filePath));
  try {
    const byteLength = blob.size;
    if (byteLength === 0) {
      LoggerService.warn(`${FILE_NAME}: readFileAsBase64: local file is empty`);
      throw new FileReadError('emptyFile');
    }
    const base64 = stripDataUrlPrefix(await readBlobAsDataUrl(blob));
    if (base64.length === 0) {
      LoggerService.warn(`${FILE_NAME}: readFileAsBase64: encoded content is empty`, { byteLength });
      throw new FileReadError('emptyFile');
    }
    LoggerService.info(`${FILE_NAME}: readFileAsBase64: local file read`, {
      byteLength,
      base64Length: base64.length,
    });
    return base64;
  } finally {
    releaseNativeBlob(blob);
  }
}

export const FileSystemService: IFileSystemService = {
  readFileAsBase64,
};
