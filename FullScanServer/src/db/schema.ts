import { ObjectId, type CollationOptions, type Db, type Document, type IndexDescription } from 'mongodb';
import { ADDRESS_TYPES, CASE_BUCKETS, RESIDENCE_TYPES } from '../types/admin-case.types.js';
import { DEVICE_CHANGE_REQUEST_STATUSES, type DeviceReleaseReason } from '../types/device-change.types.js';
import { EVIDENCE_SOURCES, type EvidenceMimeType } from '../types/case-evidence.types.js';
import type { SettingValueType } from '../types/mobile-app-setting.types.js';
import type { DropdownCategory } from '../types/reference-data.types.js';

/**
 * The MongoDB schema: one collection per former SQLite table, same names, same
 * snake_case fields, plus the few collections added since the move. What SQLite
 * enforced with NOT NULL / CHECK is a `$jsonSchema` validator here, and every SQLite
 * index — partial unique ones included — has a MongoDB equivalent. `applySchema()`
 * creates or updates all of it on startup and is safe to run repeatedly.
 *
 * Foreign keys have no MongoDB equivalent; the services check references before
 * writing (see docs/sqlite-migration-mongodb.md).
 */

/**
 * The collections that were SQLite tables. The legacy tooling in `scripts/` (seed
 * generator, SQLite → MongoDB copy) reads exactly these tables from SQLite.
 */
export const LEGACY_TABLE_NAMES = [
  'ui_configs',
  'field_executives',
  'cases',
  'case_components',
  'dropdown_options',
  'admin_users',
  'mobile_app_settings',
  'mock_location_events',
  'device_change_requests',
  'field_executive_devices',
  'case_evidence',
] as const;

export type LegacyTableName = (typeof LEGACY_TABLE_NAMES)[number];

/**
 * Collections added after the move to MongoDB. No SQLite table backs them, so the
 * legacy tooling never reads, seeds or copies them; migrations create their data.
 *
 * - `app_metadata` — server-maintained values about the data, one document per value.
 *   `_id: 'master_data'` holds the master-data version (see `app-metadata.dao.ts`).
 */
const MONGO_ONLY_COLLECTION_NAMES = ['app_metadata'] as const;

export const COLLECTION_NAMES = [...LEGACY_TABLE_NAMES, ...MONGO_ONLY_COLLECTION_NAMES] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];

/** Applied migrations, keyed by name. Not a business collection, so not in the list above. */
export const MIGRATIONS_COLLECTION = 'migrations';

/** SQLite's `COLLATE NOCASE` — used by the admin email index and every query that must hit it. */
export const CASE_INSENSITIVE: CollationOptions = { locale: 'en', strength: 2 };

const DROPDOWN_CATEGORIES = [
  'verification_type_status',
  'utv_option',
  'insuff_option',
  'photo_type',
  'component_status',
  'action_status',
  'profile_status',
] as const satisfies readonly DropdownCategory[];

const SETTING_VALUE_TYPES = ['boolean', 'number', 'string', 'enum'] as const satisfies readonly SettingValueType[];

const RELEASE_REASONS = ['device_change_approved', 'binding_replaced'] as const satisfies readonly DeviceReleaseReason[];

const EVIDENCE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const satisfies readonly EvidenceMimeType[];

/** Any numeric BSON type — the driver stores a whole-number JS value as an int. */
const NUMBER_BSON_TYPES = ['int', 'long', 'double', 'decimal'];

/**
 * `case_evidence` fields only a mobile capture carries: required on `mobile_capture`
 * rows, absent (or null) on `web_upload` rows.
 */
const MOBILE_CAPTURE_FIELD_RULES: Readonly<Record<string, Document>> = {
  document_type_code: { bsonType: 'string', minLength: 1 },
  latitude: { bsonType: NUMBER_BSON_TYPES, minimum: -90, maximum: 90 },
  longitude: { bsonType: NUMBER_BSON_TYPES, minimum: -180, maximum: 180 },
  accuracy_meters: { bsonType: NUMBER_BSON_TYPES, minimum: 0 },
  is_mock_location: { bsonType: 'bool' },
  captured_at: { bsonType: 'string' },
};

