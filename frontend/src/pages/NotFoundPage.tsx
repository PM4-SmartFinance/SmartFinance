import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main>
      <h1>404 - Page Not Found</h1>
      <Link to="/">Go to homepage</Link>
    </main>
  );
}
