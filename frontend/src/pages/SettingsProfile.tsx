import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const LOGOUT_REDIRECT_DELAY_MS = 1500;
import { api, ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, User, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

const PROFILE_QUERY = {
  queryKey: ["users", "me"] as const,
  queryFn: () => api.get<{ user: ProfileData }>("/users/me"),
} as const;

export function SettingsProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending: isProfileLoading, isError: isProfileError } = useQuery(PROFILE_QUERY);
  const profile = data?.user;

  const [profileSuccess, setProfileSuccess] = useState(false);

  const { t } = useTranslation();

  const {
    mutate: saveProfile,
    isPending: isSaving,
    error: profileError,
  } = useMutation({
    mutationFn: (input: { displayName: string; email: string }) =>
      api.patch<{ user: ProfileData }>("/users/me", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setProfileSuccess(true);
    },
    onError: () => setProfileSuccess(false),
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const {
    mutate: changePassword,
    isPending: isChanging,
    error: passwordError,
  } = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post<{ ok: boolean }>("/users/me/change-password", input),
    onSuccess: () => {
      setPasswordSuccess(true);
      // Server has already deleted the session; the login page refetches
      // /auth/me on mount and the auth guard will treat the cleared cookie as
      // anonymous — no need to invalidate the cache here.
      setTimeout(() => navigate("/login"), LOGOUT_REDIRECT_DELAY_MS);
    },
    onError: () => setPasswordSuccess(false),
  });

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileSuccess(false);
    const fd = new FormData(e.currentTarget);
    saveProfile({
      displayName: String(fd.get("displayName") ?? ""),
      email: String(fd.get("email") ?? ""),
    });
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setConfirmError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setConfirmError(t("settingsProfile.errors.passwordsMismatch", "New passwords do not match."));
      return;
    }
    changePassword({ currentPassword, newPassword });
  }

  const profileErrorMessage =
    profileError instanceof ApiError
      ? profileError.message
      : profileError
        ? t("errors.generic", "Something went wrong. Please try again.")
        : null;

  const passwordErrorMessage =
    passwordError instanceof ApiError
      ? passwordError.message
      : passwordError
        ? t("errors.generic", "Something went wrong. Please try again.")
        : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {isProfileLoading ? (
          <>
            <Skeleton className="size-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </>
        ) : isProfileError ? (
          <h2 className="text-4xl font-bold text-foreground">
            {t("settingsProfile.heading", "Profile")}
          </h2>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-4xl font-bold text-foreground">
                  {profile?.name ?? profile?.email ?? t("settingsProfile.heading", "Profile")}
                </h2>
                {profile?.role && (
                  <Badge variant="secondary" className="capitalize">
                    {profile.role === "ADMIN"
                      ? t("common.roles.admin", "Admin")
                      : t("common.roles.user", "User")}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">
                {t("settingsProfile.account.title", "Account information")}
              </CardTitle>
            </div>
            <CardDescription>
              {t(
                "settingsProfile.account.description",
                "Update your display name and email address.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isProfileLoading ? (
              <div className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <Skeleton className="h-9 w-28" />
              </div>
            ) : isProfileError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  {t(
                    "settingsProfile.account.loadFailed",
                    "Failed to load your profile. Please refresh the page.",
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <form
                key={`${profile?.id ?? "new"}:${profile?.email ?? ""}:${profile?.name ?? ""}`}
                onSubmit={handleProfileSubmit}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="display-name">
                    {t("settingsProfile.account.displayNameLabel", "Display name")}
                  </Label>
                  <Input
                    id="display-name"
                    name="displayName"
                    type="text"
                    defaultValue={profile?.name ?? ""}
                    placeholder={t("settingsProfile.account.displayNamePlaceholder", "Your name")}
                    autoComplete="name"
                    onChange={() => setProfileSuccess(false)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="profile-email">
                    {t("settingsProfile.account.emailLabel", "Email address")}
                  </Label>
                  <Input
                    id="profile-email"
                    name="email"
                    type="email"
                    defaultValue={profile?.email ?? ""}
                    required
                    autoComplete="email"
                    onChange={() => setProfileSuccess(false)}
                  />
                </div>

                {profileErrorMessage && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{profileErrorMessage}</AlertDescription>
                  </Alert>
                )}
                {profileSuccess && (
                  <Alert variant="success" role="status">
                    <CheckCircle2 className="size-4" />
                    <AlertDescription>
                      {t("settingsProfile.account.success", "Profile updated successfully.")}
                    </AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={isSaving} className="self-start">
                  {isSaving
                    ? t("settingsProfile.account.saving", "Saving…")
                    : t("settingsProfile.account.saveBtn", "Save changes")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">
                {t("settingsProfile.password.title", "Change password")}
              </CardTitle>
            </div>
            <CardDescription>
              {t(
                "settingsProfile.password.description",
                "Enter your current password before setting a new one. You will be signed out after a successful change.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-password">
                  {t("settingsProfile.password.currentLabel", "Current password")}
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  required
                  autoComplete="current-password"
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">
                  {t("settingsProfile.password.newLabel", "New password")}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">
                  {t("settingsProfile.password.confirmLabel", "Confirm new password")}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  required
                  autoComplete="new-password"
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setConfirmError(null);
                  }}
                />
              </div>

              {(confirmError ?? passwordErrorMessage) && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{confirmError ?? passwordErrorMessage}</AlertDescription>
                </Alert>
              )}
              {passwordSuccess && (
                <Alert variant="success" role="status">
                  <CheckCircle2 className="size-4" />
                  <AlertDescription>
                    {t(
                      "settingsProfile.password.success",
                      "Password changed. Please sign in again.",
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" variant="outline" disabled={isChanging} className="self-start">
                {isChanging
                  ? t("settingsProfile.password.changing", "Changing…")
                  : t("settingsProfile.password.changeBtn", "Change password")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
