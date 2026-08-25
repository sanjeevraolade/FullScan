import { Images } from 'react-native-nitro-image';
import type { Image } from 'react-native-nitro-image';

import { LoggerService } from '@/infrastructure/logger';

const FILE_NAME = 'watermark-composer.ts';

export interface ComposeWatermarkedPhotoParams {
  /** The freshly-captured photo, already loaded as an in-memory Image. */
  readonly photo: Image;
  /** Filesystem path of a PNG snapshot of the rendered watermark overlay (see `react-native-view-shot`). */
  readonly watermarkOverlayPngPath: string;
  /** Fraction (0..1) of the photo's height the watermark bar occupies, anchored to the bottom edge. */
  readonly barHeightRatio: number;
}

/**
 * Burns the watermark overlay into the captured photo's pixels and saves the
 * result to a file. nitro-image has no text/canvas drawing API, so the
 * watermark text is rendered as an ordinary RN view and handed in here as a
 * pre-rendered PNG (via `captureRef`) to be composited with `renderInto`.
 */
export async function composeWatermarkedPhoto({
  photo,
  watermarkOverlayPngPath,
  barHeightRatio,
}: ComposeWatermarkedPhotoParams): Promise<string> {
  LoggerService.info(`${FILE_NAME}: composeWatermarkedPhoto: compositing watermark onto captured photo`);

  const overlayImage = await Images.loadFromFileAsync(watermarkOverlayPngPath);
  const barHeight = Math.round(photo.height * barHeightRatio);
  const barY = photo.height - barHeight;
  const composedImage = await photo.renderIntoAsync(overlayImage, 0, barY, photo.width, barHeight);
  const savedPath = await composedImage.saveToTemporaryFileAsync('jpg', 90);

  LoggerService.info(`${FILE_NAME}: composeWatermarkedPhoto: watermark applied`);
  return savedPath;
}
