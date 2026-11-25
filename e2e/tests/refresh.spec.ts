import { createTask } from "../support/api";
import { expect, test } from "../support/fixtures";

test("点击刷新后能看到通过 API 新建的任务", async ({ page, api, runId }) => {
  const title = `${runId}-refresh`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "任务清单" })).toBeVisible();
  await expect(page.getByRole("button", { name: "刷新" })).toBeEnabled();

  const task = await createTask(api, title);
  expect(task.title).toBe(title);

  await page.getByRole("button", { name: "刷新" }).click();
  await expect(page.getByText(title)).toBeVisible();
});
