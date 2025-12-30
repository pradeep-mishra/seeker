import { Outlet } from "react-router-dom";
import { useUIStore } from "../../stores/uiStore";
import { AboutDialog } from "../dialogs/AboutDialog";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { isSidebarOpen } = useUIStore();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      {/* Header */}
      <Header />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden w-full md:w-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Dialogs */}
      <AboutDialog />
    </div>
  );
}
