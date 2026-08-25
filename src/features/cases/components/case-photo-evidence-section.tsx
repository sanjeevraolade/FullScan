import React from 'react';
import type { ReactElement } from 'react';
import { Box, Button, ButtonIcon, ButtonText, HStack, Icon, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { CameraIcon, FormSelectField } from '@/shared/components';
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
}

/** Section 7 — camera-only geotagged evidence capture (gallery upload is never offered). */
export function CasePhotoEvidenceSection({
  photoTagOptions,
  selectedPhotoTag,
  onSelectPhotoTag,
  onOpenCamera,
  capturedPhotos,
  onDeletePhoto,
}: CasePhotoEvidenceSectionProps): ReactElement {
  const { t } = useTranslation();

  // Each captured photo is tagged with the document type it was captured
  // for — only show the thumbnails for whichever tag is currently selected.
  const photosForSelectedTag = capturedPhotos.filter((photo) => photo.documentTypeCode === selectedPhotoTag);

  const handleOpenCamera = (): void => {
    LoggerService.info(`${FILE_NAME}: CasePhotoEvidenceSection.handleOpenCamera: camera button pressed`);
    onOpenCamera();
  };

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
          <Text size="xs" fontWeight="$bold" color="$textLight900" sx={{ _dark: { color: '$textDark0' } }}>
            {t('caseDetails.photo.title')}
          </Text>
        </HStack>

        <FormSelectField
          fieldId="case-details-photo-tag"
          label={t('caseDetails.photo.tagLabel')}
          value={selectedPhotoTag}
          onValueChange={onSelectPhotoTag}
          options={photoTagOptions.map((tag) => ({ label: tag.label, value: tag.code }))}
        />

        {photosForSelectedTag.length > 0 ? (
          <CasePhotoGallery
            photos={photosForSelectedTag}
            photoTagOptions={photoTagOptions}
            onDeletePhoto={onDeletePhoto}
          />
        ) : null}

        <Button
          size="lg"
          borderRadius="$xl"
          onPress={handleOpenCamera}
          accessibilityLabel={t(
            photosForSelectedTag.length > 0 ? 'caseDetails.photo.addAnother' : 'caseDetails.photo.openCamera',
          )}
          testID="case-details-open-camera-button"
        >
          <ButtonIcon as={CameraIcon} mr="$2" />
          <ButtonText>
            {t(photosForSelectedTag.length > 0 ? 'caseDetails.photo.addAnother' : 'caseDetails.photo.openCamera')}
          </ButtonText>
        </Button>
      </VStack>
    </Box>
  );
}
