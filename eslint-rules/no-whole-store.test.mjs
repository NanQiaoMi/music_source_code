import { describe, it } from "vitest";
import { RuleTester } from "eslint";
import rule from "./no-whole-store.js";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
});

const playerImport = 'import { usePlayerStore } from "@/store/playerStore";';
const storeHookError = (hook) => ({ messageId: "wholeStore", data: { hook } });

ruleTester.run("no-whole-store", rule, {
  valid: [
    // explicit selector (atomic field)
    { code: playerImport + " usePlayerStore((s) => s.volume);" },
    // explicit selector with useShallow for multiple fields
    {
      code:
        playerImport +
        " usePlayerStore(useShallow((s) => ({ volume: s.volume, muted: s.isMuted })));",
    },
    // non-hook access is out of scope for this rule
    { code: playerImport + " usePlayerStore.getState().volume;" },
    // hooks that are not imported from a store module are ignored
    { code: 'import { useThemeStore } from "@/lib/themeStore"; useThemeStore();' },
    // local hooks with a store-like name are ignored
    { code: "usePlayerStore();" },
  ],
  invalid: [
    {
      code: playerImport + " usePlayerStore();",
      errors: [storeHookError("usePlayerStore")],
    },
    {
      code: 'import { useUIStore as useUI } from "@/store/uiStore"; const { panel } = useUI();',
      errors: [storeHookError("useUIStore")],
    },
    {
      code: 'import { useQueueStore } from "../store/queueStore"; useQueueStore();',
      errors: [storeHookError("useQueueStore")],
    },
    {
      code: 'import { useStatsAchievementsStore } from "@/store/statsAchievementsStore"; useStatsAchievementsStore();',
      errors: [storeHookError("useStatsAchievementsStore")],
    },
  ],
});
