/**
 * Add New Case page — the Cases page's editor, opened blank and on its own route.
 *
 * It reuses `cases.js` rather than duplicating the editor: same form, same
 * validation, same `POST /cases`. After a save the form resets for the next case
 * instead of returning to the list.
 */

import { destroy, renderNewCase } from './cases.js';

export function render(container, context) {
  return renderNewCase(container, context);
}

export { destroy };