/**
 * Makes a mobile capture idempotent by content: one `mobile_capture` per component per
 * SHA-256. The DAO recognises a duplicate-key error on it by this name.
 */
export const MOBILE_CAPTURE_SHA256_INDEX = 'component_sha256_mobile_capture_unique';

interface CollectionSpec {
  /**
   * The SQLite primary key column, stored as `_id`. A MongoDB-only collection names
   * the field a row-shaped seed would carry its key in.
   */
  readonly primaryKey: string;
  /**
   * Adds an `insert_order` ObjectId to every document. SQLite broke timestamp ties
   * with `rowid` (insertion order); these collections sort on this field instead, so
   * rows written in the same second still come back in the order they were written.
   */
  readonly hasInsertOrder: boolean;
  readonly notNull: readonly string[];
  readonly checks?: Readonly<Record<string, Document>>;
  /**
   * Rules that depend on another field's value: a document must match exactly one of
   * these `$jsonSchema` fragments (`oneOf`), on top of `notNull` and `checks`.
   */
  readonly variants?: readonly Document[];
  readonly indexes: readonly IndexDescription[];
}

function oneOf(values: readonly string[]): Document {
  return { enum: [...values] };
}

function nullOrOneOf(values: readonly string[]): Document {
  return { enum: [...values, null] };
}

