/**
 * Cases page — every case in the system, category-wise, plus the create/update
 * editor.
 *
 * The list is **component-level**: a case (one Case Ref Number) routinely holds
 * several verification components, and the component is what carries a category
 * (bucket), an assignee and a TAT. Opening a row loads its *parent case*, so the
 * editor always works on the whole record rather than one component in isolation.
 *
 * Two views live in this one module — `list` and `editor` — because they share
 * the loaded form options and executive roster, and the router owns only routes.
 */

import { adminApi } from '../api.js';
import { escapeHtml, formatTimestamp } from '../dom.js';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const BUCKET_LABELS = {
  new: 'New',
  pending: 'Pending',
  beyond_tat: 'Beyond TAT',
  completed: 'Completed',
};

const ADDRESS_TYPE_LABELS = {
  present: 'Present',
  permanent: 'Permanent',
  previous: 'Previous',
};

const RESIDENCE_TYPE_LABELS = {
  owned: 'Owned',
  rented: 'Rented',
  hostel: 'Hostel',
  paying_guest: 'Paying Guest',
  company_quarters: 'Company Quarters',
  relative_owned: 'Relative Owned',
};

/** A component the editor starts from when the admin adds one. */
function buildBlankComponent() {
  return {
    id: null,
    bucket: 'new',
    componentStatus: 'new_component',
    actionStatus: '',
    verificationType: 'Address',
    addressType: 'present',
    residenceType: '',
    address: '',
    location: '',
    remarks: '',
    assignedFieldExecutiveId: '',
    assignedToName: '',
    tatDueAt: '',
    targetLatitude: 0,
    targetLongitude: 0,
    maskedPrimaryPhone: '',
    maskedSecondaryPhone: '',
    clientInstructions: '',
    fieldExecutiveNotes: '',
  };
}

function buildBlankCase() {
  return {
    id: null,
    caseRef: '',
    clientName: '',
    candidateName: '',
    fatherOrSpouseName: '',
    employerName: '',
    primaryContactNumber: '',
    secondaryContactNumber: '',
    profileStatus: '',
    components: [buildBlankComponent()],
  };
}

function createInitialState() {
  return {
    container: null,
    setStatus: () => {},
    filter: { bucket: '', search: '', fieldExecutiveId: '', offset: 0 },
    formOptions: null,
    fieldExecutives: [],
    listResult: null,
    /** The case being edited, or a blank one when creating. Null means the list is showing. */
    draft: null,
    searchTimer: null,
    isSaving: false,
  };
}

let state = createInitialState();

/* ------------------------------------------------------------------ helpers */

function labelForCode(options, code, fallback = '—') {
  if (!code) {
    return fallback;
  }
  const match = (options || []).find((option) => option.code === code);
  return match ? match.label : code;
}

function renderOptions(options, selected, placeholder) {
  const head = placeholder
    ? `<option value=""${selected ? '' : ' selected'}>${escapeHtml(placeholder)}</option>`
    : '';

  const body = options
    .map(
      ({ value, label }) =>
        `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(
          label,
        )}</option>`,
    )
    .join('');

  return head + body;
}

function toCodeOptions(dropdownOptions) {
  return (dropdownOptions || []).map((option) => ({ value: option.code, label: option.label }));
}

function toLabelledOptions(values, labels) {
  return (values || []).map((value) => ({ value, label: labels[value] || value }));
}

function fieldExecutiveOptions() {
  return state.fieldExecutives.map((executive) => ({
    value: executive.id,
    label: `${executive.name} (${executive.username})`,
  }));
}

/* --------------------------------------------------------------- list view */

function renderTabs(categories) {
  const total = categories.reduce((sum, category) => sum + category.count, 0);

  const tabs = [{ bucket: '', label: 'All', count: total }, ...categories.map((category) => ({
    bucket: category.bucket,
    label: BUCKET_LABELS[category.bucket] || category.bucket,
    count: category.count,
  }))];

  return `
    <div class="tabs" role="tablist" data-tabs>
      ${tabs
        .map(
          (tab) => `
            <button
              class="tab${tab.bucket === state.filter.bucket ? ' tab--active' : ''}"
              type="button"
              role="tab"
              aria-selected="${tab.bucket === state.filter.bucket}"
              data-bucket="${escapeHtml(tab.bucket)}"
            >
              ${escapeHtml(tab.label)}<span class="tab__count">${tab.count}</span>
            </button>`,
        )
        .join('')}
    </div>`;
}

