import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { AuthProvider } from "./contexts/AuthProvider";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
