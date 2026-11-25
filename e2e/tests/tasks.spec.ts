import { listTasks } from "../support/api";
import { expect, test } from "../support/fixtures";

test.describe("任务清单", () => {
  test("通过页面创建任务后，API 也能读到", async ({ page, api, runId }) => {
    const title = `${runId}-create`;

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "任务清单" })).toBeVisible();

    await page.getByLabel("新任务").fill(title);
    await page.getByRole("button", { name: "添加任务" }).click();
    await expect(page.getByText(title)).toBeVisible();

    const tasks = await listTasks(api);
    expect(tasks.some((task) => task.title === title)).toBe(true);
  });

  test("完成任务并删除", async ({ page, runId }) => {
    const title = `${runId}-toggle`;

    await page.goto("/");
    await page.getByLabel("新任务").fill(title);
    await page.getByRole("button", { name: "添加任务" }).click();

    const item = page.locator("li", { hasText: title });
    const checkbox = item.getByRole("checkbox");
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    await item.getByRole("button", { name: `删除「${title}」` }).click();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("超长标题给出提示并禁用提交", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("新任务").fill("x".repeat(121));

    await expect(page.getByText(/最多 120 个字符/)).toBeVisible();
    await expect(page.getByRole("button", { name: "添加任务" })).toBeDisabled();
  });
});
