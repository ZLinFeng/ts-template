import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TasksPage } from "@/features/tasks/tasks-page";
import "./app/styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing React root element");
}

createRoot(root).render(
  <StrictMode>
    <TasksPage />
  </StrictMode>
);
