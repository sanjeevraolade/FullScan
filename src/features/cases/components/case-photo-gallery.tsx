import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  Box,
  Button,
  ButtonText,
  Heading,
  Icon,
  Image,
  Pressable,
  ScrollView,
  Text,
  TrashIcon,
} from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import type { CapturedPhotoEvidence } from '@/domain/case';
import type { DropdownOption } from '@/domain/reference-data';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';

const FILE_NAME = 'case-photo-gallery.tsx';

export interface CasePhotoGalleryProps {
  readonly photos: readonly CapturedPhotoEvidence[];
  readonly photoTagOptions: readonly DropdownOption[];
  readonly onDeletePhoto: (filePath: string) => void;
  readonly isReadOnly?: boolean;
}

/**
 * Thumbnail strip for camera-captured evidence — tap a thumbnail to view it
 * full-screen (a real navigated screen, not an overlay), tap the trash badge
 * to remove it (with a confirm step, since a deleted capture can't be
 * recovered). Presentation only: which photos exist is owned by
 * `CaseDetailsScreen`, this component just displays them and asks to delete
 * one.
 */
export function CasePhotoGallery({ photos, photoTagOptions, onDeletePhoto, isReadOnly = false }: CasePhotoGalleryProps): ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [photoPendingDeletion, setPhotoPendingDeletion] = useState<CapturedPhotoEvidence | null>(null);

  // Evidence file paths and bytes are never logged — only counts and document type codes.
  LoggerService.info(`${FILE_NAME}: CasePhotoGallery: rendering`, {
    photoCount: photos.length,
    photoTagOptionCount: photoTagOptions.length,
    isDeleteDialogOpen: photoPendingDeletion !== null,
    isReadOnly,
  });

  const labelForDocumentType = (documentTypeCode: string): string => {
    const matchedLabel = photoTagOptions.find((option) => option.code === documentTypeCode)?.label;
    LoggerService.info(`${FILE_NAME}: CasePhotoGallery.labelForDocumentType: resolved label`, {
      documentTypeCode,
      hasMatchingOption: matchedLabel !== undefined,
    });
    return matchedLabel ?? documentTypeCode;
  };

  const handleDismissDeleteDialog = (): void => {
    LoggerService.info(`${FILE_NAME}: CasePhotoGallery.handleDismissDeleteDialog: delete confirmation dismissed`);
    setPhotoPendingDeletion(null);
  };

  const handleThumbnailPress = (photo: CapturedPhotoEvidence): void => {
    LoggerService.info(`${FILE_NAME}: CasePhotoGallery.handleThumbnailPress: opening full-screen viewer`, {
      documentTypeCode: photo.documentTypeCode,
      isMockLocation: photo.isMockLocation,
    });
    navigation.navigate(ROUTE_NAMES.CASE_PHOTO_VIEWER, {
      filePath: photo.filePath,
      latitude: photo.latitude,
      longitude: photo.longitude,
      accuracyMeters: photo.accuracyMeters,
      isMockLocation: photo.isMockLocation,
      capturedAtIso: photo.capturedAt.toISOString(),
      documentTypeCode: photo.documentTypeCode,
      documentTypeLabel: labelForDocumentType(photo.documentTypeCode),
    });
  };

  const handleRequestDelete = (photo: CapturedPhotoEvidence): void => {
    LoggerService.info(`${FILE_NAME}: CasePhotoGallery.handleRequestDelete: delete confirmation opened`, {
      documentTypeCode: photo.documentTypeCode,
    });
    setPhotoPendingDeletion(photo);
  };

  const handleConfirmDelete = (): void => {
    if (!photoPendingDeletion) {
      LoggerService.warn(
        `${FILE_NAME}: CasePhotoGallery.handleConfirmDelete: ignored — no photo pending deletion`,
      );
      return;
    }
    LoggerService.info(`${FILE_NAME}: CasePhotoGallery.handleConfirmDelete: photo removed`, {
      documentTypeCode: photoPendingDeletion.documentTypeCode,
    });
    onDeletePhoto(photoPendingDeletion.filePath);
    setPhotoPendingDeletion(null);
  };

  return (
    <Box testID="case-photo-gallery">
      <Text size="2xs" fontWeight="$bold" color="$textLight500" sx={{ _dark: { color: '$textDark400' } }} mb="$2">
        {t('caseDetails.photo.capturedLabel', { count: photos.length })}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 14, paddingRight: 14 }}>
        <Box flexDirection="row" style={{ gap: 16 }}>
          {photos.map((photo) => {
            LoggerService.info(`${FILE_NAME}: CasePhotoGallery: rendering thumbnail`, {
              documentTypeCode: photo.documentTypeCode,
            });
            return (
            <Box key={photo.filePath} w={80}>
              <Box position="relative" w={80} h={80}>
                <Pressable
                  onPress={() => handleThumbnailPress(photo)}
                  accessibilityLabel={t('caseDetails.photo.viewLabel')}
                  testID={`case-photo-thumbnail-${photo.filePath}`}
                >
                  <Image
                    source={{ uri: `file://${photo.filePath}` }}
                    accessibilityLabel={labelForDocumentType(photo.documentTypeCode)}
                    w={80}
                    h={80}
                    borderRadius={12}
                    resizeMode="cover"
                  />
                </Pressable>

                <Pressable
                  onPress={() => handleRequestDelete(photo)}
                  disabled={isReadOnly}
                  position="absolute"
                  top={-10}
                  right={-10}
                  bg="$error600"
                  borderWidth="$2"
                  borderColor="$backgroundLight0"
                  sx={{ _dark: { borderColor: '$backgroundDark900' } }}
                  borderRadius="$full"
                  w={28}
                  h={28}
                  justifyContent="center"
                  alignItems="center"
                  opacity={isReadOnly ? 0.4 : 1}
                  accessibilityLabel={t('caseDetails.photo.deleteLabel')}
                  testID={`case-photo-delete-${photo.filePath}`}
                >
                  <Icon as={TrashIcon} size="2xs" color="$textLight0" />
                </Pressable>
              </Box>

              <Text
                size="2xs"
                color="$textLight500"
                sx={{ _dark: { color: '$textDark400' } }}
                numberOfLines={1}
                mt="$1"
              >
                {labelForDocumentType(photo.documentTypeCode)}
              </Text>
            </Box>
            );
          })}
        </Box>
      </ScrollView>

      <AlertDialog isOpen={photoPendingDeletion !== null} onClose={handleDismissDeleteDialog}>
        <AlertDialogBackdrop />
        <AlertDialogContent testID="case-photo-delete-dialog">
          <AlertDialogHeader>
            <Heading size="md">{t('caseDetails.photo.deleteDialogTitle')}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text size="sm">{t('caseDetails.photo.deleteDialogMessage')}</Text>
          </AlertDialogBody>
          <AlertDialogFooter style={{ gap: 8 }}>
            <Button
              variant="outline"
              action="secondary"
              onPress={handleDismissDeleteDialog}
              testID="case-photo-delete-dialog-cancel"
            >
              <ButtonText>{t('caseDetails.photo.deleteCancel')}</ButtonText>
            </Button>
            <Button action="negative" onPress={handleConfirmDelete} testID="case-photo-delete-dialog-confirm">
              <ButtonText>{t('caseDetails.photo.deleteConfirm')}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
