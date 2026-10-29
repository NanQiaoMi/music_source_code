/* eslint-env node */
"use strict";

/**
 * S6-9e: forbid direct useXStore.getState(...) reads in src/lib/** and
 * src/services/**. Those layers run outside React (bootstrap, DI defaults,
 * services) and must read "right now" snapshots through the typed helpers in
 * src/store/actions/** (e.g. getPlayerSnapshot) or injected ports instead of
 * reaching into a store module. Unavoidable exceptions need an inline
 * `// eslint-disable-next-line no-lib-service-getstate -- <reason>`.
 */

const STORE_HOOK = /^use[A-Z][A-Za-z0-9_]*Store$/;
const STORE_MODULE = /(?:^|\/)store(?:\/|$)/;
const GUARDED_LAYER = /(?:^|[\\/])src[\\/](?:lib|services)[\\/]/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$|[\\/]__tests__[\\/]/;

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow direct useXStore.getState() reads in src/lib and src/services",
      recommended: false,
    },
    schema: [],
    messages: {
      directGetState:
        "Direct '{{store}}.getState()' is forbidden in src/lib and src/services. " +
        "Read a typed snapshot from src/store/actions/** (e.g. getPlayerSnapshot()) " +
        "or inject a port; if unavoidable, add " +
        "'// eslint-disable-next-line no-lib-service-getstate -- <reason>'.",
    },
  },
  create(context) {
    const filename = context.getFilename();
    // Scope guard: the rule is enabled via .eslintrc.json overrides, but stays
    // inert if someone turns it on globally. Test files keep using getState
    // for assertions and are out of the ratchet's scope.
    if (!GUARDED_LAYER.test(filename) || TEST_FILE.test(filename)) return {};

    // Local identifiers bound to a store module (also catches aliased imports).
    const storeLocals = new Set();

    return {
      ImportDeclaration(node) {
        if (!STORE_MODULE.test(String(node.source.value))) return;
        for (const specifier of node.specifiers) {
          const imported = specifier.imported?.name ?? specifier.imported?.value;
          if (STORE_HOOK.test(imported ?? "") || STORE_HOOK.test(specifier.local.name)) {
            storeLocals.add(specifier.local.name);
          }
        }
      },
      "MemberExpression[computed=false][property.name='getState']"(node) {
        if (node.object.type !== "Identifier") return;
        const name = node.object.name;
        if (!storeLocals.has(name) && !STORE_HOOK.test(name)) return;
        context.report({
          node: node.property,
          messageId: "directGetState",
          data: { store: name },
        });
      },
    };
  },
};
