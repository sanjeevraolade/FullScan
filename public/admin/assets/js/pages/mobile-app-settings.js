/**
 * Mobile App Settings page.
 *
 * Fully data-driven: the form is generated from the `value_type`, `options`, and
 * `min`/`max` metadata each setting carries, so a new setting added as a seed row
 * in `mobile_app_settings` appears here with the right input and no code change.
 *
 * Only changed settings are sent on save, and the server's validated response
 * becomes the new baseline.
 */

import { adminApi } from '../api.js';
import { escapeHtml, formatTimestamp } from '../dom.js';

const CATEGORY_META = {
  general: {
    title: 'General',
    subtitle: 'Versioning, language and app-wide availability.',
  },
  security: {
    title: 'Security',
    subtitle: 'Sign-in, session and location-integrity controls.',
  },
  evidence: {
    title: 'Evidence Capture',
    subtitle: 'Geo-fencing and photo rules applied to captured evidence.',
  },
  sync: {
    title: 'Synchronization',
    subtitle: 'How the offline queue drains to the server.',
  },
};

/** Categories not listed above still render, in the order the API returned them. */
function getCategoryMeta(category) {
  return (
    CATEGORY_META[category] || {
      title: category.replace(/[-_]/g, ' '),
      subtitle: null,
    }
  );
}

let state = { settings: [], baseline: new Map(), container: null };

function groupByCategory(settings) {
  const groups = [];

  for (const setting of settings) {
    let group = groups.find((candidate) => candidate.category === setting.category);
    if (!group) {
      group = { category: setting.category, settings: [] };
      groups.push(group);
    }
    group.settings.push(setting);
  }

  return groups;
}

function renderControl(setting) {
  const id = `setting-${setting.key}`;

  if (setting.valueType === 'boolean') {
    return `
      <label class="switch" for="${id}">
        <input type="checkbox" id="${id}" data-setting-key="${escapeHtml(setting.key)}" ${
          setting.value ? 'checked' : ''
        } />
        <span class="switch__text" data-switch-text>${setting.value ? 'Enabled' : 'Disabled'}</span>
      </label>`;
  }

  if (setting.valueType === 'enum') {
    const options = (setting.options || [])
      .map(
        (option) =>
          `<option value="${escapeHtml(option)}" ${
            option === setting.value ? 'selected' : ''
          }>${escapeHtml(option)}</option>`,
      )
      .join('');

    return `<select class="field__control" id="${id}" data-setting-key="${escapeHtml(
      setting.key,
    )}">${options}</select>`;
  }

  if (setting.valueType === 'number') {
    const min = setting.minValue === null ? '' : ` min="${setting.minValue}"`;
    const max = setting.maxValue === null ? '' : ` max="${setting.maxValue}"`;

    return `<input type="number" class="field__control" id="${id}" data-setting-key="${escapeHtml(
      setting.key,
    )}" value="${escapeHtml(setting.value)}"${min}${max} inputmode="numeric" />`;
  }

  return `<input type="text" class="field__control" id="${id}" data-setting-key="${escapeHtml(
    setting.key,
  )}" value="${escapeHtml(setting.value)}" maxlength="500" />`;
}

function renderRangeHint(setting) {
  if (setting.valueType !== 'number' || (setting.minValue === null && setting.maxValue === null)) {
    return '';
  }

  const min = setting.minValue === null ? '—' : setting.minValue;
  const max = setting.maxValue === null ? '—' : setting.maxValue;

  return `<p class="setting__meta">Allowed range: ${min} to ${max}</p>`;
}

function renderUpdatedHint(setting) {
  const updatedAt = formatTimestamp(setting.updatedAt);
  return updatedAt ? `<p class="setting__meta">Last changed ${escapeHtml(updatedAt)}</p>` : '';
}

function renderSetting(setting) {
  const label = `setting-${setting.key}`;

  return `
    <div class="setting">
      <div class="setting__text">
        <label class="setting__label" for="${label}">${escapeHtml(setting.label)}</label>
        ${
          setting.description
            ? `<p class="setting__description">${escapeHtml(setting.description)}</p>`
            : ''
        }
        ${renderRangeHint(setting)}
        ${renderUpdatedHint(setting)}
      </div>
      <div class="setting__control">${renderControl(setting)}</div>
    </div>`;
}

