/**
 * db.js — IndexedDB layer for history records.
 *
 * Schema (database `ocr-db`, store `records`):
 *   { id (auto), createdAt, image (dataURL), name, size, type, w, h,
 *     prompt, model, effort, text, usage, durationMs }
 *
 * `id` is the auto-increment primary key; `createdAt` is indexed.
 */

const DB_NAME = 'ocr-db';
const STORE   = 'records';

let _dbPromise;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('createdAt', 'createdAt');
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
  });
  return _dbPromise;
}

async function dbOp(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Insert one record. Returns the new auto-generated id. */
export const dbAdd = (record) => dbOp('readwrite', (s) => s.add(record));

/** Return all records, newest first (sorted by createdAt desc). */
export const dbAll = () =>
  dbOp('readonly', (s) => s.getAll()).then((rows) =>
    rows.sort((x, y) => y.createdAt - x.createdAt)
  );

/** Delete one record by id. */
export const dbDelete = (id) => dbOp('readwrite', (s) => s.delete(id));

/** Wipe the store. */
export const dbClear = () => dbOp('readwrite', (s) => s.clear());
