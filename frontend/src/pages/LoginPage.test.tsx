import { render, screen } from "@testing-library/react";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("renders the login heading", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
  });
});
