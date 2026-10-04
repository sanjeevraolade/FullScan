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
 * Jest runs on Node, whose global `FormData` is the WHATWG one: it stringifies
 * a `{ uri, name, type }` file part. React Native's own implementation is
 * what the app actually sends with, so it stands in for these tests.
 */
const ReactNativeFormData = jest.requireActual<{ default: typeof FormData }>(
  'react-native/Libraries/Network/FormData',
).default;

const PHOTO: CapturedPhotoEvidence = {
  filePath: '/data/user/0/com.fullscan/cache/ReactNative-snapshot-image123.jpg',
  latitude: 17.4935,
  longitude: 78.3129,
  accuracyMeters: 8.5,
  isMockLocation: false,
  capturedAt: new Date('2026-10-04T09:15:02.123Z'),
  documentTypeCode: 'house_photo_1',
};

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
  readonly formData: FormData;
  readonly config: unknown;
}

function readSentRequest(): SentUploadRequest {
  const call = jest.mocked(apiClient.post).mock.calls[0];
  if (!call) {
    throw new Error('apiClient.post was not called');
  }
  const [url, body, config] = call;
  if (!(body instanceof ReactNativeFormData)) {
    throw new Error('the request body is not a React Native FormData');
  }
  return { url, formData: body, config };
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
  let originalFormDataDescriptor: PropertyDescriptor | undefined;

  beforeAll(() => {
    originalFormDataDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'FormData');
    Object.defineProperty(globalThis, 'FormData', {
      value: ReactNativeFormData,
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    if (originalFormDataDescriptor) {
      Object.defineProperty(globalThis, 'FormData', originalFormDataDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'FormData');
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('request', () => {
    it('posts multipart form data to the case evidence route with a long upload timeout', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      const { url, config } = readSentRequest();
      expect(url).toBe('/cases/case-0123-comp-1/evidence');
      expect(EVIDENCE_UPLOAD_TIMEOUT_MS).toBe(60000);
      // No hand-written boundary: React Native's networking layer adds it.
      expect(config).toEqual({
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: EVIDENCE_UPLOAD_TIMEOUT_MS,
      });
    });

    it('sends exactly the contract parts — six text parts, then the file', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      const { formData } = readSentRequest();
      const fieldNames = formData
        .getParts()
        .map((part) => part.headers['content-disposition']?.match(/name="([^"]+)"/)?.[1]);
      expect(fieldNames).toEqual([
        'documentTypeCode',
        'latitude',
        'longitude',
        'accuracyMeters',
        'capturedAt',
        'isMockLocation',
        'file',
      ]);
    });

    it('serializes the capture metadata as strings', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      const { formData } = readSentRequest();
      expect(formData.getAll('documentTypeCode')).toEqual(['house_photo_1']);
      expect(formData.getAll('latitude')).toEqual(['17.4935']);
      expect(formData.getAll('longitude')).toEqual(['78.3129']);
      expect(formData.getAll('accuracyMeters')).toEqual(['8.5']);
      expect(formData.getAll('capturedAt')).toEqual(['2026-10-04T09:15:02.123Z']);
      expect(formData.getAll('isMockLocation')).toEqual(['false']);
    });

    it('sends a mocked location as the string "true"', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', { ...PHOTO, isMockLocation: true });

      expect(readSentRequest().formData.getAll('isMockLocation')).toEqual(['true']);
    });

    it('attaches the photo as a file:// JPEG named after its tag and capture time', async () => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      expect(readSentRequest().formData.getAll('file')).toEqual([
        {
          uri: 'file:///data/user/0/com.fullscan/cache/ReactNative-snapshot-image123.jpg',
          name: 'house_photo_1-1791105302123.jpg',
          type: 'image/jpeg',
        },
      ]);
    });

    it.each([
      ['file://', 'file:///data/user/0/com.fullscan/cache/photo.jpg'],
      ['content://', 'content://com.fullscan.provider/cache/photo.jpg'],
    ])('leaves a path that is already a %s URI untouched', async (_scheme, filePath) => {
      mockUploadResponse(201);

      await uploadCaseEvidence('case-0123-comp-1', { ...PHOTO, filePath });

      const [filePart] = readSentRequest().formData.getAll('file');
      expect(filePart).toEqual(expect.objectContaining({ uri: filePath }));
    });

    it.each([
      ['a non-finite latitude', { latitude: Number.NaN }],
      ['a non-finite accuracy', { accuracyMeters: Number.POSITIVE_INFINITY }],
      ['an invalid capture time', { capturedAt: new Date('not a date') }],
      ['an empty file path', { filePath: '' }],
    ])('refuses to send a photo with %s', async (_label, overrides) => {
      const error = await captureUploadFailure({ ...PHOTO, ...overrides });

      expect(error).toBeInstanceOf(CaseEvidenceUploadError);
      expect(error).toMatchObject({ reason: 'invalidPhoto', status: null });
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
      ['being offline (or an unreadable local file)', 'ERR_NETWORK', 'network'],
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

    beforeEach(() => {
      jest.spyOn(LoggerService, 'info');
      jest.spyOn(LoggerService, 'warn');
      jest.spyOn(LoggerService, 'error');
    });

    it('never logs the file path or coordinates on success', async () => {
      mockUploadResponse(201, buildEvidenceDto({ isMockLocation: true }));

      await uploadCaseEvidence('case-0123-comp-1', PHOTO);

      const loggedText = collectLoggedText();
      expect(loggedText).toContain('3f1c9a52-6a0e-4a8e-9d55-0c3a3a5f2b11');
      expect(loggedText).not.toContain('ReactNative-snapshot-image123');
      expect(loggedText).not.toContain('17.4935');
      expect(loggedText).not.toContain('78.3129');
    });

    it('never logs the file path or coordinates on failure', async () => {
      jest
        .mocked(apiClient.post)
        .mockRejectedValue({ isAxiosError: true, response: { status: 500 } });

      await captureUploadFailure();

      const loggedText = collectLoggedText();
      expect(loggedText).toContain('500');
      expect(loggedText).not.toContain('ReactNative-snapshot-image123');
      expect(loggedText).not.toContain('17.4935');
      expect(loggedText).not.toContain('78.3129');
    });
  });
});