function renderRow(item) {
  const addressType = item.addressType ? ADDRESS_TYPE_LABELS[item.addressType] || item.addressType : '';
  const assignee = item.assignedFieldExecutiveName || item.assignedToName || 'Unassigned';

  return `
    <tr data-case-id="${escapeHtml(item.caseId)}" tabindex="0">
      <td>
        <span class="cell__strong">${escapeHtml(item.caseRef)}</span>
        <span class="cell__muted">${escapeHtml(item.clientName)}</span>
      </td>
      <td>${escapeHtml(item.candidateName)}</td>
      <td>
        <span>${escapeHtml(item.verificationType)}</span>
        ${addressType ? `<span class="cell__muted">${escapeHtml(addressType)}</span>` : ''}
      </td>
      <td class="cell__wrap">${escapeHtml(item.address)}</td>
      <td>${escapeHtml(assignee)}</td>
      <td><span class="badge badge--${escapeHtml(item.bucket)}">${escapeHtml(
        BUCKET_LABELS[item.bucket] || item.bucket,
      )}</span></td>
      <td>${escapeHtml(labelForCode(state.formOptions.componentStatuses, item.componentStatus))}</td>
      <td class="cell__muted">${escapeHtml(formatTimestamp(item.updatedAt) || '—')}</td>
    </tr>`;
}

function renderPagination(result) {
  const first = result.total === 0 ? 0 : result.offset + 1;
  const last = Math.min(result.offset + result.items.length, result.total);

  return `
    <div class="pagination">
      <span class="pagination__status">${first}–${last} of ${result.total}</span>
      <button class="btn" type="button" data-page="previous" ${
        result.offset === 0 ? 'disabled' : ''
      }>Previous</button>
      <button class="btn" type="button" data-page="next" ${
        last >= result.total ? 'disabled' : ''
      }>Next</button>
    </div>`;
}

