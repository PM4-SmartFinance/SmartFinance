import { useAppStore } from "../store/appStore";

export function LoginPage() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <main>
      <h1>Login</h1>
      <p>Login page placeholder</p>
      <button onClick={toggleSidebar}>
        Sidebar (demonstration of zustand store): {sidebarOpen ? "open" : "closed"}
      </button>
    </main>
  );
}
