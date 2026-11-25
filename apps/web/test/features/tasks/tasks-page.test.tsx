import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TasksPage } from "@/features/tasks/tasks-page";

interface MockTask {
  id: string;
  title: string;
  completed: boolean;
}

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  create: vi.fn(async (_title: string) => true),
  setCompleted: vi.fn(),
  remove: vi.fn(),
  tasks: null as MockTask[] | null,
  pending: false,
  error: null as string | null
}));

vi.mock("@/features/tasks/use-tasks", () => ({
  useTasks: () => ({
    tasks: mocks.tasks,
    pending: mocks.pending,
    error: mocks.error,
    refresh: mocks.refresh,
    create: mocks.create,
    setCompleted: mocks.setCompleted,
    remove: mocks.remove
  })
}));

beforeEach(() => {
  mocks.tasks = [];
  mocks.pending = false;
  mocks.error = null;
});

describe("TasksPage", () => {
  it("renders tasks and the completion summary", () => {
    mocks.tasks = [
      { id: "1", title: "写测试", completed: false },
      { id: "2", title: "喝咖啡", completed: true }
    ];

    render(<TasksPage />);

    expect(screen.getByRole("heading", { name: "任务清单" })).toBeInTheDocument();
    expect(screen.getByText("写测试")).toBeInTheDocument();
    expect(screen.getByText("共 2 项，已完成 1 项")).toBeInTheDocument();
  });

  it("renders the empty state", () => {
    render(<TasksPage />);

    expect(screen.getByText("暂无任务。")).toBeInTheDocument();
  });

  it("renders the loading state", () => {
    mocks.tasks = null;
    mocks.pending = true;

    render(<TasksPage />);

    expect(screen.getByText("正在读取任务…")).toBeInTheDocument();
  });

  it("renders request errors as an alert", () => {
    mocks.error = "无法读取任务，请检查 API 是否运行后重试。";

    render(<TasksPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("无法读取任务");
  });

  it("submits the trimmed title and clears the input", async () => {
    const user = userEvent.setup();
    render(<TasksPage />);

    await user.type(screen.getByLabelText("新任务"), "  新任务  ");
    await user.click(screen.getByRole("button", { name: "添加任务" }));

    expect(mocks.create).toHaveBeenCalledWith("新任务");
    expect(screen.getByLabelText("新任务")).toHaveValue("");
  });

  it("shows validation feedback for long titles", async () => {
    const user = userEvent.setup();
    render(<TasksPage />);

    await user.click(screen.getByLabelText("新任务"));
    await user.paste("x".repeat(121));

    expect(screen.getByText(/最多 120 个字符/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加任务" })).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("toggles and removes tasks through the callbacks", async () => {
    const user = userEvent.setup();
    mocks.tasks = [{ id: "1", title: "写测试", completed: false }];
    render(<TasksPage />);

    await user.click(screen.getByRole("checkbox"));
    expect(mocks.setCompleted).toHaveBeenCalledWith("1", true);

    await user.click(screen.getByRole("button", { name: "删除「写测试」" }));
    expect(mocks.remove).toHaveBeenCalledWith("1");
  });
});
