import React from 'react';
import type { ReactElement } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, CloseIcon, HStack, Icon, Image, Pressable, Text, VStack } from '@gluestack-ui/themed';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { ClockIcon, MapPinIcon } from '@/shared/components';
import { ROUTE_NAMES } from '@/navigation/routes';
import type { RootStackParamList } from '@/navigation/routes';

const FILE_NAME = 'case-photo-viewer-screen.tsx';

type CasePhotoViewerRoute = RouteProp<RootStackParamList, typeof ROUTE_NAMES.CASE_PHOTO_VIEWER>;

/** Full-screen, read-only view of one captured evidence photo — reached by tapping a thumbnail. */
export function CasePhotoViewerScreen(): ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<CasePhotoViewerRoute>();

  const handleClose = (): void => {
    LoggerService.info(`${FILE_NAME}: CasePhotoViewerScreen.handleClose: closing viewer`);
    navigation.goBack();
  };

  return (
    <Box flex={1} bg="$backgroundDark950" testID="case-photo-viewer-screen">
      <Pressable
        onPress={handleClose}
        position="absolute"
        top="$4"
        right="$4"
        zIndex={1}
        p="$2"
        accessibilityLabel={t('caseDetails.photo.viewerClose')}
        testID="case-photo-viewer-close-button"
      >
        <Icon as={CloseIcon} color="$textDark0" size="lg" />
      </Pressable>

      <Box flex={1} justifyContent="center" alignItems="center">
        <Image
          source={{ uri: `file://${params.filePath}` }}
          accessibilityLabel={params.documentTypeLabel}
          w="$full"
          h="$full"
          resizeMode="contain"
        />
      </Box>

      <VStack position="absolute" bottom="$8" left="$4" right="$4" space="xs">
        <HStack space="xs" alignItems="center">
          <Icon as={MapPinIcon} size="xs" color="$textDark0" />
          <Text size="xs" color="$textDark0">
            {t('caseDetails.camera.geoCoordinates', {
              latitude: params.latitude.toFixed(4),
              longitude: params.longitude.toFixed(4),
            })}
          </Text>
        </HStack>
        <HStack space="xs" alignItems="center">
          <Icon as={ClockIcon} size="xs" color="$textDark0" />
          <Text size="xs" color="$textDark0">
            {t('caseDetails.camera.timestamp', { value: new Date(params.capturedAtIso).toLocaleString() })}
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
}
