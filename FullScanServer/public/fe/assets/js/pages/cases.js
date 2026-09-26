/**
 * Cases page — the signed-in field executive's own cases as one headed,
 * read-only table per category: Pending, Beyond TAT, Completed.
 *
 * Loaded fresh on every visit, so switching back to Cases shows current data.
 * A load failure is thrown to the router, which shows it as the page alert.
 */

import { feWebApi } from '../api.js';
import { escapeHtml, formatWallClockTimestamp } from '/admin/assets/js/dom.js';

/** Heading and empty-state copy for each category's list. */
const GROUP_META = {
  pending: { title: 'Pending', empty: 'No pending cases.' },
  beyond_tat: { title: 'Beyond TAT', empty: 'No cases past their TAT.' },
  completed: { title: 'Completed', empty: 'No completed cases yet.' },
};

const ADDRESS_TYPE_LABELS = {
  present: 'Present',
  permanent: 'Permanent',
  previous: 'Previous',
};

function renderCaseRow(entry) {
  const addressType = entry.addressType
    ? ADDRESS_TYPE_LABELS[entry.addressType] || entry.addressType
    : '';

  return `
    <tr>
      <td>
        <span class="cell__strong">${escapeHtml(entry.caseRef)}</span>
        <span class="cell__muted">${escapeHtml(entry.clientName)}</span>
      </td>
      <td>${escapeHtml(entry.candidateName)}</td>
      <td>
        <span>${escapeHtml(entry.verificationType)}</span>
        ${addressType ? `<span class="cell__muted">${escapeHtml(addressType)}</span>` : ''}
      </td>
      <td class="cell__wrap">${escapeHtml(entry.address || '—')}</td>
      <td>${escapeHtml(entry.componentStatusLabel || '—')}</td>
      <td><span class="cell__muted">${escapeHtml(formatWallClockTimestamp(entry.tatDueAt) || '—')}</span></td>
    </tr>`;
}

function renderCaseTable(group, titleId) {
  return `
    <div class="table-wrap">
      <table class="table table--static" aria-labelledby="${titleId}">
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Candidate</th>
            <th scope="col">Component</th>
            <th scope="col">Address</th>
            <th scope="col">Status</th>
            <th scope="col">TAT due</th>
          </tr>
        </thead>
        <tbody>${group.cases.map(renderCaseRow).join('')}</tbody>
      </table>
    </div>`;
}

/** An empty group still renders its heading, so "no pending cases" reads as an answer. */
function renderCaseGroup(group) {
  const meta = GROUP_META[group.bucket] || { title: group.bucket, empty: 'No cases.' };
  const titleId = `cases-${group.bucket}`;
  const countLabel = `${group.caseCount} case${group.caseCount === 1 ? '' : 's'}`;

  const body =
    group.caseCount === 0
      ? `<p class="case-group__empty">${escapeHtml(meta.empty)}</p>`
      : renderCaseTable(group, titleId);

  return `
    <section class="case-group" aria-labelledby="${titleId}">
      <header class="case-group__header">
        <h2 class="case-group__title" id="${titleId}">${escapeHtml(meta.title)}</h2>
        <span class="badge badge--${escapeHtml(group.bucket)}">${escapeHtml(countLabel)}</span>
      </header>
      ${body}
    </section>`;
}

export async function render(container) {
  const { caseGroups } = await feWebApi.getMyCases();
  container.innerHTML = caseGroups.map(renderCaseGroup).join('');
}
