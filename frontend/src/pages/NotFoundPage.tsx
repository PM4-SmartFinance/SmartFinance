import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-2xl font-bold tracking-wide mb-1">
            {t("login.brand", "⬡ SmartFinance")}
          </div>
          <CardTitle className="text-xl">{t("404.title", "404 - Page Not Found")}</CardTitle>
          <CardDescription>
            {t("404.description", "The page you are looking for does not exist or has been moved.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/" className={buttonVariants({ size: "lg", className: "w-full" })}>
            {t("404.homepage", "Go to homepage")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
