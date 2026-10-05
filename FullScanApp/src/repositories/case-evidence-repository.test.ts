import { FileReadError, FileSystemService } from '@/infrastructure/filesystem';
import { LoggerService } from '@/infrastructure/logger';
import { apiClient } from '@/infrastructure/networking';
import type { CapturedPhotoEvidence } from '@/domain/case';

import { EVIDENCE_UPLOAD_TIMEOUT_MS, uploadCaseEvidence } from './case-evidence-repository';
import { CaseEvidenceUploadError } from './case-evidence-repository.errors';
import type { CaseEvidenceUploadFailureReason } from './case-evidence-repository.errors';

jest.mock('@/infrastructure/networking', () => ({
  apiClient: { post: jest.fn() },
}));

/*
 * The reader itself (fetch + FileReader on device) is covered by
 * file-system.service.test.ts; here it only hands back a photo's base64.
 */
jest.mock('@/infrastructure/filesystem', () => ({
  ...jest.requireActual<object>('@/infrastructure/filesystem'),
  FileSystemService: { readFileAsBase64: jest.fn() },
}));

const PHOTO: CapturedPhotoEvidence = {
  filePath: '/data/user/0/com.fullscan/cache/ReactNative-snapshot-image123.jpg',
  latitude: 17.4935,
  longitude: 78.3129,
  accuracyMeters: 8.5,
  isMockLocation: false,
  capturedAt: new Date('2026-10-04T09:15:02.123Z'),
  documentTypeCode: 'house_photo_1',
};

/** Standard, padded base64 of a tiny JPEG-looking payload. */
const PHOTO_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4n/9k=';

/** The contract's example response record. */
function buildEvidenceDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '3f1c9a52-6a0e-4a8e-9d55-0c3a3a5f2b11',
    componentId: 'case-0123-comp-1',
    source: 'mobile_capture',
    fileName: 'house_photo_1-1791105302123.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 482113,
    sha256: '9b0fe41a',
    documentTypeCode: 'house_photo_1',
    latitude: 17.4935,
    longitude: 78.3129,
    accuracyMeters: 8.5,
    isMockLocation: false,
    capturedAt: '2026-10-04 09:15:02',
    uploadedAt: '2026-10-04 09:20:11',
    ...overrides,
  };
}

function mockUploadResponse(status: number, data: unknown = buildEvidenceDto()): void {
  jest.mocked(apiClient.post).mockResolvedValue({ status, data: { success: true, data } });
}

interface SentUploadRequest {
  readonly url: string;
  readonly body: unknown;
  readonly config: unknown;
}

function readSentRequest(): SentUploadRequest {
  const call = jest.mocked(apiClient.post).mock.calls[0];
  if (!call) {
    throw new Error('apiClient.post was not called');
  }
  const [url, body, config] = call;
  return { url, body, config };
}

async function captureUploadFailure(photo: CapturedPhotoEvidence = PHOTO): Promise<unknown> {
  try {
    await uploadCaseEvidence('case-0123-comp-1', photo);
  } catch (error: unknown) {
    return error;
  }
  throw new Error('uploadCaseEvidence resolved but was expected to reject');
}