function renderForm(settings) {
  const cards = groupByCategory(settings)
    .map(({ category, settings: grouped }) => {
      const meta = getCategoryMeta(category);

      return `
        <section class="card">
          <header class="card__header">
            <h2 class="card__title">${escapeHtml(meta.title)}</h2>
            ${meta.subtitle ? `<p class="card__subtitle">${escapeHtml(meta.subtitle)}</p>` : ''}
          </header>
          <div class="card__body">${grouped.map(renderSetting).join('')}</div>
        </section>`;
    })
    .join('');

  return `
    <form data-settings-form novalidate>
      ${cards}
      <div class="actionbar">
        <span class="actionbar__status" data-dirty-status>No unsaved changes</span>
        <button type="button" class="btn" data-reset disabled>Discard changes</button>
        <button type="submit" class="btn btn--primary" data-save disabled>Save changes</button>
      </div>
    </form>`;
}

/** Reads a control's current value back in the setting's declared type. */
function readControlValue(input, valueType) {
  if (valueType === 'boolean') {
    return input.checked;
  }
  if (valueType === 'number') {
    return input.value.trim() === '' ? NaN : Number(input.value);
  }
  return input.value;
}

function collectChangedSettings(container) {
  const changed = [];

  for (const setting of state.settings) {
    const input = container.querySelector(`[data-setting-key="${CSS.escape(setting.key)}"]`);
    if (!input) {
      continue;
    }

    const value = readControlValue(input, setting.valueType);
    const baseline = state.baseline.get(setting.key);

    if (Number.isNaN(value)) {
      changed.push({ key: setting.key, value, label: setting.label, invalid: true });
      continue;
    }

    if (value !== baseline) {
      changed.push({ key: setting.key, value, label: setting.label, invalid: false });
    }
  }

  return changed;
}

function refreshDirtyState(container) {
  const changed = collectChangedSettings(container);
  const status = container.querySelector('[data-dirty-status]');
  const saveButton = container.querySelector('[data-save]');
  const resetButton = container.querySelector('[data-reset]');

  const isDirty = changed.length > 0;
  status.textContent = isDirty
    ? `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}`
    : 'No unsaved changes';
  status.classList.toggle('actionbar__status--dirty', isDirty);
  saveButton.disabled = !isDirty;
  resetButton.disabled = !isDirty;

  return changed;
}

/** Rebuilds the form from `settings` and makes them the new saved baseline. */
function paint(container, settings) {
  state.settings = settings;
  state.baseline = new Map(settings.map((setting) => [setting.key, setting.value]));

  container.innerHTML = renderForm(settings);
  refreshDirtyState(container);
}

export async function render(container, { setStatus }) {
  state.container = container;

  const settings = await adminApi.getMobileAppSettings();

  if (settings.length === 0) {
    container.innerHTML = '<div class="state">No mobile app settings are configured yet.</div>';
    return;
  }

  paint(container, settings);

  // Every listener is delegated on `container`, because `paint()` replaces the
  // form's markup wholesale after each save and reset.

  // Keep boolean rows' helper text in step with the checkbox.
  container.addEventListener('change', (event) => {
    const input = event.target.closest('[data-setting-key]');
    if (!input) {
      return;
    }

    if (input.type === 'checkbox') {
      const text = input.parentElement.querySelector('[data-switch-text]');
      if (text) {
        text.textContent = input.checked ? 'Enabled' : 'Disabled';
      }
    }

    refreshDirtyState(container);
  });

  container.addEventListener('input', (event) => {
    if (event.target.closest('[data-setting-key]')) {
      refreshDirtyState(container);
    }
  });

  container.addEventListener('click', (event) => {
    if (!event.target.closest('[data-reset]')) {
      return;
    }
    paint(container, state.settings);
    setStatus(null);
  });

  container.addEventListener('submit', async (event) => {
    if (!event.target.closest('[data-settings-form]')) {
      return;
    }
    event.preventDefault();

    const changed = refreshDirtyState(container);
    const invalid = changed.find((entry) => entry.invalid);

    if (invalid) {
      setStatus({ variant: 'error', message: `"${invalid.label}" needs a value.` });
      return;
    }

    if (changed.length === 0) {
      return;
    }

    const saveButton = container.querySelector('[data-save]');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    setStatus(null);

    try {
      const updated = await adminApi.updateMobileAppSettings(
        changed.map(({ key, value }) => ({ key, value })),
      );

      paint(container, updated);
      setStatus({
        variant: 'success',
        message: `Saved. ${changed.length} setting${
          changed.length === 1 ? '' : 's'
        } updated — mobile clients pick this up on their next sync.`,
      });
    } catch (error) {
      setStatus({ variant: 'error', message: error.message });
      const button = container.querySelector('[data-save]');
      if (button) {
        button.disabled = false;
        button.textContent = 'Save changes';
      }
    }
  });
}

export function destroy() {
  state = { settings: [], baseline: new Map(), container: null };
}
