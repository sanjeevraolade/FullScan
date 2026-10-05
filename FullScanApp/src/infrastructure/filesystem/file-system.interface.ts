/**
 * The app's only door to reading local files. There is no file-system native
 * module in the app; this reads through React Native's built-in networking +
 * blob modules, so nothing above `src/infrastructure` touches `fetch`/`Blob`/
 * `FileReader` for file access, and it can be mocked wholesale in tests.
 */
export interface IFileSystemService {
  /**
   * The file's raw bytes as standard base64 (RFC 4648 §4, padded, no line
   * breaks, no `data:` prefix). The bytes are encoded exactly as stored —
   * never decoded or re-encoded as an image — so evidence stays byte-identical.
   *
   * Accepts a plain filesystem path or a `file://` URI. Rejects with a
   * `FileReadError` only.
   */
  readFileAsBase64(filePath: string): Promise<string>;
}
