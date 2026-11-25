import { TASK_TITLE_MAX_LENGTH } from "@best-ts/shared";
import { ListTodoIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTasks } from "./use-tasks";

export function TasksPage() {
  const { tasks, pending, error, refresh, create, setCompleted, remove } = useTasks();
  const [draft, setDraft] = useState("");
  const title = draft.trim();
  const titleTooLong = Array.from(title).length > TASK_TITLE_MAX_LENGTH;
  const canSubmit = tasks !== null && !pending && title.length > 0 && !titleTooLong;
  const completed = tasks?.filter((task) => task.completed).length ?? 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit && (await create(title))) {
      setDraft((current) => (current === draft ? "" : current));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-20">
      <header className="mb-8 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
          <ListTodoIcon className="size-5" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">任务清单</h1>
      </header>

      <section
        aria-label="任务管理"
        className="rounded-xl border bg-card text-card-foreground shadow-xs"
      >
        <form onSubmit={submit} className="border-b p-4 sm:p-6">
          <label htmlFor="task-title" className="mb-2 block text-sm font-medium">
            新任务
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="task-title"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="输入任务名称"
              aria-invalid={titleTooLong || undefined}
              aria-describedby={titleTooLong ? "task-title-error" : undefined}
              required
              className="h-10"
            />
            <Button type="submit" size="lg" disabled={!canSubmit}>
              <PlusIcon aria-hidden="true" />
              添加任务
            </Button>
          </div>
          {titleTooLong && (
            <p id="task-title-error" className="mt-2 text-sm text-destructive">
              任务名称最多 {TASK_TITLE_MAX_LENGTH} 个字符。
            </p>
          )}
        </form>

        <section aria-labelledby="task-list-heading">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <h2 id="task-list-heading" className="font-semibold">
                全部任务
              </h2>
              {tasks !== null && (
                <output className="block text-sm text-muted-foreground">
                  共 {tasks.length} 项，已完成 {completed} 项
                </output>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => void refresh()}
            >
              <RefreshCwIcon aria-hidden="true" />
              刷新
            </Button>
          </div>

          {error && (
            <p
              role="alert"
              className="mx-4 mb-4 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive sm:mx-6"
            >
              {error}
            </p>
          )}
          {tasks === null && pending && (
            <output className="block px-4 pb-6 text-sm text-muted-foreground sm:px-6">
              正在读取任务…
            </output>
          )}
          {tasks?.length === 0 && (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
              暂无任务。
            </p>
          )}

          {!!tasks?.length && (
            <ul className="divide-y border-t">
              {tasks.map((task) => (
                <li key={task.id} className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-6">
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={task.completed}
                    disabled={pending}
                    onCheckedChange={(checked) => void setCompleted(task.id, checked === true)}
                    className="size-6"
                  />
                  <label
                    htmlFor={`task-${task.id}`}
                    className={cn(
                      "min-w-0 flex-1 wrap-anywhere text-sm",
                      task.completed && "text-muted-foreground line-through"
                    )}
                  >
                    {task.title}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`删除「${task.title}」`}
                    disabled={pending}
                    onClick={() => void remove(task.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
