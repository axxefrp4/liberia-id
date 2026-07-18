import Dexie, { Table } from 'dexie';

export interface OfflineAttendance {
  id?: number;
  national_id: string;
  student_name: string;
  status: 'present' | 'absent' | 'late';
  school_name: string;
  scanned_by: string;
  timestamp: number;
  synced: boolean;
}

export class LiberiaDatabase extends Dexie {
  offlineAttendance!: Table<OfflineAttendance>;

  constructor() {
    super('LiberiaIDDatabase');
    this.version(1).stores({
      offlineAttendance: '++id, national_id, synced, timestamp'
    });
  }

  async queueAttendance(record: Omit<OfflineAttendance, 'id' | 'synced'>) {
    return await this.offlineAttendance.add({
      ...record,
      synced: false,
      timestamp: Date.now()
    });
  }

  // FIXED: using filter() instead of where().equals() to avoid index key errors
  async getUnsynced() {
    return await this.offlineAttendance.filter(record => record.synced === false).toArray();
  }

  async markSynced(id: number) {
    await this.offlineAttendance.update(id, { synced: true });
  }

  async cleanSynced() {
    await this.offlineAttendance.where('synced').equals(true).delete();
  }
}

export const db = new LiberiaDatabase();
