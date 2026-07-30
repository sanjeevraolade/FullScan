import React from 'react';
import type { ReactElement } from 'react';
import {
  Box,
  Button,
  ButtonText,
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
  CheckIcon,
  Heading,
  ScrollView,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { LoggerService } from '@/infrastructure/logger';
import { FormTextField } from '@/shared/components';

import { useLoginForm, VALIDATION_REQUIRED_MESSAGE_KEY } from '../hooks/use-login-form';

const FILE_NAME = 'login-screen.tsx';

/**
 * Login screen — a hand-written screen, not generated from configuration.
 * Presentation and form wiring only: form state and validation live in
 * `useLoginForm`, and authenticating the credentials will live behind a
 * repository once authentication is implemented.
 */
export function LoginScreen(): ReactElement {
  const { t } = useTranslation();
  const { control, errors, isSubmitting, submitLogin } = useLoginForm();
  LoggerService.info(`${FILE_NAME}: LoginScreen: rendering`);

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Box flex={1} p="$5" justifyContent="center">
        <VStack space="lg">
          <VStack space="xs">
            <Heading size="xl">{t('login.title')}</Heading>
            <Text size="sm">{t('login.welcome')}</Text>
          </VStack>

          <Controller
            control={control}
            name="username"
            rules={{ required: VALIDATION_REQUIRED_MESSAGE_KEY }}
            render={({ field: { value, onChange, onBlur } }) => (
              <FormTextField
                fieldId="username"
                labelKey="login.fields.username"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorKey={errors.username?.message}
                isRequired
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            rules={{ required: VALIDATION_REQUIRED_MESSAGE_KEY }}
            render={({ field: { value, onChange, onBlur } }) => (
              <FormTextField
                fieldId="password"
                labelKey="login.fields.password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorKey={errors.password?.message}
                isRequired
                isSecure
              />
            )}
          />

          <Controller
            control={control}
            name="employeeId"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormTextField
                fieldId="employeeId"
                labelKey="login.fields.employeeId"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorKey={errors.employeeId?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="rememberMe"
            render={({ field: { value, onChange } }) => (
              <Checkbox
                value="rememberMe"
                isChecked={value}
                onChange={(nextIsChecked: boolean) => {
                  LoggerService.info(`${FILE_NAME}: LoginScreen: rememberMe toggled`, {
                    isChecked: nextIsChecked,
                  });
                  onChange(nextIsChecked);
                }}
                accessibilityLabel={t('login.fields.rememberMe')}
                testID="rememberMe-checkbox"
              >
                <CheckboxIndicator mr="$2">
                  <CheckboxIcon as={CheckIcon} />
                </CheckboxIndicator>
                <CheckboxLabel>{t('login.fields.rememberMe')}</CheckboxLabel>
              </Checkbox>
            )}
          />

          <Button
            onPress={submitLogin}
            isDisabled={isSubmitting}
            accessibilityLabel={t('login.actions.submit')}
            testID="login-submit-button"
          >
            <ButtonText>{t('login.actions.submit')}</ButtonText>
          </Button>
        </VStack>
      </Box>
    </ScrollView>
  );
}
