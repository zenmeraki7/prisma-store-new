// utils/cursor.js
export function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
}