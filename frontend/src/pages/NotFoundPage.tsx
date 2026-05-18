import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t("404.title", "404 - Page Not Found")}</h1>
      <Link to="/">{t("404.homepage", "Go to homepage")}</Link>
    </main>
  );
}