export const COLLECTIONS: Readonly<Record<CollectionName, CollectionSpec>> = {
  ui_configs: {
    primaryKey: 'id',
    hasInsertOrder: false,
    notNull: ['screen_id', 'version', 'title', 'config_json'],
    indexes: [{ key: { screen_id: 1 }, name: 'screen_id_unique', unique: true }],
  },
  field_executives: {
    primaryKey: 'id',
    hasInsertOrder: false,
    notNull: ['name', 'role', 'email', 'password_hash'],
    // Mobile session revocation (docs/api-contracts/mobile-logout.md). Optional — absent
    // reads as 0, so existing accounts need no migration — but when present a whole
    // number ≥ 0: `$inc` fails on null, and no token's integer claim matches a fraction.
    checks: { mobile_session_version: { bsonType: ['int', 'long'], minimum: 0 } },
    indexes: [
      // SQLite's UNIQUE ignored NULLs; MongoDB's does not, hence the partial filter.
      {
        key: { username: 1 },
        name: 'username_unique',
        unique: true,
        partialFilterExpression: { username: { $type: 'string' } },
      },
      { key: { device_id: 1 }, name: 'device_id' },
    ],
  },
  cases: {
    primaryKey: 'id',
    hasInsertOrder: false,
    notNull: [
      'case_ref',
      'client_name',
      'candidate_name',
      'father_or_spouse_name',
      'employer_name',
      'profile_status',
      'primary_contact_number',
      'secondary_contact_number',
    ],
    indexes: [{ key: { case_ref: 1 }, name: 'case_ref_unique', unique: true }],
  },
  case_components: {
    primaryKey: 'id',
    hasInsertOrder: true,
    notNull: [
      'case_id',
      'component_status',
      'bucket',
      'verification_type',
      'address',
      'location',
      'remarks',
      'additional_verification_instructions',
      'additional_verification_remarks',
      'assigned_to_name',
      'tat_due_at',
      'target_latitude',
      'target_longitude',
      'gps_distance_meters',
      'gps_is_within_range',
      'masked_primary_phone',
      'masked_secondary_phone',
      'client_instructions',
      'field_executive_notes',
    ],
    checks: {
      bucket: oneOf(CASE_BUCKETS),
      address_type: nullOrOneOf(ADDRESS_TYPES),
      residence_type: nullOrOneOf(RESIDENCE_TYPES),
      // The executive's observed values from the verification outcome. Absent on components
      // with no outcome yet — a property rule only applies to a field that is present.
      observed_address_type: nullOrOneOf(ADDRESS_TYPES),
      observed_residence_type: nullOrOneOf(RESIDENCE_TYPES),
    },
    indexes: [
      { key: { case_id: 1 }, name: 'case_id' },
      { key: { assigned_field_executive_id: 1, updated_at: -1 }, name: 'assigned_field_executive_id' },
      // The mobile per-tab list (keyset pages in COMPONENTS_NEWEST_FIRST order) and tab counts.
      {
        key: { assigned_field_executive_id: 1, bucket: 1, updated_at: -1, insert_order: 1 },
        name: 'assigned_bucket_newest_first',
      },
      { key: { bucket: 1 }, name: 'bucket' },
    ],
  },
  dropdown_options: {
    primaryKey: 'id',
    hasInsertOrder: false,
    notNull: ['category', 'code', 'label', 'sort_order'],
    checks: { category: oneOf(DROPDOWN_CATEGORIES) },
    indexes: [
      { key: { category: 1, code: 1 }, name: 'category_code_unique', unique: true },
      { key: { category: 1, sort_order: 1 }, name: 'category_sort_order' },
    ],
  },
  admin_users: {
    primaryKey: 'id',
    hasInsertOrder: false,
    notNull: ['username', 'name', 'email', 'password_hash', 'role', 'is_active'],
    indexes: [
      { key: { username: 1 }, name: 'username_unique', unique: true },
      { key: { email: 1 }, name: 'email_unique_ci', unique: true, collation: CASE_INSENSITIVE },
    ],
  },
  mobile_app_settings: {
    primaryKey: 'setting_key',
    hasInsertOrder: false,
    notNull: ['setting_value', 'value_type', 'label', 'category', 'sort_order'],
    checks: { value_type: oneOf(SETTING_VALUE_TYPES) },
    indexes: [{ key: { category: 1, sort_order: 1 }, name: 'category_sort_order' }],
  },
  mock_location_events: {
    primaryKey: 'id',
    hasInsertOrder: false,
    notNull: [
      'client_event_id',
      'field_executive_id',
      'detection_stage',
      'detected_at',
      'reported_at',
      'is_emulator',
      'raw_payload',
      'created_at',
    ],
    indexes: [
      { key: { client_event_id: 1 }, name: 'client_event_id_unique', unique: true },
      { key: { field_executive_id: 1, detected_at: -1 }, name: 'field_executive_detected_at' },
      { key: { device_id: 1 }, name: 'device_id' },
    ],
  },
  device_change_requests: {
    primaryKey: 'id',
    hasInsertOrder: true,
    notNull: ['field_executive_id', 'status', 'device_id', 'requested_at'],
    checks: { status: oneOf(DEVICE_CHANGE_REQUEST_STATUSES) },
    indexes: [
      { key: { field_executive_id: 1, requested_at: -1 }, name: 'field_executive_requested_at' },
      { key: { status: 1, requested_at: -1 }, name: 'status_requested_at' },
      // At most one pending request per executive — the database backstop behind the service check.
      {
        key: { field_executive_id: 1 },
        name: 'one_pending_per_field_executive',
        unique: true,
        partialFilterExpression: { status: 'pending' },
      },
    ],
  },
  field_executive_devices: {
    primaryKey: 'id',
    hasInsertOrder: true,
    notNull: ['field_executive_id', 'device_id', 'created_at'],
    checks: { release_reason: nullOrOneOf(RELEASE_REASONS) },
    indexes: [
      { key: { field_executive_id: 1, created_at: -1 }, name: 'field_executive_created_at' },
      // At most one open binding per executive. Stored documents always carry
      // `released_at`, so an open binding is one where it is null.
      {
        key: { field_executive_id: 1 },
        name: 'one_open_binding_per_field_executive',
        unique: true,
        partialFilterExpression: { released_at: { $type: 'null' } },
      },
      // A request is followed by at most one new binding.
      {
        key: { bound_after_request_id: 1 },
        name: 'bound_after_request_unique',
        unique: true,
        partialFilterExpression: { bound_after_request_id: { $type: 'string' } },
      },
    ],
  },
  case_evidence: {
    primaryKey: 'id',
    hasInsertOrder: true,
    notNull: [
      'component_id',
      'field_executive_id',
      'source',
      'original_name',
      'storage_path',
      'mime_type',
      'size_bytes',
      'sha256',
      'uploaded_at',
    ],
    checks: {
      source: oneOf(EVIDENCE_SOURCES),
      mime_type: oneOf(EVIDENCE_MIME_TYPES),
      size_bytes: { bsonType: ['int', 'long', 'double'], minimum: 1 },
    },
    variants: [
      // A web upload carries no capture metadata.
      {
        properties: {
          source: oneOf(['web_upload']),
          ...Object.fromEntries(Object.keys(MOBILE_CAPTURE_FIELD_RULES).map((field) => [field, { bsonType: 'null' }])),
        },
      },
      // A mobile capture is always a JPEG and always carries all of it.
      {
        required: Object.keys(MOBILE_CAPTURE_FIELD_RULES),
        properties: { source: oneOf(['mobile_capture']), mime_type: oneOf(['image/jpeg']), ...MOBILE_CAPTURE_FIELD_RULES },
      },
    ],
    indexes: [
      { key: { component_id: 1, uploaded_at: -1 }, name: 'component_uploaded_at' },
      { key: { storage_path: 1 }, name: 'storage_path_unique', unique: true },
      {
        key: { component_id: 1, sha256: 1 },
        name: MOBILE_CAPTURE_SHA256_INDEX,
        unique: true,
        partialFilterExpression: { source: 'mobile_capture' },
      },
    ],
  },
  app_metadata: {
    // `_id` is the value's name, e.g. 'master_data'. Read by `_id` only, so no indexes.
    primaryKey: 'key',
    hasInsertOrder: false,
    notNull: ['updated_at'],
    // An ISO 8601 string, never a BSON date: the API returns it verbatim as `string | null`.
    checks: { updated_at: { bsonType: 'string' } },
    indexes: [],
  },
};

