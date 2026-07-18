import { db } from './db';
import { supabase } from './supabaseClient';

export async function syncOfflineAttendance() {
  // Only run if online
  if (!navigator.onLine) {
    console.log('[Sync] Offline, skipping sync');
    return { synced: 0, errors: 0 };
  }

  const unsynced = await db.getUnsynced();
  if (unsynced.length === 0) {
    console.log('[Sync] No unsynced records');
    return { synced: 0, errors: 0 };
  }

  console.log(`[Sync] Syncing ${unsynced.length} records...`);
  let synced = 0;
  let errors = 0;

  for (const record of unsynced) {
    try {
      // 1. Find student ID from national_id
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('national_id', record.national_id)
        .single();

      if (studentError || !student) {
        console.error(`[Sync] Student not found: ${record.national_id}`);
        errors++;
        continue;
      }

      // 2. Insert attendance
      const { error: insertError } = await supabase
        .from('attendance')
        .insert({
          student_id: student.id,
          school_name: record.school_name,
          status: record.status,
          scanned_by: record.scanned_by,
          date: new Date(record.timestamp).toISOString().split('T')[0] // date only
        });

      if (insertError) {
        console.error(`[Sync] Insert failed: ${insertError.message}`);
        errors++;
      } else {
        await db.markSynced(record.id!);
        synced++;
      }
    } catch (err) {
      console.error(`[Sync] Error: ${err}`);
      errors++;
    }
  }

  // Clean up synced records
  await db.cleanSynced();
  console.log(`[Sync] Complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

// Listen for online events to trigger sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Network came back online, syncing...');
    syncOfflineAttendance();
  });
}
