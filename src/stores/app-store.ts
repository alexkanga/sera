import { create } from "zustand";

export type AppSection =
  | "dashboard"
  | "users"
  | "roles"
  | "permissions"
  | "audit-logs"
  | "directions"
  | "units"
  | "org-overview"
  | "strategic-axes"
  | "acbf-domains"
  | "acbf-deliverables"
  | "activities"
  | "pta-consolide"
  | "evidence"
  | "raci"
  | "gantt"
  | "performance"
  | "reports"
  | "notifications"
  | "audit-advanced"
  | "profile"
  | "change-password";

interface AppState {
  currentSection: AppSection;
  setCurrentSection: (section: AppSection) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentSection: "dashboard",
  setCurrentSection: (section) => set({ currentSection: section }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
