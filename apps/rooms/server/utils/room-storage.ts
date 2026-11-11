import { DatabaseSync } from 'node:sqlite'
import * as v from 'valibot'
import { storedRoom } from '@m-part/listen-core/protocol'
import type { StoredRoom } from '@m-part/listen-core/protocol'

export interface RoomStorage {
  load: () => StoredRoom[]
  save: (room: StoredRoom) => void
  remove: (code: string) => void
}

export function openRoomStorage(path: string) {
  const db = new DatabaseSync(path)
  db.exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL) STRICT')
  const read = db.prepare('SELECT data FROM rooms')
  const write = db.prepare('INSERT INTO rooms (code, data) VALUES (?, ?) ON CONFLICT (code) DO UPDATE SET data = excluded.data')
  const remove = db.prepare('DELETE FROM rooms WHERE code = ?')
  return {
    load: () => read.all().map(row => v.parse(storedRoom, JSON.parse(String(row.data)))),
    save: (room: StoredRoom) => { write.run(room.code, JSON.stringify(room)) },
    remove: (code: string) => { remove.run(code) },
    close: () => db.close(),
  }
}