function renderList() {
  const result = state.listResult;

  const table =
    result.items.length === 0
      ? '<div class="state">No cases match these filters.</div>'
      : `
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Candidate</th>
                <th scope="col">Component</th>
                <th scope="col">Address</th>
                <th scope="col">Assigned to</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody data-case-rows>${result.items.map(renderRow).join('')}</tbody>
          </table>
        </div>
        ${renderPagination(result)}`;

  state.container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar__search">
        <label class="visually-hidden" for="case-search">Search cases</label>
        <input
          class="field__control"
          id="case-search"
          type="search"
          placeholder="Search case ref, candidate, client or address"
          value="${escapeHtml(state.filter.search)}"
          data-search
        />
      </div>
      <div class="toolbar__filter">
        <label class="visually-hidden" for="case-executive">Filter by field executive</label>
        <select class="field__control" id="case-executive" data-executive-filter>
          ${renderOptions(fieldExecutiveOptions(), state.filter.fieldExecutiveId, 'All field executives')}
        </select>
      </div>
      <button class="btn btn--primary" type="button" data-new-case>New case</button>
    </div>
    ${renderTabs(result.categories)}
    ${table}`;
}

/* ------------------------------------------------------------- editor view */

function renderTextField(componentIndex, field, label, value, options = {}) {
  const id = `component-${componentIndex}-${field}`;
  const attributes = options.type === 'number' ? ' type="number" step="any"' : ' type="text"';

  return `
    <div class="field">
      <label class="field__label" for="${id}">${escapeHtml(label)}</label>
      <input class="field__control" id="${id}"${attributes} value="${escapeHtml(value ?? '')}"
        data-component-index="${componentIndex}" data-field="${field}"
        ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ''} />
      ${options.hint ? `<p class="field__hint">${escapeHtml(options.hint)}</p>` : ''}
    </div>`;
}

function renderTextArea(componentIndex, field, label, value) {
  const id = `component-${componentIndex}-${field}`;

  return `
    <div class="field field--wide">
      <label class="field__label" for="${id}">${escapeHtml(label)}</label>
      <textarea class="field__control" id="${id}" rows="2"
        data-component-index="${componentIndex}" data-field="${field}">${escapeHtml(value ?? '')}</textarea>
    </div>`;
}

function renderSelectField(componentIndex, field, label, options, selected, placeholder) {
  const id = `component-${componentIndex}-${field}`;

  return `
    <div class="field">
      <label class="field__label" for="${id}">${escapeHtml(label)}</label>
      <select class="field__control" id="${id}" data-component-index="${componentIndex}" data-field="${field}">
        ${renderOptions(options, selected || '', placeholder)}
      </select>
    </div>`;
}

function renderComponentCard(component, index) {
  const { formOptions } = state;

  return `
    <section class="card component-card" data-component-card="${index}">
      <header class="card__header component-card__header">
        <div>
          <h2 class="card__title">Component ${index + 1}</h2>
          <p class="card__subtitle">${
            component.id
              ? `Existing component · ${escapeHtml(component.id)}`
              : 'New component — added to this case on save'
          }</p>
        </div>
        ${
          component.id
            ? ''
            : '<button class="btn btn--danger-ghost" type="button" data-remove-component="' +
              index +
              '">Remove</button>'
        }
      </header>
      <div class="card__body form-grid">
        ${renderSelectField(
          index,
          'bucket',
          'Category',
          toLabelledOptions(formOptions.buckets, BUCKET_LABELS),
          component.bucket,
        )}
        ${renderSelectField(
          index,
          'componentStatus',
          'Component status',
          toCodeOptions(formOptions.componentStatuses),
          component.componentStatus,
        )}
        ${renderSelectField(
          index,
          'actionStatus',
          'Action status',
          toCodeOptions(formOptions.actionStatuses),
          component.actionStatus,
          'No action yet',
        )}
        ${renderTextField(index, 'verificationType', 'Verification type', component.verificationType, {
          placeholder: 'Address, Employment, Education…',
        })}
        ${renderSelectField(
          index,
          'addressType',
          'Address type',
          toLabelledOptions(formOptions.addressTypes, ADDRESS_TYPE_LABELS),
          component.addressType,
          'Not applicable',
        )}
        ${renderSelectField(
          index,
          'residenceType',
          'Residence type',
          toLabelledOptions(formOptions.residenceTypes, RESIDENCE_TYPE_LABELS),
          component.residenceType,
          'Not recorded',
        )}
        ${renderTextArea(index, 'address', 'Address', component.address)}
        ${renderTextField(index, 'location', 'Locality', component.location)}
        ${renderSelectField(
          index,
          'assignedFieldExecutiveId',
          'Assigned field executive',
          fieldExecutiveOptions(),
          component.assignedFieldExecutiveId,
          'Unassigned',
        )}
        ${renderTextField(index, 'assignedToName', 'Assignee name (free text)', component.assignedToName, {
          hint: 'Used when the source system names someone outside the roster.',
        })}
        ${renderTextField(index, 'tatDueAt', 'TAT due', component.tatDueAt, {
          placeholder: 'YYYY-MM-DD HH:MM:SS',
        })}
        ${renderTextField(index, 'targetLatitude', 'Target latitude', component.targetLatitude, {
          type: 'number',
        })}
        ${renderTextField(index, 'targetLongitude', 'Target longitude', component.targetLongitude, {
          type: 'number',
        })}
        ${renderTextField(index, 'maskedPrimaryPhone', 'Masked primary phone', component.maskedPrimaryPhone, {
          hint: 'Masked on purpose — the app never receives a raw candidate number.',
        })}
        ${renderTextField(
          index,
          'maskedSecondaryPhone',
          'Masked secondary phone',
          component.maskedSecondaryPhone,
        )}
        ${renderTextArea(index, 'clientInstructions', 'Client instructions', component.clientInstructions)}
        ${renderTextArea(index, 'fieldExecutiveNotes', 'Field executive notes', component.fieldExecutiveNotes)}
        ${renderTextArea(index, 'remarks', 'Remarks', component.remarks)}
      </div>
    </section>`;
}

function renderCaseField(field, label, value, options = {}) {
  const id = `case-${field}`;

  return `
    <div class="field${options.wide ? ' field--wide' : ''}">
      <label class="field__label" for="${id}">${escapeHtml(label)}</label>
      <input class="field__control" id="${id}" type="text" value="${escapeHtml(value ?? '')}"
        data-case-field="${field}" ${options.required ? 'required' : ''} />
    </div>`;
}

function renderEditor() {
  const draft = state.draft;
  const isNew = !draft.id;

  state.container.innerHTML = `
    <div class="toolbar toolbar--editor">
      <button class="btn" type="button" data-back>Back to cases</button>
      <p class="toolbar__title">${
        isNew ? 'New case' : `Editing ${escapeHtml(draft.caseRef)}`
      }</p>
    </div>

    <form data-case-form novalidate>
      <section class="card">
        <header class="card__header">
          <h2 class="card__title">Case</h2>
          <p class="card__subtitle">The candidate/client record every component below belongs to.</p>
        </header>
        <div class="card__body form-grid">
          ${renderCaseField('caseRef', 'Case reference', draft.caseRef, { required: true })}
          ${renderCaseField('clientName', 'Client', draft.clientName, { required: true })}
          ${renderCaseField('candidateName', 'Candidate', draft.candidateName, { required: true })}
          ${renderCaseField('fatherOrSpouseName', 'Father / spouse name', draft.fatherOrSpouseName)}
          ${renderCaseField('employerName', 'Employer', draft.employerName)}
          ${renderCaseField('primaryContactNumber', 'Primary contact number', draft.primaryContactNumber)}
          ${renderCaseField('secondaryContactNumber', 'Secondary contact number', draft.secondaryContactNumber)}
          <div class="field">
            <label class="field__label" for="case-profileStatus">Profile status</label>
            <select class="field__control" id="case-profileStatus" data-case-field="profileStatus">
              ${renderOptions(
                toCodeOptions(state.formOptions.profileStatuses),
                draft.profileStatus,
                'Select a profile status',
              )}
            </select>
          </div>
        </div>
      </section>

      <div data-components>
        ${draft.components.map(renderComponentCard).join('')}
      </div>

      <div class="editor-actions">
        <button class="btn" type="button" data-add-component>Add component</button>
      </div>

      <div class="actionbar">
        <span class="actionbar__status">${
          isNew
            ? 'A case needs at least one component.'
            : 'Components left untouched here are not changed.'
        }</span>
        <button class="btn" type="button" data-back>Cancel</button>
        <button class="btn btn--primary" type="submit" data-save>${
          isNew ? 'Create case' : 'Save changes'
        }</button>
      </div>
    </form>`;
}

/* ----------------------------------------------------------------- reading */

function readComponentFromForm(index) {
  const container = state.container;
  const read = (field) => {
    const input = container.querySelector(
      `[data-component-index="${index}"][data-field="${field}"]`,
    );
    return input ? input.value.trim() : '';
  };

  const latitude = read('targetLatitude');
  const longitude = read('targetLongitude');

  const component = {
    bucket: read('bucket'),
    componentStatus: read('componentStatus'),
    actionStatus: read('actionStatus') || null,
    verificationType: read('verificationType'),
    addressType: read('addressType') || null,
    residenceType: read('residenceType') || null,
    address: read('address'),
    location: read('location'),
    remarks: read('remarks'),
    assignedFieldExecutiveId: read('assignedFieldExecutiveId') || null,
    assignedToName: read('assignedToName'),
    tatDueAt: read('tatDueAt'),
    targetLatitude: latitude === '' ? 0 : Number(latitude),
    targetLongitude: longitude === '' ? 0 : Number(longitude),
    maskedPrimaryPhone: read('maskedPrimaryPhone'),
    maskedSecondaryPhone: read('maskedSecondaryPhone'),
    clientInstructions: read('clientInstructions'),
    fieldExecutiveNotes: read('fieldExecutiveNotes'),
  };

  const existingId = state.draft.components[index].id;
  return existingId ? { id: existingId, ...component } : component;
}

function readDraftFromForm() {
  const container = state.container;
  const read = (field) => {
    const input = container.querySelector(`[data-case-field="${field}"]`);
    return input ? input.value.trim() : '';
  };

  return {
    caseRef: read('caseRef'),
    clientName: read('clientName'),
    candidateName: read('candidateName'),
    fatherOrSpouseName: read('fatherOrSpouseName'),
    employerName: read('employerName'),
    primaryContactNumber: read('primaryContactNumber'),
    secondaryContactNumber: read('secondaryContactNumber'),
    profileStatus: read('profileStatus'),
    components: state.draft.components.map((_, index) => readComponentFromForm(index)),
  };
}

/** The checks worth making before a round trip; the server re-validates everything. */
function findFirstProblem(payload) {
  if (!payload.caseRef) {
    return 'A case reference is required.';
  }
  if (!payload.clientName) {
    return 'A client name is required.';
  }
  if (!payload.candidateName) {
    return 'A candidate name is required.';
  }
  if (!payload.profileStatus) {
    return 'Choose a profile status.';
  }
  if (payload.components.length === 0 && !state.draft.id) {
    return 'A new case needs at least one component.';
  }

  const missingAddress = payload.components.findIndex((component) => !component.address);
  if (missingAddress !== -1) {
    return `Component ${missingAddress + 1} needs an address.`;
  }

  const missingType = payload.components.findIndex((component) => !component.verificationType);
  if (missingType !== -1) {
    return `Component ${missingType + 1} needs a verification type.`;
  }

  return null;
}

/* ----------------------------------------------------------------- actions */

/**
 * Re-rendering the list replaces the search box, which would drop focus mid-typing
 * — the debounced reload fires while the admin is still at the keyboard. So the
 * caret is captured before the swap and restored after it.
 */
function captureSearchFocus() {
  const active = document.activeElement;

  if (!active || !active.closest || !active.closest('[data-search]')) {
    return null;
  }

  return { start: active.selectionStart, end: active.selectionEnd };
}

function restoreSearchFocus(caret) {
  if (!caret) {
    return;
  }

  const input = state.container.querySelector('[data-search]');
  if (!input) {
    return;
  }

  input.focus();
  input.setSelectionRange(caret.start, caret.end);
}

async function loadList() {
  const caret = captureSearchFocus();
  state.container.innerHTML = '<div class="state"><span class="spinner"></span></div>';

  state.listResult = await adminApi.listCases({
    bucket: state.filter.bucket,
    search: state.filter.search,
    fieldExecutiveId: state.filter.fieldExecutiveId,
    limit: PAGE_SIZE,
    offset: state.filter.offset,
  });

  state.draft = null;
  renderList();
  restoreSearchFocus(caret);
}

async function refreshList() {
  try {
    await loadList();
  } catch (error) {
    state.setStatus({ variant: 'error', message: error.message });
  }
}

async function openEditor(caseId) {
  state.setStatus(null);
  state.container.innerHTML = '<div class="state"><span class="spinner"></span></div>';

  try {
    if (caseId) {
      const detail = await adminApi.getCase(caseId);
      state.draft = {
        ...detail,
        components: detail.components.map((component) => ({
          ...component,
          actionStatus: component.actionStatus || '',
          addressType: component.addressType || '',
          residenceType: component.residenceType || '',
          assignedFieldExecutiveId: component.assignedFieldExecutiveId || '',
        })),
      };
    } else {
      state.draft = buildBlankCase();
    }

    renderEditor();
  } catch (error) {
    state.setStatus({ variant: 'error', message: error.message });
    await refreshList();
  }
}

async function saveDraft() {
  if (state.isSaving) {
    return;
  }

  const payload = readDraftFromForm();
  const problem = findFirstProblem(payload);

  if (problem) {
    state.setStatus({ variant: 'error', message: problem });
    return;
  }

  const saveButton = state.container.querySelector('[data-save]');
  state.isSaving = true;
  saveButton.disabled = true;
  saveButton.textContent = 'Saving…';
  state.setStatus(null);

  try {
    const saved = state.draft.id
      ? await adminApi.updateCase(state.draft.id, payload)
      : await adminApi.createCase(payload);

    state.filter.offset = 0;
    await loadList();
    state.setStatus({
      variant: 'success',
      message: `Case ${saved.caseRef} saved with ${saved.components.length} component${
        saved.components.length === 1 ? '' : 's'
      }.`,
    });
  } catch (error) {
    state.setStatus({ variant: 'error', message: error.message });
    const button = state.container.querySelector('[data-save]');
    if (button) {
      button.disabled = false;
      button.textContent = state.draft && state.draft.id ? 'Save changes' : 'Create case';
    }
  } finally {
    state.isSaving = false;
  }
}

/**
 * Keeps the draft in step with the form before the markup is rebuilt — adding or
 * removing a component re-renders every card, which would otherwise discard
 * whatever the admin had typed into the others.
 */
function captureDraftEdits() {
  const current = readDraftFromForm();
  state.draft = {
    ...state.draft,
    ...current,
    components: current.components.map((component, index) => ({
      ...state.draft.components[index],
      ...component,
      id: state.draft.components[index].id,
    })),
  };
}

/* ---------------------------------------------------------------- listeners */

function onClick(event) {
  const tab = event.target.closest('[data-bucket]');
  if (tab) {
    state.filter.bucket = tab.dataset.bucket;
    state.filter.offset = 0;
    refreshList();
    return;
  }

  if (event.target.closest('[data-new-case]')) {
    openEditor(null);
    return;
  }

  if (event.target.closest('[data-back]')) {
    state.setStatus(null);
    refreshList();
    return;
  }

  const page = event.target.closest('[data-page]');
  if (page) {
    const step = page.dataset.page === 'next' ? PAGE_SIZE : -PAGE_SIZE;
    state.filter.offset = Math.max(0, state.filter.offset + step);
    refreshList();
    return;
  }

  const remove = event.target.closest('[data-remove-component]');
  if (remove) {
    captureDraftEdits();
    state.draft.components.splice(Number(remove.dataset.removeComponent), 1);
    renderEditor();
    return;
  }

  if (event.target.closest('[data-add-component]')) {
    captureDraftEdits();
    state.draft.components.push(buildBlankComponent());
    renderEditor();
    return;
  }

  const row = event.target.closest('[data-case-id]');
  if (row) {
    openEditor(row.dataset.caseId);
  }
}

function onKeydown(event) {
  if (event.key !== 'Enter') {
    return;
  }

  const row = event.target.closest('tr[data-case-id]');
  if (row) {
    event.preventDefault();
    openEditor(row.dataset.caseId);
  }
}

function onInput(event) {
  if (!event.target.closest('[data-search]')) {
    return;
  }

  const { value } = event.target;
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => {
    state.filter.search = value.trim();
    state.filter.offset = 0;
    refreshList();
  }, SEARCH_DEBOUNCE_MS);
}

function onChange(event) {
  if (event.target.closest('[data-executive-filter]')) {
    state.filter.fieldExecutiveId = event.target.value;
    state.filter.offset = 0;
    refreshList();
  }
}

function onSubmit(event) {
  if (!event.target.closest('[data-case-form]')) {
    return;
  }
  event.preventDefault();
  saveDraft();
}

/* -------------------------------------------------------------- page module */

export async function render(container, { setStatus }) {
  state = createInitialState();
  state.container = container;
  state.setStatus = setStatus;

  // Both views need these, and the roster doubles as the list's assignee filter.
  const [formOptions, fieldExecutives] = await Promise.all([
    adminApi.getCaseFormOptions(),
    adminApi.listFieldExecutives(),
  ]);

  state.formOptions = formOptions;
  state.fieldExecutives = fieldExecutives;

  container.addEventListener('click', onClick);
  container.addEventListener('keydown', onKeydown);
  container.addEventListener('input', onInput);
  container.addEventListener('change', onChange);
  container.addEventListener('submit', onSubmit);

  await loadList();
}

export function destroy() {
  window.clearTimeout(state.searchTimer);
  state = createInitialState();
}
