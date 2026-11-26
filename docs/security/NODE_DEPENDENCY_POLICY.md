# NecroCode — Node.js Controlled Dependency Policy

**Module:** `src/lib/necro-engine/node-dependency-policy.ts`  
**Status:** Implemented & Tested locally.

---

## 1. Security Rules Enforced Before Execution

1. **Lifecycle Scripts Blocked:** Any `package.json` defining `preinstall`, `install`, `postinstall`, `prepare`, `preprepare`, `postprepare`, `prepublish`, or `prepublishonly` is immediately rejected with `DEPENDENCY_PREPARATION_FAILED`.
2. **Registry & `.npmrc` Overrides Blocked:** Any `.npmrc` specifying `registry=`, `_authToken`, or `always-auth`, and any `package.json` `publishConfig.registry` override, is rejected.
3. **Unsafe Dependency Specifiers Blocked:** `git+`, `github:`, `gitlab:`, `bitbucket:`, `http://`, `https://`, `ssh://`, `file:`, `link:`, `workspace:`, `../`, `/`, `*`, and `latest` are rejected.
4. **Lockfile Consistency:** Repositories containing multiple conflicting lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) are rejected.
5. **No Arbitrary `npm install` / `npx`:** Arbitrary package installation is never executed inside the sandbox.

---

## 2. Supported vs Unsupported Dependency States

| Project Dependency Profile | Policy Result | Verification Behavior |
|---|---|---|
| Node.js 20 built-ins only (`node:test`, `node:assert`, `node:fs`, etc.) | `BUILTIN_ONLY_READY` (**Supported**) | Proceeds to isolated Node sandbox |
| Pinned `typescript` / `@types/node` in `devDependencies` only | `TYPESCRIPT_BUILTIN_READY` (**Supported**) | Uses pinned offline `typescript@5.9.3` compiler |
| Third-party `dependencies` or Jest/Vitest `devDependencies` | `DEPENDENCY_PREPARATION_FAILED` (**Unsupported in offline sandbox**) | Returns `VERIFICATION_BLOCKED`; never fakes pass |
