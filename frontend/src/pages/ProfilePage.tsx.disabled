import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SeparatorLine } from "@/components/ui/separatorLine";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, AlertCircle, ChevronLeft, User, Lock } from "lucide-react";

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

const TEXT = {
  backToDashboard: "Dashboard",
  pageTitle: "Profile",
  pageDescription: "Manage your account details",
  profileCard: {
    title: "Account information",
    description: "Update your display name and email address.",
    nameLabel: "Display name",
    namePlaceholder: "Your name",
    emailLabel: "Email address",
    saveBtn: "Save changes",
    savingBtn: "Saving…",
    successMsg: "Profile updated successfully.",
  },
  passwordCard: {
    title: "Change password",
    description:
      "Enter your current password before setting a new one. You will be signed out after a successful change.",
    currentLabel: "Current password",
    newLabel: "New password",
    confirmLabel: "Confirm new password",
    changeBtn: "Change password",
    changingBtn: "Changing…",
    successMsg: "Password changed. Please sign in again.",
    mismatchError: "New passwords do not match.",
  },
  genericError: "Something went wrong. Please try again.",
  fetchError: "Failed to load your profile. Please refresh the page.",
} as const;

function getInitials(name: string | null | undefined, email: string | undefined): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email?.[0]?.toUpperCase() ?? "U";
}

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending: isProfileLoading, isError: isProfileError } = useQuery(PROFILE_QUERY);
  const profile = data?.user;

  // ── Profile form state ─────────────────────────────────────────────────────
  const [profileSuccess, setProfileSuccess] = useState(false);

  const {
    mutate: saveProfile,
    isPending: isSaving,
    error: profileError,
  } = useMutation({
    mutationFn: (data: { displayName: string; email: string }) =>
      api.patch<{ user: ProfileData }>("/users/me", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setProfileSuccess(true);
    },
    onError: () => setProfileSuccess(false),
  });

  // ── Password form state ────────────────────────────────────────────────────
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
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post<{ ok: boolean }>("/users/me/change-password", data),
    onSuccess: async () => {
      setPasswordSuccess(true);
      // Session was deleted on the server — clear client state and redirect
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setTimeout(() => navigate("/login"), 1500);
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
      setConfirmError(TEXT.passwordCard.mismatchError);
      return;
    }
    changePassword({ currentPassword, newPassword });
  }

  const profileErrorMessage =
    profileError instanceof ApiError
      ? profileError.message
      : profileError
        ? TEXT.genericError
        : null;

  const passwordErrorMessage =
    passwordError instanceof ApiError
      ? passwordError.message
      : passwordError
        ? TEXT.genericError
        : null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="size-4" />
          {TEXT.backToDashboard}
        </Link>

        {/* ── Page header with avatar ── */}
        <header className="mb-8 flex items-center gap-4">
          {isProfileLoading ? (
            <>
              <Skeleton className="size-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </>
          ) : isProfileError ? (
            <h1 className="text-2xl font-bold text-foreground">{TEXT.pageTitle}</h1>
          ) : (
            <>
              <Avatar className="size-14">
                <AvatarFallback className="text-lg font-semibold">
                  {getInitials(profile?.name, profile?.email)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {profile?.name ?? profile?.email ?? TEXT.pageTitle}
                  </h1>
                  {profile?.role && (
                    <Badge variant="secondary" className="capitalize">
                      {profile.role}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </>
          )}
        </header>

        <div className="flex flex-col gap-6">
          {/* ── Profile info form ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{TEXT.profileCard.title}</CardTitle>
              </div>
              <CardDescription>{TEXT.profileCard.description}</CardDescription>
            </CardHeader>
            <SeparatorLine />
            <CardContent className="pt-6">
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
                  <AlertDescription>{TEXT.fetchError}</AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="display-name">{TEXT.profileCard.nameLabel}</Label>
                    <Input
                      id="display-name"
                      name="displayName"
                      type="text"
                      defaultValue={profile?.name ?? ""}
                      placeholder={TEXT.profileCard.namePlaceholder}
                      autoComplete="name"
                      onChange={() => setProfileSuccess(false)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-email">{TEXT.profileCard.emailLabel}</Label>
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
                    <Alert
                      role="status"
                      className="border-green-500/50 text-green-700 dark:text-green-400 [&>svg]:text-green-600"
                    >
                      <CheckCircle2 className="size-4" />
                      <AlertDescription>{TEXT.profileCard.successMsg}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={isSaving} className="self-start">
                    {isSaving ? TEXT.profileCard.savingBtn : TEXT.profileCard.saveBtn}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* ── Change password form ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{TEXT.passwordCard.title}</CardTitle>
              </div>
              <CardDescription>{TEXT.passwordCard.description}</CardDescription>
            </CardHeader>
            <SeparatorLine />
            <CardContent className="pt-6">
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="current-password">{TEXT.passwordCard.currentLabel}</Label>
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
                  <Label htmlFor="new-password">{TEXT.passwordCard.newLabel}</Label>
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
                  <Label htmlFor="confirm-password">{TEXT.passwordCard.confirmLabel}</Label>
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
                  <Alert
                    role="status"
                    className="border-green-500/50 text-green-700 dark:text-green-400 [&>svg]:text-green-600"
                  >
                    <CheckCircle2 className="size-4" />
                    <AlertDescription>{TEXT.passwordCard.successMsg}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="outline"
                  disabled={isChanging}
                  className="self-start"
                >
                  {isChanging ? TEXT.passwordCard.changingBtn : TEXT.passwordCard.changeBtn}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
