import { describe, it } from "vitest";
import { RuleTester } from "eslint";
import rule from "./no-lib-service-getstate.js";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
});

const LIB = "src/lib/playback/example.ts";
const SERVICE = "src/services/example.ts";
const playerImport = 'import { usePlayerStore } from "@/store/playerStore";';
const getStateError = (store) => ({ messageId: "directGetState", data: { store } });

ruleTester.run("no-lib-service-getstate", rule, {
  valid: [
    // selector subscription stays the sanctioned read path (valid anywhere)
    { filename: LIB, code: playerImport + " const volume = usePlayerStore((s) => s.volume);" },
    // typed snapshot helper from store/actions is the sanctioned lib read
    {
      filename: LIB,
      code: 'import { getPlayerSnapshot } from "@/store/actions/playbackActions"; getPlayerSnapshot().currentSong;',
    },
    // injected port object: a plain parameter is not a store module binding
    { filename: SERVICE, code: "export const read = (store) => store.getState().queue;" },
    // documented, reviewed exception via inline disable
    {
      filename: LIB,
      code:
        playerImport +
        "\n// eslint-disable-next-line no-lib-service-getstate -- bootstrap restore, runs once\nconst s = usePlayerStore.getState();",
    },
    // scope guard: identical call outside lib/services is not this rule's business
    { filename: "src/components/Header.tsx", code: playerImport + " usePlayerStore.getState();" },
    // test files keep getState for assertions (excluded from the ratchet)
    { filename: "src/lib/bootstrap.test.ts", code: playerImport + " usePlayerStore.getState();" },
  ],
  invalid: [
    {
      filename: LIB,
      code: playerImport + " const s = usePlayerStore.getState();",
      errors: [getStateError("usePlayerStore")],
    },
    {
      filename: SERVICE,
      code: playerImport + " await usePlayerStore.getState().initialize();",
      errors: [getStateError("usePlayerStore")],
    },
    // aliased store import still resolves to a store module
    {
      filename: SERVICE,
      code: 'import { useQueueStore as q } from "@/store/queueStore"; q.getState().queue;',
      errors: [getStateError("q")],
    },
    // regex detection: useXStore-shaped identifier without a local import
    {
      filename: LIB,
      code: "useAudioStore.getState().volume;",
      errors: [getStateError("useAudioStore")],
    },
    // passing the getState reference is the same direct access
    {
      filename: LIB,
      code: playerImport + " const read = usePlayerStore.getState;",
      errors: [getStateError("usePlayerStore")],
    },
  ],
});
