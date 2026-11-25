import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("toggles with the pointer", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="完成" />);

    const checkbox = screen.getByRole("checkbox", { name: "完成" });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("toggles with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="完成" />);

    await user.tab();
    const checkbox = screen.getByRole("checkbox", { name: "完成" });
    expect(checkbox).toHaveFocus();

    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="完成" disabled />);

    const checkbox = screen.getByRole("checkbox", { name: "完成" });
    await user.click(checkbox);

    expect(checkbox).not.toBeChecked();
  });
});
