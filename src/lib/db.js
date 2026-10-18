// Plain IndexedDB wrapper. Stores: entries (keyPath id) and kv (settings: 'meta', 'lists').
// Nothing here talks to the network.
const DB_NAME = 'nt-finance-capture'
const DB_VERSION = 1
let dbp = null

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbp
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })

export async function loadAll() {
  const db = await open()
  const tx = db.transaction(['entries', 'kv'])
  const [entries, meta, lists, snapshot] = await Promise.all([
    wrap(tx.objectStore('entries').getAll()),
    wrap(tx.objectStore('kv').get('meta')),
    wrap(tx.objectStore('kv').get('lists')),
    wrap(tx.objectStore('kv').get('snapshot')),
  ])
  return { entries, meta, lists, snapshot }
}
export async function putEntry(e) {
  const db = await open()
  const tx = db.transaction('entries', 'readwrite')
  tx.objectStore('entries').put(e)
  await done(tx)
}
export async function deleteEntries(ids) {
  const db = await open()
  const tx = db.transaction('entries', 'readwrite')
  ids.forEach((id) => tx.objectStore('entries').delete(id))
  await done(tx)
}
export async function setKv(key, value) {
  const db = await open()
  const tx = db.transaction('kv', 'readwrite')
  tx.objectStore('kv').put(value, key)
  await done(tx)
}
// Clear exported: delete entries and save the new export record in one transaction.
export async function deleteEntriesAndMeta(ids, meta) {
  const db = await open()
  const tx = db.transaction(['entries', 'kv'], 'readwrite')
  ids.forEach((id) => tx.objectStore('entries').delete(id))
  tx.objectStore('kv').put(meta, 'meta')
  await done(tx)
}
