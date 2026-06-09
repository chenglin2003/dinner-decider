// js/sync.js
// Firebase Realtime Database helpers for room sync.
// Uses the global window._firebase injected by index.html.

function db() { return window._firebase.db; }
function fbRef(path) { return window._firebase.ref(db(), path); }

/** Write an entire room object */
export async function createRoom(code, data) {
  await window._firebase.set(fbRef(`rooms/${code}`), data);
}

/** Read a room once */
export async function getRoom(code) {
  const snap = await window._firebase.get(fbRef(`rooms/${code}`));
  return snap.exists() ? snap.val() : null;
}

/** Patch specific fields into a room */
export async function updateRoom(code, patch) {
  await window._firebase.update(fbRef(`rooms/${code}`), patch);
}

/**
 * Subscribe to room changes in real-time.
 * Returns an unsubscribe function.
 */
export function subscribeRoom(code, callback) {
  const r = fbRef(`rooms/${code}`);
  const unsub = window._firebase.onValue(r, snap => {
    callback(snap.exists() ? snap.val() : null);
  });
  return unsub;
}

/** Generate a readable 4-character room code */
export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0 or I/1 confusion
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
