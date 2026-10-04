import type { ClientSession, Db } from 'mongodb';
import { bumpMasterDataVersion } from './master-data-version.js';
import type { Migration } from './index.js';

/**
 * Records the first master-data version (`app_metadata` `master_data`), so login and
 * `GET /master-data` return a value from now on. An existing database gets one on its
 * next start; a new one gets it right after `001` seeds the master data.
 */
export const initMasterDataVersion: Migration = {
  name: '002_init_master_data_version',

  async up(db: Db, session: ClientSession): Promise<void> {
    await bumpMasterDataVersion(db, session);
  },
};
