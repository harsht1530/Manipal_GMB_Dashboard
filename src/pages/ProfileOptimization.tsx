import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RealtimeOptimization } from "@/components/dashboard/RealtimeOptimization";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert } from "lucide-react";
import { useRealtimeMeta } from "@/hooks/useRealtimeData";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeOptimization } from "@/lib/optimizationAccess";

/**
 * The Profile Optimization report, on its own page rather than inside the Realtime Dashboard.
 *
 * Restricted to the mailboxes in optimizationAccess.ts. The sidebar already hides the entry for
 * everyone else; this guard is what answers a pasted URL, and the API refuses the request
 * independently - so a user who gets this far still sees no data.
 */
const ProfileOptimization = () => {
  const { user } = useAuth();
  const allowed = canSeeOptimization(user?.email);

  const [cluster, setCluster] = useState("ALL");
  const [folder, setFolder] = useState("ALL");
  const [verification, setVerification] = useState("ALL");
  const meta = useRealtimeMeta();

  const filters = useMemo(
    () => ({
      clusters: cluster === "ALL" ? [] : [cluster],
      units: folder === "ALL" ? [] : [folder],
      status: verification === "ALL" ? undefined : verification,
    }),
    [cluster, folder, verification]
  );

  // Cluster is the parent filter, exactly as on the Realtime page: only the folders the
  // allocation sheet puts in the chosen cluster are offered.
  const folderOptions = useMemo(() => {
    const units = meta.data?.units ?? [];
    if (cluster === "ALL") return units;
    const map = meta.data?.unitClusters ?? {};
    return units.filter((unit) => (map[unit] ?? []).includes(cluster));
  }, [meta.data, cluster]);

  const onClusterChange = (value: string) => {
    setCluster(value);
    // A folder from another cluster would leave the two filters contradicting each other.
    const map = meta.data?.unitClusters ?? {};
    if (value !== "ALL" && folder !== "ALL" && !(map[folder] ?? []).includes(value)) setFolder("ALL");
  };

  if (!allowed) {
    return (
      <DashboardLayout title="Profile Optimization" subtitle="Restricted section">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-medium">This section is not available for your account.</p>
            <p className="max-w-md text-xs text-muted-foreground">
              The optimization report is limited to a single administrator mailbox. Nothing else on
              the dashboard is affected.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Profile Optimization"
      subtitle="Content completeness across every Google Business Profile"
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <Select value={cluster} onValueChange={onClusterChange}>
              <SelectTrigger className="h-9 w-[170px] shrink-0 bg-muted/20 border-primary/5 text-xs font-medium">
                <SelectValue placeholder="Cluster" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All clusters</SelectItem>
                {(meta.data?.clusters ?? []).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger className="h-9 w-[220px] shrink-0 bg-muted/20 border-primary/5 text-xs font-medium">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="ALL">All folders</SelectItem>
                {folderOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={verification} onValueChange={setVerification}>
              <SelectTrigger className="h-9 w-[170px] shrink-0 bg-muted/20 border-primary/5 text-xs font-medium">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Verified &amp; unverified</SelectItem>
                <SelectItem value="verified">Verified only</SelectItem>
                <SelectItem value="unverified">Unverified only</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <RealtimeOptimization filters={filters} />
      </div>
    </DashboardLayout>
  );
};

export default ProfileOptimization;
