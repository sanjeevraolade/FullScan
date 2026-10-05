import { LoggerService } from '@/infrastructure/logger';
import {
  buildFakeNativeBlob,
  installNativeFileReadingStubs,
} from '@/tests/helpers/native-file-reading.stubs';
import type { NativeFileReadingStubs } from '@/tests/helpers/native-file-reading.stubs';

import { FileReadError } from './file-system.errors';
import type { FileReadFailureReason } from './file-system.types';
import { FileSystemService } from './file-system.service';

const PHOTO_PATH = '/data/user/0/com.fullscan/cache/ReactNative-snapshot-image123.jpg';
/** The first bytes of a JPEG (FF D8 FF E0 …), base64-encoded. */
const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/';

async function captureReadFailure(filePath: string = PHOTO_PATH): Promise<unknown> {
  try {
    await FileSystemService.readFileAsBase64(filePath);
  } catch (error: unknown) {
    return error;
  }
  throw new Error('readFileAsBase64 resolved but was expected to reject');
}

function expectReadFailure(error: unknown, reason: FileReadFailureReason): void {
  expect(error).toBeInstanceOf(FileReadError);
  expect(error).toMatchObject({ reason });
}

describe('FileSystemService.readFileAsBase64', () => {
  let stubs: NativeFileReadingStubs;

  beforeEach(() => {
    stubs = installNativeFileReadingStubs();
  });

  afterEach(() => {
    stubs.restore();
    jest.restoreAllMocks();
  });

  describe('success', () => {
    it('opens a plain path as a file:// URI and returns the bare base64', async () => {
      const blob = buildFakeNativeBlob();
      stubs.serveFile(blob, { kind: 'load', result: `data:image/jpeg;base64,${JPEG_BASE64}` });

      const base64 = await FileSystemService.readFileAsBase64(PHOTO_PATH);

      expect(stubs.fetch).toHaveBeenCalledWith(`file://${PHOTO_PATH}`);
      expect(base64).toBe(JPEG_BASE64);
      expect(stubs.readBlobs).toEqual([blob]);
    });

    it('leaves a path that is already a file:// URI untouched', async () => {
      stubs.serveFile(buildFakeNativeBlob(), {
        kind: 'load',
        result: `data:image/jpeg;base64,${JPEG_BASE64}`,
      });

      await FileSystemService.readFileAsBase64(`file://${PHOTO_PATH}`);

      expect(stubs.fetch).toHaveBeenCalledWith(`file://${PHOTO_PATH}`);
    });

    it('strips the prefix whatever MIME type the platform reports', async () => {
      // Android falls back to application/octet-stream when it can't map the extension.
      stubs.serveFile(buildFakeNativeBlob(), {
        kind: 'load',
        result: `data:application/octet-stream;base64,${JPEG_BASE64}`,
      });

      await expect(FileSystemService.readFileAsBase64(PHOTO_PATH)).resolves.toBe(JPEG_BASE64);
    });

    it('releases the native blob once the bytes are encoded', async () => {
      const blob = buildFakeNativeBlob();
      stubs.serveFile(blob, { kind: 'load', result: `data:image/jpeg;base64,${JPEG_BASE64}` });

      await FileSystemService.readFileAsBase64(PHOTO_PATH);

      expect(blob.close).toHaveBeenCalledTimes(1);
    });

    it('copes with a blob that has no close()', async () => {
      stubs.serveFile(
        { size: 24, type: 'image/jpeg' },
        { kind: 'load', result: `data:image/jpeg;base64,${JPEG_BASE64}` },
      );

      await expect(FileSystemService.readFileAsBase64(PHOTO_PATH)).resolves.toBe(JPEG_BASE64);
    });
  });

  describe('missing or unreadable file', () => {
    it('reports a file the platform cannot open (e.g. purged temp file) as unreadable', async () => {
      stubs.serveMissingFile();

      const error = await captureReadFailure();

      expectReadFailure(error, 'unreadable');
      expect(stubs.readBlobs).toEqual([]);
    });

    it('reports a non-ok file response as unreadable', async () => {
      stubs.fetch.mockResolvedValueOnce({ ok: false, status: 404, blob: jest.fn() });

      expectReadFailure(await captureReadFailure(), 'unreadable');
    });

    it('reports a body that cannot be read as a blob as readFailed', async () => {
      stubs.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: () => Promise.reject(new Error('blob unsupported')),
      });

      expectReadFailure(await captureReadFailure(), 'readFailed');
    });

    it('reports an empty file without encoding it, and still releases the blob', async () => {
      const blob = buildFakeNativeBlob(0);
      stubs.serveFile(blob, { kind: 'load', result: 'data:image/jpeg;base64,' });

      expectReadFailure(await captureReadFailure(), 'emptyFile');
      expect(stubs.readBlobs).toEqual([]);
      expect(blob.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('read errors', () => {
    it('reports a FileReader error as readFailed and releases the blob', async () => {
      const blob = buildFakeNativeBlob();
      stubs.serveFile(blob, { kind: 'error' });

      expectReadFailure(await captureReadFailure(), 'readFailed');
      expect(blob.close).toHaveBeenCalledTimes(1);
    });

    it('reports a reader that refuses the blob as readFailed', async () => {
      stubs.serveFile(buildFakeNativeBlob(), { kind: 'throw' });

      expectReadFailure(await captureReadFailure(), 'readFailed');
    });

    it('reports a non-string reader result as unexpectedResult', async () => {
      stubs.serveFile(buildFakeNativeBlob(), { kind: 'load', result: new ArrayBuffer(8) });

      expectReadFailure(await captureReadFailure(), 'unexpectedResult');
    });

    it('reports a result that is not a base64 data URL as unexpectedResult', async () => {
      stubs.serveFile(buildFakeNativeBlob(), { kind: 'load', result: JPEG_BASE64 });

      expectReadFailure(await captureReadFailure(), 'unexpectedResult');
    });

    it('reports a data URL with no content as emptyFile', async () => {
      stubs.serveFile(buildFakeNativeBlob(), { kind: 'load', result: 'data:image/jpeg;base64,' });

      expectReadFailure(await captureReadFailure(), 'emptyFile');
    });
  });

  describe('logging', () => {
    function collectLoggedText(): string {
      return JSON.stringify([
        ...jest.mocked(LoggerService.info).mock.calls,
        ...jest.mocked(LoggerService.warn).mock.calls,
        ...jest.mocked(LoggerService.error).mock.calls,
      ]);
    }

    beforeEach(() => {
      jest.spyOn(LoggerService, 'info');
      jest.spyOn(LoggerService, 'warn');
      jest.spyOn(LoggerService, 'error');
    });

    it('logs the base64 length but never the content, any slice of it, or the path', async () => {
      stubs.serveFile(buildFakeNativeBlob(), {
        kind: 'load',
        result: `data:image/jpeg;base64,${JPEG_BASE64}`,
      });

      await FileSystemService.readFileAsBase64(PHOTO_PATH);

      const loggedText = collectLoggedText();
      expect(loggedText).toContain(`"base64Length":${JPEG_BASE64.length}`);
      expect(loggedText).not.toContain(JPEG_BASE64.slice(0, 8));
      expect(loggedText).not.toContain(JPEG_BASE64.slice(-12));
      expect(loggedText).not.toContain('ReactNative-snapshot-image123');
    });

    it('never logs the path when the file is missing', async () => {
      stubs.serveMissingFile();

      await captureReadFailure();

      expect(collectLoggedText()).not.toContain('ReactNative-snapshot-image123');
    });
  });
});
