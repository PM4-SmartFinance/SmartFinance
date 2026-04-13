import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, ArrowLeft, User, Lock } from "lucide-react";

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

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending: isProfileLoading, isError: isProfileError } = useQuery(PROFILE_QUERY);
  const profile = data?.user;

  const [profileSuccess, setProfileSuccess] = useState(false);

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
    onSuccess: async () => {
      setPasswordSuccess(true);
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
      setConfirmError("New passwords do not match.");
      return;
    }
    changePassword({ currentPassword, newPassword });
  }

  const profileErrorMessage =
    profileError instanceof ApiError
      ? profileError.message
      : profileError
        ? "Something went wrong. Please try again."
        : null;

  const passwordErrorMessage =
    passwordError instanceof ApiError
      ? passwordError.message
      : passwordError
        ? "Something went wrong. Please try again."
        : null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
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
              <h1 className="text-4xl font-bold text-foreground">Profile</h1>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-4xl font-bold text-foreground">
                      {profile?.name ?? profile?.email ?? "Profile"}
                    </h1>
                    {profile?.role && (
                      <Badge variant="secondary" className="capitalize">
                        {profile.role.toLowerCase()}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </>
            )}
          </div>
          <Link
            to="/"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </header>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Account information</CardTitle>
              </div>
              <CardDescription>Update your display name and email address.</CardDescription>
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
                    Failed to load your profile. Please refresh the page.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="display-name">Display name</Label>
                    <Input
                      id="display-name"
                      name="displayName"
                      type="text"
                      defaultValue={profile?.name ?? ""}
                      placeholder="Your name"
                      autoComplete="name"
                      onChange={() => setProfileSuccess(false)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-email">Email address</Label>
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
                      <AlertDescription>Profile updated successfully.</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={isSaving} className="self-start">
                    {isSaving ? "Saving\u2026" : "Save changes"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Change password</CardTitle>
              </div>
              <CardDescription>
                Enter your current password before setting a new one. You will be signed out after a
                successful change.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="current-password">Current password</Label>
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
                  <Label htmlFor="new-password">New password</Label>
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
                  <Label htmlFor="confirm-password">Confirm new password</Label>
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
                    <AlertDescription>Password changed. Please sign in again.</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="outline"
                  disabled={isChanging}
                  className="self-start"
                >
                  {isChanging ? "Changing\u2026" : "Change password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
