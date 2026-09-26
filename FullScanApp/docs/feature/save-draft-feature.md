# Save as Draft

Implemented 2026-09-04. Lets a Field Executive persist a partially completed verification form
locally and resume it later, and surfaces which cases are mid-work on both the Case List and Case
Details screens.

Built on top of the geo-fence work — see
[location-geo-fence-validation.md](../features-added/location-geo-fence-validation.md). The same
change also narrowed geo-fence gating to Pending cases only (§2), which is what makes a "draft" a
coherent state at all: a case being worked on stays Pending, so it stays geo-fenced.

> **Note on location:** every sibling feature doc lives in `docs/features-added/`. This file was
> written to `docs/feature/` as requested; move it if the shared folder is preferred.

---

## 1. Files changed

### Added

| File                                             | Purpose                                                    |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `src/features/cases/services/draft-storage.ts`   | `CaseDraft` type + `DraftStorageService` (MMKV persistence) |

### Modified

| File                                                | Change                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/features/cases/hooks/use-case-details.ts`      | Geo-fence gated to Pending; draft load/save/clear; clears draft on submit |
| `src/features/cases/hooks/use-case-geo-fence.ts`    | `isCaseContentUnlocked` now also true when the check is disabled        |
| `src/features/cases/hooks/use-case-geo-fence.test.ts` | Updated the one assertion that expected disabled ⇒ locked              |
| `src/features/cases/screens/case-details-screen.tsx` | Save-as-Draft button + compact draft timestamp line                     |
| `src/features/cases/screens/case-list-screen.tsx`   | Per-row draft lookup; `useFocusEffect` re-render on return              |
| `src/features/cases/components/case-card.tsx`       | Optional `hasDraft` prop + amber Draft badge                            |
| `src/localization/{en,hi,te}/common.json`           | `caseList.card.draft`, `caseDetails.saveDraft`, `caseDetails.draft.saved` |

---

## 2. Geo-fence now applies to Pending cases only

The prerequisite change. Previously the geo-fence ran for every case that had loaded; now it runs
only for `bucket === 'pending'`.

| Bucket      | Geo-fence | Rationale                                                      |
| ----------- | --------- | -------------------------------------------------------------- |
| `new`       | Off       | Acceptance happens before the executive travels to the address |
| `pending`   | **On**    | The live visit — the only state where presence is being proven  |
| `beyondTat` | Off       | Past the TAT window                                            |
| `completed` | Off       | Read-only regardless                                           |

Two edits implement it:

```ts
// use-case-details.ts — was `isEnabled: caseDetail !== null`
isEnabled: caseDetail?.bucket === 'pending',

