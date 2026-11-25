import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import type { Task } from "@best-ts/shared";

function readTask(row: Record<string, SQLOutputValue>): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    completed: row.completed === 1
  };
}

export function openTaskStore(dbPath: string) {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const database = new DatabaseSync(dbPath, { timeout: 5_000 });

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1))
      ) STRICT
    `);

    const list = database.prepare("SELECT id, title, completed FROM tasks ORDER BY rowid DESC");
    const insert = database.prepare("INSERT INTO tasks (id, title) VALUES (?, ?)");
    const update = database.prepare(
      "UPDATE tasks SET completed = ? WHERE id = ? RETURNING id, title, completed"
    );
    const remove = database.prepare("DELETE FROM tasks WHERE id = ?");

    return {
      list: () => list.all().map(readTask),
      create(title: string): Task {
        const id = randomUUID();
        insert.run(id, title);
        return { id, title, completed: false };
      },
      setCompleted(id: string, completed: boolean) {
        const row = update.get(Number(completed), id);
        return row ? readTask(row) : undefined;
      },
      remove: (id: string) => Number(remove.run(id).changes) === 1,
      close: () => database.close()
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
