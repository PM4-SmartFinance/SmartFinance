import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ModuleWidgetCard } from "./ModuleWidgetCard";
import type { RegisteredWidget } from "./ModuleWidgetCard";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn() },
  ApiError: class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown, message: string) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

const mockGet = vi.mocked(api.get);

const WIDGET: RegisteredWidget = {
  moduleId: "savings-goals",
  widgetId: "savings-goals-summary",
  title: "Savings Goals",
  dataEndpoint: "/modules/savings-goals/goals/widget",
};

function renderCard(widget: RegisteredWidget = WIDGET) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ModuleWidgetCard widget={widget} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ModuleWidgetCard", () => {
  it("renders the widget title", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderCard();
    expect(screen.getByText("Savings Goals")).toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderCard();
    // Skeletons render as divs with the animate-pulse class
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders the empty message when items is empty", async () => {
    mockGet.mockResolvedValue({
      items: [],
      emptyMessage: "No savings goals yet. Create your first goal!",
    });
    renderCard();
    await waitFor(() =>
      expect(screen.getByText("No savings goals yet. Create your first goal!")).toBeInTheDocument(),
    );
  });

  it("falls back to a generic empty message when emptyMessage is not provided", async () => {
    mockGet.mockResolvedValue({ items: [] });
    renderCard();
    await waitFor(() => expect(screen.getByText("No data available.")).toBeInTheDocument());
  });

  it("renders item labels", async () => {
    mockGet.mockResolvedValue({
      items: [
        { id: "g1", label: "Emergency Fund", detail: "1200.00 / 5000.00", progress: 24 },
        { id: "g2", label: "Vacation", detail: "800.00 / 2000.00", progress: 40 },
      ],
    });
    renderCard();
    await waitFor(() => expect(screen.getByText("Emergency Fund")).toBeInTheDocument());
    expect(screen.getByText("Vacation")).toBeInTheDocument();
  });

  it("renders item detail text", async () => {
    mockGet.mockResolvedValue({
      items: [{ id: "g1", label: "Emergency Fund", detail: "1200.00 / 5000.00", progress: 24 }],
    });
    renderCard();
    await waitFor(() => expect(screen.getByText("1200.00 / 5000.00")).toBeInTheDocument());
  });

  it("renders a progress bar with the correct percentage", async () => {
    mockGet.mockResolvedValue({
      items: [{ id: "g1", label: "Emergency Fund", detail: "2500.00 / 5000.00", progress: 50 }],
    });
    renderCard();
    await waitFor(() => {
      const progressbar = screen.getByRole("progressbar", { name: "Emergency Fund progress" });
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute("aria-valuenow", "50");
    });
  });

  it("does not render a progress bar when progress is undefined", async () => {
    mockGet.mockResolvedValue({
      items: [{ id: "g1", label: "Simple Item", detail: "some detail" }],
    });
    renderCard();
    await waitFor(() => expect(screen.getByText("Simple Item")).toBeInTheDocument());
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows an error message when the data fetch fails", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderCard();
    await waitFor(() =>
      expect(screen.getByText("Failed to load widget data.")).toBeInTheDocument(),
    );
  });

  it("calls api.get with the widget dataEndpoint", async () => {
    mockGet.mockResolvedValue({ items: [] });
    renderCard();
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith(WIDGET.dataEndpoint));
  });
});
