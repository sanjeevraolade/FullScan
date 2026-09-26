import { AsyncLocalStorage } from 'node:async_hooks';
import { MongoClient, type ClientSession, type Collection, type Db, type Document } from 'mongodb';
import { logger } from '../utils/logger.js';
import { applySchema, type CollectionName } from './schema.js';
import { runMigrations } from './migrations/index.js';

/** A single-node replica set on localhost — what `npm run db:dev` starts. */
const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const DEFAULT_MONGODB_DB = 'fullscan';

let client: MongoClient | undefined;
let db: Db | undefined;

/** The session of the transaction the current async call chain is running in, if any. */
const transactionSession = new AsyncLocalStorage<ClientSession>();

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

function getClient(): MongoClient {
  if (!client) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return client;
}

/** Every collection keys its documents by the string primary key the SQLite row had. */
export type StringKeyedDocument = Document & { _id: string };

export function getCollection<TSchema extends Document = StringKeyedDocument>(
  name: CollectionName,
): Collection<TSchema> {
  return getDb().collection<TSchema>(name);
}

/**
 * Spread into the options of every driver call: inside `runInTransaction` it adds the
 * transaction's session, outside it adds nothing. This is what lets a DAO function be
 * called both on its own and as one step of a transaction, as it could under SQLite.
 */
export function sessionOption(): { session?: ClientSession } {
  const session = transactionSession.getStore();
  return session ? { session } : {};
}

/**
 * Runs `work` in one MongoDB transaction: it commits if `work` resolves, and rolls
 * back if it throws — an `AppError` included. A call made while already inside a
 * transaction joins it.
 *
 * The driver retries `work` on a transient error (e.g. a write conflict with a
 * concurrent request), so `work` must be safe to run again from the start. Steps
 * inside `work` must run one after another — a session cannot run operations in parallel.
 */
export async function runInTransaction<T>(work: () => Promise<T>): Promise<T> {
  if (transactionSession.getStore()) {
    return work();
  }

  const session = getClient().startSession();

  try {
    return await session.withTransaction(() => transactionSession.run(session, work), {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } finally {
    await session.endSession();
  }
}

/** Transactions need a replica set (or a sharded cluster); a standalone mongod has neither. */
async function assertTransactionsSupported(database: Db): Promise<void> {
  const hello = await database.admin().command({ hello: 1 });

  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error(
      'MongoDB is running standalone, but FullScanServer needs transactions. Run it as a replica set ' +
        '(`npm run db:dev` starts one locally) or point MONGODB_URI at MongoDB Atlas.',
    );
  }
}

/** The URI with any credentials masked, for logging. */
export function redactUri(uri: string): string {
  return uri.replace(/\/\/[^@/]*@/, '//***@');
}

/** Where to connect — read at call time, so tests and scripts can set the env first. */
export function getMongoConfig(): { readonly uri: string; readonly dbName: string } {
  return {
    uri: process.env.MONGODB_URI || DEFAULT_MONGODB_URI,
    dbName: process.env.MONGODB_DB || DEFAULT_MONGODB_DB,
  };
}

/** Connects, applies the schema (collections, validators, indexes) and runs pending migrations. */
export async function initDb(): Promise<void> {
  const { uri, dbName } = getMongoConfig();

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  await assertTransactionsSupported(db);
  await applySchema(db);
  await runMigrations(client, db);

  logger.info(`Database initialized: ${dbName} at ${redactUri(uri)}`);
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = undefined;
  db = undefined;
}
