import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { LocalizationEngine } from '@/localization';
import { ThemeProvider } from '@/theme';

import { FormSelectField, type FormSelectOption } from './form-select-field';

const PHOTO_TAG_OPTIONS: readonly FormSelectOption[] = [
  { label: 'House Photo 1', value: 'house_photo_1' },
  { label: 'House Photo 2', value: 'house_photo_2' },
];

function buildField(value: string, options: readonly FormSelectOption[]): React.ReactElement {
  return (
    <ThemeProvider>
      <FormSelectField
        fieldId="photo-tag"
        label="Photo tag"
        value={value}
        options={options}
        onValueChange={jest.fn()}
      />
    </ThemeProvider>
  );
}

/** Gluestack marks the trigger's TextInput aria-hidden, so it must be queried explicitly. */
function getDisplayedText(): unknown {
  return screen.getByTestId('photo-tag-select-input', { includeHiddenElements: true }).props['value'];
}

describe('FormSelectField', () => {
  beforeEach(async () => {
    await LocalizationEngine.initialize();
  });

  afterEach(() => {
    LocalizationEngine.dispose();
  });

  it('shows the option label, not the raw value, for a parent-supplied value', async () => {
    await render(buildField('house_photo_1', PHOTO_TAG_OPTIONS));

    expect(getDisplayedText()).toBe('House Photo 1');
  });

  it('shows the option label once options arrive after the first render', async () => {
    await render(buildField('house_photo_1', []));

    await screen.rerender(buildField('house_photo_1', PHOTO_TAG_OPTIONS));

    expect(getDisplayedText()).toBe('House Photo 1');
  });

  it('follows a value changed from outside the picker', async () => {
    await render(buildField('house_photo_1', PHOTO_TAG_OPTIONS));

    await screen.rerender(buildField('house_photo_2', PHOTO_TAG_OPTIONS));

    expect(getDisplayedText()).toBe('House Photo 2');
  });

  it('follows relabelled options, e.g. after a language switch', async () => {
    await render(buildField('house_photo_1', PHOTO_TAG_OPTIONS));

    await screen.rerender(
      buildField('house_photo_1', [
        { label: 'घर की फोटो 1', value: 'house_photo_1' },
        { label: 'घर की फोटो 2', value: 'house_photo_2' },
      ]),
    );

    expect(getDisplayedText()).toBe('घर की फोटो 1');
  });

  it('shows nothing when no value is selected', async () => {
    await render(buildField('', PHOTO_TAG_OPTIONS));

    expect(getDisplayedText()).toBe('');
  });
});
