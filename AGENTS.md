<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## MemoryMelody architecture
- Portal permissions live in protected user_roles with database-authorized RPCs; no client/email privilege checks, to prevent escalation. Creator bootstrap requires a verified mailbox and admin changes are audited.
- Profiles hold only display names, with a signup trigger and column-scoped owner updates; account passwords stay within Cloud Auth.
- AI/music/distributor integrations live behind adapter registries in `src/lib/providers.server.ts`; server functions in `src/lib/songs.functions.ts` load them via dynamic import so secrets never reach the client.
- Release/distribution rules (checklist, status transitions, CSV) are pure functions in `src/lib/release.ts`, covered by `src/test/release.test.ts`; keep UI and server using the same helpers.
- User files are stored in private buckets (`media`, `audio`, `covers`) under `<userId>/<projectId>/...`; storage RLS depends on that first path segment.
- Never fake integrations: unconfigured providers must show a setup state, and distribution requires an explicit final confirmation.
