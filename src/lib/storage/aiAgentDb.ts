import { AgentMessage } from "@/types/aiAgent";

const DB_NAME = "mimi_ai_agent_db_v1";
const STORE_NAME = "sessions_messages";
const DB_VERSION = 1;

// SSR / 测试环境内存备用沙盒
const memoryStore = new Map<string, AgentMessage[]>();

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error("IndexedDB is not supported"));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

export const aiAgentDb = {
  async getSessionMessages(sessionId: string): Promise<AgentMessage[] | null> {
    const idb = getIndexedDB();
    if (!idb) {
      return memoryStore.get(sessionId) || null;
    }

    try {
      const db = await openDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(sessionId);

        req.onsuccess = () => {
          if (req.result && Array.isArray(req.result.messages)) {
            resolve(req.result.messages);
          } else {
            resolve(memoryStore.get(sessionId) || null);
          }
        };

        req.onerror = () => {
          resolve(memoryStore.get(sessionId) || null);
        };
      });
    } catch {
      return memoryStore.get(sessionId) || null;
    }
  },

  async saveSessionMessages(sessionId: string, messages: AgentMessage[]): Promise<void> {
    memoryStore.set(sessionId, messages);

    const idb = getIndexedDB();
    if (!idb) return;

    try {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ sessionId, messages, updatedAt: Date.now() });

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // 容灾静默降级至内存缓存
    }
  },

  async deleteSessionMessages(sessionId: string): Promise<void> {
    memoryStore.delete(sessionId);

    const idb = getIndexedDB();
    if (!idb) return;

    try {
      const db = await openDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(sessionId);

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // 忽略异常
    }
  },

  async clearAllSessionMessages(): Promise<void> {
    memoryStore.clear();

    const idb = getIndexedDB();
    if (!idb) return;

    try {
      const db = await openDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // 忽略异常
    }
  },
};