describe('uploadCaseEvidence', () => {
  beforeEach(() => {
    jest.mocked(FileSystemService.readFileAsBase64).mockResolvedValue(PHOTO_BASE64);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('request', () => {
    it('posts JSON to the case evidence route with a long upload timeout', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      const { url, config } = readSentRequest();
      expect(url).toBe('/cases/case-0123-comp-1/evidence');
      expect(EVIDENCE_UPLOAD_TIMEOUT_MS).toBe(60000);
      expect(config).toEqual({
        headers: { 'Content-Type': 'application/json' },
        timeout: EVIDENCE_UPLOAD_TIMEOUT_MS,
      });
    });

    it('sends exactly the contract fields, numbers and booleans as JSON types', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      // Strict: the server schema rejects any extra field, even an undefined one.
      expect(readSentRequest().body).toStrictEqual({
        documentTypeCode: 'house_photo_1',
        latitude: 17.4935,
        longitude: 78.3129,
        accuracyMeters: 8.5,
        capturedAt: '2026-10-04T09:15:02.123Z',
        isMockLocation: false,
        fileName: 'house_photo_1-1791105302123.jpg',
        contentBase64: PHOTO_BASE64,
      });
    });

    it('sends a mocked location as JSON true', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', { ...PHOTO, isMockLocation: true });

      expect(readSentRequest().body).toEqual(expect.objectContaining({ isMockLocation: true }));
    });

    it('reads the content from the photo’s own local file', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      expect(FileSystemService.readFileAsBase64).toHaveBeenCalledTimes(1);
      expect(FileSystemService.readFileAsBase64).toHaveBeenCalledWith(PHOTO.filePath);
    });

    it.each([
      ['a missing file', new FileReadError('unreadable')],
      ['an empty file', new FileReadError('emptyFile')],
      ['an unexpected reader failure', new Error('native module unavailable')],
    ])('fails with fileUnreadable and sends nothing for %s', async (_label, readError) => {
      jest.mocked(FileSystemService.readFileAsBase64).mockRejectedValue(readError);

      const error = await captureUploadFailure();

      expect(error).toBeInstanceOf(CaseEvidenceUploadError);
      expect(error).toMatchObject({ reason: 'fileUnreadable', status: null });
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it.each([
      ['a non-finite latitude', { latitude: Number.NaN }],
      ['a non-finite accuracy', { accuracyMeters: Number.POSITIVE_INFINITY }],
      ['an invalid capture time', { capturedAt: new Date('not a date') }],
      ['an empty file path', { filePath: '' }],
    ])('refuses a photo with %s before reading or sending it', async (_label, overrides) => {
      const error = await captureUploadFailure({ ...PHOTO, ...overrides });

      expect(error).toBeInstanceOf(CaseEvidenceUploadError);
      expect(error).toMatchObject({ reason: 'invalidPhoto', status: null });
      expect(FileSystemService.readFileAsBase64).not.toHaveBeenCalled();
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('response mapping', () => {
    it('maps a 201 to the stored evidence record', async () => {
      mockUploadResponse(201);

      const evidence = await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      expect(evidence).toEqual({
        id: '3f1c9a52-6a0e-4a8e-9d55-0c3a3a5f2b11',
        caseId: 'case-0123-comp-1',
        fileName: 'house_photo_1-1791105302123.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 482113,
        sha256: '9b0fe41a',
        documentTypeCode: 'house_photo_1',
        latitude: 17.4935,
        longitude: 78.3129,
        accuracyMeters: 8.5,
        isMockLocation: false,
        // The server's `YYYY-MM-DD HH:MM:SS` is UTC, not device-local time.
        capturedAt: new Date('2026-10-04T09:15:02.000Z'),
        uploadedAt: new Date('2026-10-04T09:20:11.000Z'),
        wasAlreadyUploaded: false,
      });
    });

    it('treats a 200 as success too — the server already held these bytes', async () => {
      mockUploadResponse(200);

      const evidence = await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      expect(evidence.id).toBe('3f1c9a52-6a0e-4a8e-9d55-0c3a3a5f2b11');
      expect(evidence.wasAlreadyUploaded).toBe(true);
    });

    it('accepts ISO timestamps as well as the server format', async () => {
      mockUploadResponse(201, buildEvidenceDto({ uploadedAt: '2026-10-04T09:20:11.000Z' }));

      const evidence = await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      expect(evidence.uploadedAt).toEqual(new Date('2026-10-04T09:20:11.000Z'));
    });

    it('still succeeds when a timestamp is unparseable — the upload itself was accepted', async () => {
      mockUploadResponse(201, buildEvidenceDto({ uploadedAt: 'yesterday' }));

      const evidence = await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      expect(evidence.id).toBe('3f1c9a52-6a0e-4a8e-9d55-0c3a3a5f2b11');
      expect(Number.isNaN(evidence.uploadedAt.getTime())).toBe(true);
    });

    it.each([
      ['no data', null],
      ['no id', buildEvidenceDto({ id: undefined })],
      ['an empty id', buildEvidenceDto({ id: '' })],
    ])('rejects a success response with %s as an invalid response', async (_label, data) => {
      mockUploadResponse(201, data);

      const error = await captureUploadFailure();

      expect(error).toMatchObject({ reason: 'invalidResponse', status: 201 });
    });

    it('rejects an unexpected 2xx status as an invalid response', async () => {
      mockUploadResponse(204);

      const error = await captureUploadFailure();

      expect(error).toMatchObject({ reason: 'invalidResponse', status: 204 });
    });
  });

  describe('failures', () => {
    it('maps a 409 to caseClosed', async () => {
      jest.mocked(apiClient.post).mockRejectedValue({
        isAxiosError: true,
        response: { status: 409 },
        message: 'Request failed with status code 409',
      });

      const error = await captureUploadFailure();

      expect(error).toBeInstanceOf(CaseEvidenceUploadError);
      expect(error).toMatchObject({ reason: 'caseClosed', status: 409 });
    });

    it.each([400, 401, 404, 413, 415, 500, 503])(
      'maps a %i to rejected, not caseClosed',
      async (status) => {
        jest.mocked(apiClient.post).mockRejectedValue({ isAxiosError: true, response: { status } });

        const error = await captureUploadFailure();

        expect(error).toBeInstanceOf(CaseEvidenceUploadError);
        expect(error).toMatchObject({ reason: 'rejected', status });
      },
    );

    it.each<[string, string | undefined, CaseEvidenceUploadFailureReason]>([
      ['the axios timeout', 'ECONNABORTED', 'timeout'],
      ['a socket timeout', 'ETIMEDOUT', 'timeout'],
      ['being offline', 'ERR_NETWORK', 'network'],
      ['no error code at all', undefined, 'network'],
    ])('maps no response because of %s', async (_label, code, reason) => {
      jest
        .mocked(apiClient.post)
        .mockRejectedValue({ isAxiosError: true, response: undefined, code });

      const error = await captureUploadFailure();

      expect(error).toMatchObject({ reason, status: null });
    });

    it('maps a failure outside HTTP to unexpected', async () => {
      jest.mocked(apiClient.post).mockRejectedValue(new Error('keychain unavailable'));

      const error = await captureUploadFailure();

      expect(error).toMatchObject({ reason: 'unexpected', status: null });
    });
  });

  describe('logging', () => {
    function collectLoggedText(): string {
      const calls = [
        ...jest.mocked(LoggerService.info).mock.calls,
        ...jest.mocked(LoggerService.warn).mock.calls,
        ...jest.mocked(LoggerService.error).mock.calls,
      ];
      return JSON.stringify(calls);
    }

    function expectNoEvidenceContentLogged(loggedText: string): void {
      expect(loggedText).not.toContain('ReactNative-snapshot-image123');
      expect(loggedText).not.toContain('17.4935');
      expect(loggedText).not.toContain('78.3129');
      // Not the base64, nor any recognisable slice of it.
      expect(loggedText).not.toContain(PHOTO_BASE64);
      expect(loggedText).not.toContain(PHOTO_BASE64.slice(0, 12));
      expect(loggedText).not.toContain(PHOTO_BASE64.slice(-12));
    }

    beforeEach(() => {
      jest.spyOn(LoggerService, 'info');
      jest.spyOn(LoggerService, 'warn');
      jest.spyOn(LoggerService, 'error');
    });

    it('never logs the file path, coordinates or content on success, only the base64 length', async () => {
      mockUploadResponse(201, buildEvidenceDto({ isMockLocation: true }));

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      const loggedText = collectLoggedText();
      expect(loggedText).toContain('3f1c9a52-6a0e-4a8e-9d55-0c3a3a5f2b11');
      expect(loggedText).toContain(`"base64Length":${PHOTO_BASE64.length}`);
      expectNoEvidenceContentLogged(loggedText);
    });

    it('never logs the file path, coordinates or content when the server fails', async () => {
      jest
        .mocked(apiClient.post)
        .mockRejectedValue({ isAxiosError: true, response: { status: 500 } });

      await captureUploadFailure();

      const loggedText = collectLoggedText();
      expect(loggedText).toContain('500');
      expectNoEvidenceContentLogged(loggedText);
    });

    it('never logs the file path when the local file is unreadable', async () => {
      jest
        .mocked(FileSystemService.readFileAsBase64)
        .mockRejectedValue(new FileReadError('unreadable'));

      await captureUploadFailure();

      const loggedText = collectLoggedText();
      expect(loggedText).toContain('unreadable');
      expectNoEvidenceContentLogged(loggedText);
    });
  });
});
