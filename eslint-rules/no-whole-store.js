/* eslint-env node */
"use strict";

/**
 * Forbid whole-store Zustand subscriptions: useXStore() subscribes to every
 * state field and re-renders on any change. Hooks imported from a store module
 * must receive a selector; multiple fields can be combined with useShallow.
 */

const STORE_HOOK = /^use[A-Z][A-Za-z0-9_]*Store$/;
const STORE_MODULE = /(?:^|\/)store(?:\/|$)/;

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow whole-store Zustand subscriptions (useXStore() without a selector)",
      recommended: false,
    },
    schema: [],
    messages: {
      wholeStore:
        "Avoid whole-store subscription '{{hook}}()': it re-renders on every store change. " +
        "Pass a selector, e.g. {{hook}}((s) => s.field); combine fields with useShallow.",
    },
  },
  create(context) {
    // local identifier -> imported store hook name (handles aliased imports)
    const storeHooks = new Map();

    return {
      Program(node) {
        for (const statement of node.body) {
          if (statement.type !== "ImportDeclaration") continue;
          if (!STORE_MODULE.test(String(statement.source.value))) continue;
          for (const specifier of statement.specifiers) {
            if (specifier.type !== "ImportSpecifier") continue;
            const imported = specifier.imported.name || specifier.imported.value;
            if (!STORE_HOOK.test(imported)) continue;
            storeHooks.set(specifier.local.name, imported);
          }
        }
      },
      CallExpression(node) {
        if (node.arguments.length > 0) return;
        if (node.callee.type !== "Identifier") return;
        const hook = storeHooks.get(node.callee.name);
        if (!hook) return;
        context.report({
          node,
          messageId: "wholeStore",
          data: { hook },
        });
      },
    };
  },
};
