"use client";

import { useParams } from "next/navigation";
import { PublicConsent } from "@/features/people/components/public-consent";

export default function PublicConsentRoute() {
  const params = useParams<{ token: string }>();
  return <PublicConsent token={params.token} />;
}