// use-case-geo-fence.ts — was `status === 'inside' || bypassConsent !== null`
const isCaseContentUnlocked = !isEnabled || status === 'inside' || bypassConsent !== null;
```

The second edit is the load-bearing one: with the check disabled the status stays `idle`, which
previously unlocked nothing, so a non-Pending case would have rendered as a permanently blocked
screen. `!isEnabled` short-circuits that.

**A draft does not change the bucket.** A half-filled Pending case is still Pending, so it is still
geo-fenced on reopen — the executive must be at the address again to continue. That is deliberate:
the draft preserves typing, not proof of presence.

---

## 3. Storage

`DraftStorageService` — a static class over the existing `KeyValueStorageService` (MMKV, instance
`fullscan.cache`). Non-sensitive per CLAUDE.md's storage split; see §7 for the PII caveat.

- **Key:** `case_draft:<caseId>`, one entry per case, so drafts are naturally isolated.
- **API:** `saveDraft(draft)`, `loadDraft(caseId)`, `deleteDraft(caseId)`, `hasDraft(caseId)`,
  `clearAllDrafts()`.
- Every method is wrapped in `try/catch` and degrades to a no-op or `null` — a storage failure
  never blocks verification work.
- `clearAllDrafts()` enumerates `getAllKeys()` and removes the `case_draft`-prefixed ones.

### `CaseDraft`

`caseId`, `verificationStatus`, `utvReason`, `utvRemarks`, `insufficientReason`,
`insufficientRemarks`, `residenceType`, `addressType`, `respondentName`, `respondentRelation`,
`isSignatureCaptured`, `selectedPhotoTag`, `capturedPhotos`, `geoFenceBypassConsent`, `savedAt`
(ISO string).

Two fields are declared but not functional — see §6.1 and §6.2.

---

## 4. Behaviour

### Save

Manual only. Tapping **Save as Draft** writes the current form state and stamps `savedAt`. There is
no autosave: it would fire on every keystroke across a form that holds respondent PII, and the
battery/write cost was not worth it for a screen the executive is actively looking at.

### Restore

Automatic. A `useEffect` keyed on `[caseId, caseDetail]` runs once the case detail arrives, reads
any draft, and pushes each field back into form state. Every value is coalesced
(`draft.utvRemarks || ''`, `draft.residenceType || 'rented'`) so a partial or older draft shape can
never put `undefined` into a `useState<string>` — that was a real crash, see §5.3.

### Clear

On successful submission, inside the `.then()` of `submitVerificationOutcome`. A failed submit
leaves the draft intact, which is the point — a network error must not destroy the executive's work.

### Button placement

Inside the existing three-way branch at the foot of Case Details:

| Case state              | Footer                                          |
| ----------------------- | ----------------------------------------------- |
| `new`                   | Accept only — no draft button                    |
| `completed` (read-only) | Read-only notice — no draft button               |
| otherwise, unlocked     | **Save as Draft** (secondary) above Submit       |

---

## 5. UI

### Case List — Draft badge

`renderItem` calls `DraftStorageService.hasDraft(item.id)` per row and passes it to `CaseCard`,
which renders an amber `action="warning"` badge (`📝 Draft`) beside the verification-type badge.

`useFocusEffect` bumps a throwaway counter when the screen regains focus, forcing the rows to
re-evaluate `hasDraft` after a save. Without it the badge only appeared after some unrelated state
change, because the `Case` objects themselves never change when a draft is written.

### Case Details — draft timestamp

One muted `size="xs"` line: `📝 Draft saved 03:43`. It renders only when a draft exists and doubles
as the save confirmation, so tapping the button shows no banner or toast.

This started as three stacked `Alert` boxes ("Loaded from draft…", "✓ Draft saved at 3:43:37 AM",
and a third one) and was cut to one line on review — the stack pushed the actual case content below
the fold.

### Localization

`caseList.card.draft`, `caseDetails.saveDraft`, and `caseDetails.draft.saved` in all three
languages. The timestamp is passed as a `{{time}}` interpolation rather than concatenated after a
label, so Hindi and Telugu keep natural word order (`ड्राफ्ट {{time}} पर सहेजा गया`).

---

## 6. Known gaps

1. **Captured photos are not saved.** `CaseDraft.capturedPhotos` exists but `saveDraft` always
   writes `[]`, and the restore path never reads it. Photos live in navigation params
   (`CaseDetailsRouteParams`), not in `useCaseDetails`, so the hook cannot see them from where
   `saveDraft` is defined. Restoring them also needs a decision about the underlying files, which
   are on disk and not currently reference-counted. Photos taken before a save are therefore lost
   on remount — the most likely thing a user would report as a bug.
2. **`geoFenceBypassConsent` is written but never restored.** Harmless, because
   `useGeoFenceBypassStore` already persists consent per case in its own MMKV entry, so it survives
   independently. The field is redundant and should be dropped from `CaseDraft`.
3. **`clearDraft` is dead API.** Exposed by `useCaseDetails`, called by nothing. Either wire it to a
   "Discard draft" action or remove it.
4. **`clearAllDrafts` is not wired to logout.** `app-drawer-content.tsx` clears the geocoding cache
   on logout but not drafts, so one executive's drafts persist into the next session on a shared
   device. Worth deciding deliberately: drafts may be *worth* keeping across a re-login by the same
   user, but not across users.
5. **The draft button also shows for `beyondTat`.** It falls into the `otherwise` branch of §4. Not
   obviously wrong, just not a decision that was made.
6. **One MMKV read per row per render.** Cheap and synchronous, but it is I/O inside `renderItem`.
   If the list grows, hoist it to a `Set` of draft ids built once per focus.

---

## 7. Security / conventions

- Draft contents are **never logged** — only `caseId`, counts, flags and lengths, consistent with
  the surrounding code. Respondent name and remarks are PII.
- **However:** those same fields are written to `fullscan.cache`, the *non-sensitive* MMKV instance,
  unencrypted. Respondent name and relation are PII, so this needs a call on whether drafts belong
  in encrypted storage instead. Flagging rather than deciding — it affects the storage split
  described in CLAUDE.md.
- `FILE_NAME` constant, kebab-case filename, Gluestack components, theme tokens, localization keys,
  no `console.log`, no `any` — all followed.

---

## 8. Bugs found and fixed during implementation

Recorded because two of the three were mistakes in this feature's own first draft.

1. **Wrong `KeyValueStorageService` arity.** Called as
   `getObject(DRAFT_KEY_PREFIX, key)` / `setObject(DRAFT_KEY_PREFIX, key, draft)`, but the
   interface takes a single full key. `deleteDraft` also called a non-existent `removeKey()`. The
   visible symptom was **every Pending case showing a Draft badge**. Fixed to `getObject(key)` /
   `setObject(key, value)` / `remove(key)`.
2. **`undefined` from a draft crashed the render.** `setUtvRemarks(draft.utvRemarks)` allowed
   `undefined` into a `string` state, and the next `utvRemarks.length` in the form-state log threw
   `Cannot read property 'length' of undefined`. Fixed with `|| ''` coalescing on every restored
   field; also made the two `.length` reads inside `draft-storage.ts` optional (`?.length ?? 0`).
3. **Missing translation key rendered raw.** `setNoticeKey('caseDetails.draftSaved')` pointed at a
   key that does not exist — the real one is nested at `caseDetails.draft.draftSaved` — so the UI
   displayed the literal string `caseDetails.draftSaved`. Removed the notice entirely; the
   timestamp line is now the confirmation.

The first two are the kind a test would have caught before the device did — see §9.

---

## 9. Tests

**No tests were added for this feature.** The suite passes at 30 suites / 286 tests, but that is
the pre-existing count: `npx tsc --noEmit` is clean, and `grep -rln DraftStorageService src | grep
test` returns nothing. The one test change was fixing an existing geo-fence assertion that expected
"disabled ⇒ locked".

This does not meet CLAUDE.md's "every feature should ship with tests". Missing coverage, roughly in
priority order:

- `draft-storage.ts` — round-trip, absent draft, per-case isolation, corrupt JSON, `clearAllDrafts`
  removing only prefixed keys. Would have caught bug §8.1 immediately.
- Restore of a partial/legacy draft object — the §8.2 crash, as a regression test.
- Draft cleared on submit success, **retained** on submit failure.
- Geo-fence enabled for `pending` and disabled for the other three buckets.
- Case List badge presence/absence per row.

`__mocks__/react-native-mmkv.js` (in-memory) already exists, so the storage tests need no new
scaffolding.
