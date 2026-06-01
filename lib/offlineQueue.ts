const DB_NAME = "finosuke-offline";
const STORE_NAME = "requests";
const DB_VERSION = 1;

export interface StoredRequest {
  id?: number;
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(request: {
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
}): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry: StoredRequest = { ...request, timestamp: Date.now() };
    const req = store.add(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function dequeue(): Promise<StoredRequest | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const cursorReq = store.openCursor();

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve(null);
        return;
      }
      const entry = cursor.value as StoredRequest;
      const deleteReq = cursor.delete();
      deleteReq.onsuccess = () => resolve(entry);
      deleteReq.onerror = () => reject(deleteReq.error);
    };

    cursorReq.onerror = () => reject(cursorReq.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getAll(): Promise<StoredRequest[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as StoredRequest[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
