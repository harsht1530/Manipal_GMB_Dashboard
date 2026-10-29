import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle, CheckCircle2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  useGoogleConnection,
  useDisconnectGoogle,
  useRunSync,
  startGoogleConnect,
} from "@/hooks/useRealtimeData";
import { GoogleLogo } from "@/components/GoogleLogo";


/**
 * The single Google mailbox the realtime dashboard syncs from. Only one connection is allowed
 * at a time - connecting a different account replaces the current one.
 */
export const GoogleConnectionCard = ({ userEmail }: { userEmail?: string }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const connection = useGoogleConnection(true);
  const disconnect = useDisconnectGoogle();
  const runSync = useRunSync();

  // The OAuth callback sends the browser back here with the result.
  useEffect(() => {
    const status = searchParams.get("google");
    if (!status) return;
    if (status === "connected") {
      toast.success("Google account connected. The first 6-month sync has started.");
    } else {
      toast.error(searchParams.get("message") || "Could not connect the Google account.");
    }
    searchParams.delete("google");
    searchParams.delete("message");
    setSearchParams(searchParams, { replace: true });
    connection.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = connection.data;
  const syncing = data?.sync?.status === "running";
  const syncProgress = data?.sync?.total ? Math.round((data.sync.processed / data.sync.total) * 100) : 0;

  const syncLabel = (() => {
    const sync = data?.sync;
    if (sync?.phase === "profiles") return `Reading profiles from Google… ${(sync.profilesSynced ?? 0).toLocaleString("en-IN")} so far`;
    if (sync?.phase === "verification") return `Checking verification status… ${sync.processed ?? 0} of ${sync.total ?? 0}`;
    if (sync?.phase === "updates") return `Checking Google updates… ${sync.processed ?? 0} of ${sync.total ?? 0}`;
    if (sync?.phase === "performance") return `Reading performance data… ${sync.processed ?? 0} of ${sync.total ?? 0} profiles`;
    return "Starting…";
  })();

  const onDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success("Google account disconnected.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setConfirmOpen(false);
    }
  };

  const onSync = async (mode: "profiles" | "incremental" | "full" = "profiles") => {
    try {
      await runSync.mutateAsync(mode);
      toast.success(mode === "profiles" ? "Refreshing profile counts…" : "Sync started.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <GoogleLogo className="h-6 w-6" />
          <div>
            <CardTitle>Google Account Connection</CardTitle>
            <CardDescription>
              Connect the Google account that owns the Business Profiles. Only one account can be connected at a time.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {connection.isLoading && <Skeleton className="h-20 w-full rounded-lg" />}

        {!connection.isLoading && data?.configured === false && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1.5">
              <p>
                Google OAuth is not configured on the server. Set <code>GOOGLE_OAUTH_CLIENT_ID</code> and{" "}
                <code>GOOGLE_OAUTH_CLIENT_SECRET</code> in the backend <code>.env</code>, then restart it. Adding a
                redirect URI in the Google Cloud console does not set these - they are read from the server itself.
              </p>
              {data?.redirectUri && (
                <p className="text-xs">
                  This server will use the redirect URI{" "}
                  <code className="break-all">{data.redirectUri}</code> - it must be listed, exactly, under
                  "Authorised redirect URIs" in the same Google Cloud OAuth client.
                </p>
              )}
            </div>
          </div>
        )}

        {!connection.isLoading && data && !data.connected && (
          <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <GoogleLogo className="h-9 w-9" />
              <div>
                <p className="font-medium text-foreground">No account connected</p>
                <p className="text-sm text-muted-foreground">
                  Sign in with Google to pull live profile status and performance data.
                </p>
              </div>
            </div>
            <Button onClick={() => startGoogleConnect(userEmail)} disabled={!data.configured} className="gap-2">
              <GoogleLogo className="h-4 w-4" />
              Connect with Google
            </Button>
          </div>
        )}

        {!connection.isLoading && data?.connected && (
          <>
            <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {data.picture ? (
                  <img src={data.picture} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <GoogleLogo className="h-9 w-9" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{data.email}</p>
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {data.name ? `${data.name} · ` : ""}
                    {data.accounts.length} Business Profile {data.accounts.length === 1 ? "account" : "accounts"} ·
                    connected{" "}
                    {data.connectedAt ? new Date(data.connectedAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onSync("profiles")} disabled={syncing || runSync.isPending}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing…" : "Refresh counts"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onSync("incremental")} disabled={syncing || runSync.isPending}>
                  Full sync
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmOpen(true)} disabled={disconnect.isPending}>
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </div>

            {syncing && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{syncLabel}</span>
                  <span>{data.sync.total ? `${syncProgress}%` : ""}</span>
                </div>
                {data.sync.total ? (
                  <Progress value={syncProgress} className="h-1.5" />
                ) : (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Profiles synced" value={data.counts.profiles.toLocaleString("en-IN")} />
              <Stat label="Monthly metric docs" value={data.counts.metrics.toLocaleString("en-IN")} />
              <Stat
                label="Last successful sync"
                value={data.sync.lastSuccessAt ? new Date(data.sync.lastSuccessAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never"}
              />
              <Stat label="Schedule" value="Daily 7:00 AM & 7:00 PM" />
            </div>

            {data.sync.status === "error" && data.sync.error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Last sync failed: {data.sync.error}</span>
              </div>
            )}

            {data.sync.status === "partial" && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {data.sync.error ||
                    "The last sync finished, but Google was unavailable for some folders. They kept their previous data."}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              To use a different mailbox, disconnect this one first — only one Google connection is allowed.
            </p>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {data?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              The realtime dashboard will stop syncing and keep showing the data from the last sync until another
              account is connected. Profiles and metrics already stored are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-muted/50 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
  </div>
);
