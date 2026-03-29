import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  backToDashboard: "← Dashboard",
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
} as const;

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending: isProfileLoading } = useQuery(PROFILE_QUERY);
  const profile = data?.user;

  // ── Profile form state ─────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Populate form once profile loads
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayName(profile.name ?? "");
      setEmail(profile.email);
    }
  }, [profile]);

  const {
    mutate: saveProfile,
    isPending: isSaving,
    error: profileError,
  } = useMutation({
    mutationFn: () => api.patch<{ user: ProfileData }>("/users/me", { displayName, email }),
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
    mutationFn: () =>
      api.post<{ ok: boolean }>("/users/me/change-password", { currentPassword, newPassword }),
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
    saveProfile();
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setConfirmError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setConfirmError(TEXT.passwordCard.mismatchError);
      return;
    }
    changePassword();
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
        <div className="mb-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            {TEXT.backToDashboard}
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">{TEXT.pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{TEXT.pageDescription}</p>
        </header>

        <div className="flex flex-col gap-6">
          {/* ── Profile info form ── */}
          <Card>
            <CardHeader>
              <CardTitle>{TEXT.profileCard.title}</CardTitle>
              <CardDescription>{TEXT.profileCard.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {isProfileLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="display-name">{TEXT.profileCard.nameLabel}</Label>
                    <Input
                      id="display-name"
                      type="text"
                      value={displayName}
                      placeholder={TEXT.profileCard.namePlaceholder}
                      autoComplete="name"
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        setProfileSuccess(false);
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-email">{TEXT.profileCard.emailLabel}</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      value={email}
                      required
                      autoComplete="email"
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setProfileSuccess(false);
                      }}
                    />
                  </div>

                  {profileErrorMessage && (
                    <p role="alert" className="text-sm text-destructive">
                      {profileErrorMessage}
                    </p>
                  )}
                  {profileSuccess && (
                    <p role="status" className="text-sm text-green-600 dark:text-green-400">
                      {TEXT.profileCard.successMsg}
                    </p>
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
              <CardTitle>{TEXT.passwordCard.title}</CardTitle>
              <CardDescription>{TEXT.passwordCard.description}</CardDescription>
            </CardHeader>
            <CardContent>
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

                {confirmError && (
                  <p role="alert" className="text-sm text-destructive">
                    {confirmError}
                  </p>
                )}
                {passwordErrorMessage && (
                  <p role="alert" className="text-sm text-destructive">
                    {passwordErrorMessage}
                  </p>
                )}
                {passwordSuccess && (
                  <p role="status" className="text-sm text-green-600 dark:text-green-400">
                    {TEXT.passwordCard.successMsg}
                  </p>
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
