import React from 'react';
import type { ReactElement } from 'react';
import {
  Box,
  Button,
  ButtonIcon,
  ButtonText,
  FormControl,
  FormControlError,
  FormControlErrorText,
  HStack,
  Icon,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { CameraIcon, FormSelectField, RequiredIndicator } from '@/shared/components';
import type { DropdownOption } from '@/domain/reference-data';
import type { CapturedPhotoEvidence } from '@/domain/case';

import { CasePhotoGallery } from './case-photo-gallery';

const FILE_NAME = 'case-photo-evidence-section.tsx';

export interface CasePhotoEvidenceSectionProps {
  readonly photoTagOptions: readonly DropdownOption[];
  readonly selectedPhotoTag: string;
  readonly onSelectPhotoTag: (tag: string) => void;
  readonly onOpenCamera: () => void;
  readonly capturedPhotos: readonly CapturedPhotoEvidence[];
  readonly onDeletePhoto: (filePath: string) => void;
  /** Marks the section title with a red "*" — at least one photo has to be captured. */
  readonly isRequired?: boolean;
  /** Localization key of the "no photo yet" error, shown once Submit has been pressed. */
  readonly errorKey?: string | undefined;
  readonly isReadOnly?: boolean;
}

/** Section 7 — camera-only geotagged evidence capture (gallery upload is never offered). */
export function CasePhotoEvidenceSection({
  photoTagOptions,
  selectedPhotoTag,
  onSelectPhotoTag,
  onOpenCamera,
  capturedPhotos,
  onDeletePhoto,
  isRequired = false,
  errorKey,
  isReadOnly = false,
}: CasePhotoEvidenceSectionProps): ReactElement {
  const { t } = useTranslation();

  // File paths and photo bytes are never logged — only counts and document type codes.
  LoggerService.info(`${FILE_NAME}: CasePhotoEvidenceSection: rendering`, {
    selectedPhotoTag,
    capturedPhotoCount: capturedPhotos.length,
    photoTagOptionCount: photoTagOptions.length,
    isRequired,
    isValid: !errorKey,
    isReadOnly,
  });

  // Each captured photo is tagged with the document type it was captured
  // for — only show the thumbnails for whichever tag is currently selected.
  const photosForSelectedTag = capturedPhotos.filter((photo) => {
    const matchesSelectedTag = photo.documentTypeCode === selectedPhotoTag;
    LoggerService.info(`${FILE_NAME}: CasePhotoEvidenceSection: filtering captured photo by tag`, {
      documentTypeCode: photo.documentTypeCode,
      matchesSelectedTag,
    });
    return matchesSelectedTag;
  });

  LoggerService.info(`${FILE_NAME}: CasePhotoEvidenceSection: resolved photos for selected tag`, {
    selectedPhotoTag,
    matchingPhotoCount: photosForSelectedTag.length,
  });

  const handleSelectPhotoTag = (tag: string): void => {
    LoggerService.info(`${FILE_NAME}: CasePhotoEvidenceSection.handleSelectPhotoTag: photo tag selected`, {
      tag,
    });
    onSelectPhotoTag(tag);
  };

  const handleDeletePhoto = (filePath: string): void => {
    // Deliberately logs no path — evidence file locations stay out of the log.
    LoggerService.warn(`${FILE_NAME}: CasePhotoEvidenceSection.handleDeletePhoto: delete requested`, {
      selectedPhotoTag,
      matchingPhotoCount: photosForSelectedTag.length,
    });
    onDeletePhoto(filePath);
  };

  const handleOpenCamera = (): void => {
    LoggerService.info(`${FILE_NAME}: CasePhotoEvidenceSection.handleOpenCamera: camera button pressed`);
    onOpenCamera();
  };

  const cameraButtonLabel = t(
    photosForSelectedTag.length > 0 ? 'caseDetails.photo.addAnother' : 'caseDetails.photo.openCamera',
  );
  // The title's red "*" is hidden from screen readers, so the camera button says "required".
  const cameraButtonAccessibilityLabel = isRequired
    ? t('validation.requiredFieldLabel', { label: cameraButtonLabel })
    : cameraButtonLabel;

  if (photosForSelectedTag.length > 0) {
    LoggerService.info(`${FILE_NAME}: CasePhotoEvidenceSection: rendering gallery branch`, {
      matchingPhotoCount: photosForSelectedTag.length,
    });
  } else {
    LoggerService.info(
      `${FILE_NAME}: CasePhotoEvidenceSection: rendering empty branch — no photos for selected tag`,
    );
  }

  return (
    <Box
      bg="$backgroundLight0"
      borderWidth="$1"
      borderColor="$borderLight200"
      borderRadius="$2xl"
      p="$4"
      sx={{ _dark: { bg: '$backgroundDark900', borderColor: '$borderDark700' } }}
    >
      <VStack space="sm">
        <HStack space="xs" alignItems="center">
          <Icon as={CameraIcon} size="sm" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }} />
          {/* A sibling, not nested: nested Text merges into one screen-reader string. */}
          <HStack alignItems="center">
            <Text size="xs" fontWeight="$bold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
              {t('caseDetails.photo.title')}
            </Text>
            {isRequired ? <RequiredIndicator size="xs" /> : null}
          </HStack>
        </HStack>

        <FormSelectField
          fieldId="case-details-photo-tag"
          label={t('caseDetails.photo.tagLabel')}
          value={selectedPhotoTag}
          onValueChange={handleSelectPhotoTag}
          options={photoTagOptions.map((tag) => {
            LoggerService.info(`${FILE_NAME}: CasePhotoEvidenceSection: mapping photo tag option`, {
              code: tag.code,
            });
            return { label: tag.label, value: tag.code };
          })}
          isDisabled={isReadOnly}
        />

        {photosForSelectedTag.length > 0 ? (
          <CasePhotoGallery
            photos={photosForSelectedTag}
            photoTagOptions={photoTagOptions}
            onDeletePhoto={handleDeletePhoto}
            isReadOnly={isReadOnly}
          />
        ) : null}

        <FormControl isInvalid={Boolean(errorKey)} isDisabled={isReadOnly}>
          <Button
            size="lg"
            borderRadius="$xl"
            onPress={handleOpenCamera}
            isDisabled={isReadOnly}
            accessibilityLabel={cameraButtonAccessibilityLabel}
            testID="case-details-open-camera-button"
          >
            <ButtonIcon as={CameraIcon} mr="$2" />
            <ButtonText>{cameraButtonLabel}</ButtonText>
          </Button>
          {errorKey ? (
            <FormControlError>
              <FormControlErrorText testID="case-details-photo-error">{t(errorKey)}</FormControlErrorText>
            </FormControlError>
          ) : null}
        </FormControl>
      </VStack>
    </Box>
  );
}
