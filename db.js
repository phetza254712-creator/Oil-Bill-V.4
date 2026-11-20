const DB_NAME = "oilbill-v3";
const STORE = "receipts";
const META = "meta";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("receipt_id", "receipt_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function request(mode, store, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = action(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}
export const getAll = () => request("readonly", STORE, s => s.getAll());
export const put = value => request("readwrite", STORE, s => s.put(value));
export const remove = id => request("readwrite", STORE, s => s.delete(id));
export async function replaceAll(rows) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const s = tx.objectStore(STORE);
    s.clear();
    rows.forEach(r => s.put(r));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}