"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { PageLoading } from "./loading-spinner";

const ROUTE_PERMISSIONS: Record<string, string> = {
  "/dashboard": "view-dashboard",
  "/employees": "manage-employees",
  "/mcu": "view-mcu",
  "/mcu/review": "review-mcu",
  "/mcu/new": "create-mcu",
  "/visits": "view-visits",
  "/visits/new": "register-patient",
  "/visits/queue": "view-visits",
  "/medical-records": "view-clinical-notes",
  "/medicine": "manage-stock",
  "/medicine/dispense": "dispense-medicine",
  "/certificates": "issue-certificate",
  "/reports": "view-reports",
  "/health-status": "view-health-status",
  "/users": "manage-users",
  "/master-data": "manage-master-data",
  "/audit-logs": "view-audit-logs",
  "/waiver": "manage-hse",
  "/da": "manage-hse",
  "/emergency": "view-emergency",
  "/my/profile": "view-profile",
  "/my/mcu": "view-profile",
  "/my/certificates": "view-profile",
};

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return;

    const requiredPermission = ROUTE_PERMISSIONS[pathname];
    if (requiredPermission && !can(user.role, requiredPermission)) {
      router.push("/dashboard");
    }
  }, [user, pathname, router]);

  if (!user) {
    return <PageLoading />;
  }

  const requiredPermission = ROUTE_PERMISSIONS[pathname];
  if (requiredPermission && !can(user.role, requiredPermission)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Akses Ditolak</p>
          <p className="mt-1 text-sm text-slate-500">
            Anda tidak memiliki akses ke halaman ini.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
