"use client";

import React from "react";
import { UnifiedDataManagerHub } from "@/components/library/UnifiedDataManagerHub";
import { useRouter } from "next/navigation";

export default function DataManagerPage() {
  const router = useRouter();

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#050508]">
      <UnifiedDataManagerHub
        initialTab="dashboard"
        isStandalonePage={true}
        onClose={() => router.push("/")}
      />
    </div>
  );
}
