"use client";

import { useParams } from "next/navigation";
import { EmployeeProfile } from "@/features/people/components/employee-profile";

export default function PersonDetailRoute() {
  const params = useParams<{ patientId: string }>();
  return <EmployeeProfile patientId={params.patientId} />;
}
