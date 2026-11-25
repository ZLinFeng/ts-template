import { describe, expect, it } from "vitest";
import { openTaskStore } from "../../../src/features/tasks/store.ts";

describe("task store", () => {
  it("creates, lists and toggles tasks", () => {
    const store = openTaskStore(":memory:");

    try {
      expect(store.list()).toEqual([]);

      const first = store.create("first");
      const second = store.create("second");
      expect(store.list().map((task) => task.id)).toEqual([second.id, first.id]);

      expect(store.setCompleted(first.id, true)).toMatchObject({ id: first.id, completed: true });
      expect(store.setCompleted(first.id, false)).toMatchObject({
        id: first.id,
        completed: false
      });
      expect(store.setCompleted("missing", true)).toBeUndefined();
    } finally {
      store.close();
    }
  });

  it("removes tasks", () => {
    const store = openTaskStore(":memory:");

    try {
      const task = store.create("remove me");

      expect(store.remove(task.id)).toBe(true);
      expect(store.remove(task.id)).toBe(false);
      expect(store.list()).toEqual([]);
    } finally {
      store.close();
    }
  });
});