/** NOT NULL → present and not null; CHECK → the per-field rule. */
function buildValidator(spec: CollectionSpec): Document {
  const properties: Record<string, Document> = {};

  for (const field of spec.notNull) {
    properties[field] = { not: { bsonType: 'null' } };
  }

  for (const [field, rule] of Object.entries(spec.checks ?? {})) {
    properties[field] = properties[field] ? { allOf: [properties[field], rule] } : rule;
  }

  const jsonSchema: Document = { bsonType: 'object', required: [...spec.notNull], properties };

  if (spec.variants) {
    jsonSchema.oneOf = [...spec.variants];
  }

  return { $jsonSchema: jsonSchema };
}

/**
 * Creates missing collections, (re)applies every validator and ensures every index.
 * On an existing database `collMod` replaces each validator (existing documents are
 * not re-checked) and `createIndexes` adds any index that is new — so a widened rule
 * or a new index reaches a deployment on its next start, with no migration.
 */
export async function applySchema(db: Db): Promise<void> {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name),
  );

  for (const name of COLLECTION_NAMES) {
    const spec = COLLECTIONS[name];
    const validator = buildValidator(spec);

    if (existing.has(name)) {
      await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
    } else {
      await db.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
    }

    // `createIndexes` rejects an empty list.
    if (spec.indexes.length > 0) {
      await db.collection(name).createIndexes([...spec.indexes]);
    }
  }
}

/**
 * A SQLite-shaped row → the document stored for it: primary key moved to `_id`,
 * everything else unchanged. Used by the seed migration and the SQLite copy script.
 */
export function toDocument(name: CollectionName, row: Readonly<Record<string, unknown>>): Document {
  const { primaryKey, hasInsertOrder } = COLLECTIONS[name];
  const { [primaryKey]: key, ...fields } = row;

  return hasInsertOrder ? { _id: key, ...fields, insert_order: new ObjectId() } : { _id: key, ...fields };
}
