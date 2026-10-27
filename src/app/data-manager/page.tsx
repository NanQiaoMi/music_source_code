"use client";

import React from "react";
import { UnifiedDataManagerHub } from "@/components/library/UnifiedDataManagerHub";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import { createLazyPanelComponent, LazyPanel } from "@/components/shared/LazyPanel";

const DataManagerQueuePanel = createLazyPanelComponent("dataManagerQueue", () =>
  import("@/components/player/QueuePanel").then((module) => ({ default: module.QueuePanel }))
);

export default function DataManagerPage() {
  const router = useRouter();
  const isQueueOpen = useUIStore((state) => state.panels.queue);
  const closePanel = useUIStore((state) => state.closePanel);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#050508]">
      <UnifiedDataManagerHub
        initialTab="dashboard"
        isStandalonePage={true}
        onClose={() => router.push("/")}
      />
      <LazyPanel
        name="dataManagerQueue"
        isOpen={isQueueOpen}
        onClose={() => closePanel("queue")}
        component={DataManagerQueuePanel}
        keepAlive="always"
      />
    </div>
  );
}
