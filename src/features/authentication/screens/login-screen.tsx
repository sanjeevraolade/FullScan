import React, { useRef } from 'react';
import type { ReactElement } from 'react';
import {
  Alert,
  AlertCircleIcon,
  AlertIcon,
  AlertText,
  Box,
  Button,
  ButtonSpinner,
  ButtonText,
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
  CheckIcon,
  Heading,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  VStack,
} from '@gluestack-ui/themed';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform } from 'react-native';

import { getAppVersion } from '@/infrastructure/device';
import { LoggerService } from '@/infrastructure/logger';
import { FormTextField, type FormTextFieldHandle } from '@/shared/components';

import { useLoginForm, VALIDATION_REQUIRED_MESSAGE_KEY } from '../hooks/use-login-form';

const FILE_NAME = 'login-screen.tsx';
const LOGO_SIZE = 96;

function dismissKeyboard(): void {
  LoggerService.info(`${FILE_NAME}: dismissKeyboard: dismissing keyboard on outside tap`);
  Keyboard.dismiss();
}

/**
 * Login screen — a hand-written screen, not generated from configuration.
 * Presentation and form wiring only: form state and validation live in
 * `useLoginForm`, and authenticating the credentials goes through the
 * (currently stubbed) authentication repository behind that hook.
 */
export function LoginScreen(): ReactElement {
  const { t } = useTranslation();
  const { control, errors, isSubmitting, canSubmit, loginError, submitLogin } = useLoginForm();
  const passwordInputRef = useRef<FormTextFieldHandle>(null);
  const appVersion = getAppVersion();
  const copyrightYear = new Date().getFullYear();
  LoggerService.info(`${FILE_NAME}: LoginScreen: rendering`);

  const focusPasswordField = (): void => {
    LoggerService.info(`${FILE_NAME}: LoginScreen.focusPasswordField: moving focus to password`);
    passwordInputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} flex={1}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Pressable flex={1} accessible={false} onPress={dismissKeyboard}>
          <Box flex={1} p="$5" justifyContent="space-around">
            <VStack space="lg">
              <Image
                source={require('@/shared/assets/images/icon_72.png')}
                alt={t('login.logoAlt')}
                accessibilityLabel={t('login.logoAlt')}
                resizeMode="contain"
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                alignSelf="center"
              />

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
                    returnKeyType="next"
                    onSubmitEditing={focusPasswordField}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                rules={{ required: VALIDATION_REQUIRED_MESSAGE_KEY }}
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormTextField
                    ref={passwordInputRef}
                    fieldId="password"
                    labelKey="login.fields.password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    errorKey={errors.password?.message}
                    isRequired
                    isSecure
                    returnKeyType="done"
                    onSubmitEditing={submitLogin}
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
                    returnKeyType="done"
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

              {loginError ? (
                <Alert action="error" testID="login-error-alert">
                  <AlertIcon as={AlertCircleIcon} mr="$2" />
                  <AlertText>{t(`login.errors.${loginError}`)}</AlertText>
                </Alert>
              ) : null}

              <Button
                onPress={submitLogin}
                isDisabled={isSubmitting || !canSubmit}
                accessibilityLabel={t('login.actions.submit')}
                testID="login-submit-button"
              >
                {isSubmitting ? (
                  <ButtonSpinner
                    mr="$2"
                    accessibilityLabel={t('login.actions.submitting')}
                    testID="login-submit-spinner"
                  />
                ) : null}
                <ButtonText>{t('login.actions.submit')}</ButtonText>
              </Button>

              <VStack space="xs" alignItems="center">
                <Text size="xs" testID="login-footer-version">
                  {t('login.footer.version', { version: appVersion })}
                </Text>
                <Text size="xs" testID="login-footer-copyright">
                  {t('login.footer.copyright', { year: copyrightYear })}
                </Text>
              </VStack>
            </VStack>
          </Box>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
