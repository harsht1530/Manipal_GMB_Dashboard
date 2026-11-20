import { useQuery } from "@tanstack/react-query";
import { REALTIME_API, realtimeHeaders } from "@/hooks/useRealtimeData";

/**
 * Who may see the Profile Optimization report: harsh@multipliersolutions.com and every email in
 * the multiplierteam collection. The list lives on the server (GET /api/realtime/optimization/access),
 * which also refuses the report itself to anyone else, so the sidebar, the page and the API
 * always agree and a Multiplier team change needs no deploy.
 */
export const useOptimizationAccess = (email?: string | null) => {
  const query = useQuery({
    queryKey: ["realtime", "optimization-access", (email || "").trim().toLowerCase()],
    enabled: !!email,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`${REALTIME_API}/optimization/access`, { headers: realtimeHeaders() });
      const body = await res.json();
      return !!body?.data?.allowed;
    },
  });
  return { allowed: !!email && query.data === true, checking: !!email && query.isLoading };
};
