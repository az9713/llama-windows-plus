# Development Journey — "llama-windows-plus": usability work on Llama for Windows 0.13.0

**Dates:** 2026-10-23 → 2026-10-30
**Deliverable:** this repo, `github.com/az9713/llama-windows-plus`
**Upstream:** https://github.com/ggml-org/Llama-Windows (ZIP of `main`, downloaded 2026-10-23, package version 0.13.0.0)
**Briefs (verbatim, in order):**
1. "can we create a meaningful, creataive application using the codebase `<project>\Llama-Windows-main`."
2. "suggest ways to improve the llama UI"
3. "/goal improve the UI to make it user friendly /loop implement one feature. verify it works and is user friendly. stop only if all suggestions implemented."
4. "ctlr-alt-space, alt-space start other apps like Gemini desktop and claude" → "yes both."

**Sources and reconstruction.** The work ran over several Claude Code sessions. The context was compacted twice in the main session. Sections 2–4 for 2026-10-23 → 2026-10-28 are reconstructed from three sources: the compaction summaries, the project's local resume file (`HANDOFF.md`, not in this repo), and the user's messages extracted from the session transcripts. Everything from 2026-10-29 on is from the live transcript. Personal details (name, home paths, network names) are removed.

## 1. The briefs — what was actually being asked

The upstream app is a tray app for local llama.cpp models. It has a model browser, a chat overlay on Alt+Space, a Windows Share target and `llama://` links that other programs can open.

Brief 1 asked for "a meaningful, creative application" of that codebase. Claude listed what only this codebase has: the Share target, `llama://` links, the overlay. The user picked the browser as the place with no AI, and asked for usage mockups ("draw some pictures to illustrate how the 4 buttons are use"). That became the **four browser buttons**: Explain, Summarize page, Translate, Reply.

Brief 2 came after the user's own test of the buttons: "tested for Explain: closed by itself multiple times. also the UI cannot be moved or minimized. please improve the Explain modal." The answer was a list of 7 suggestions:

| ID | Suggestion | Where in upstream code |
|---|---|---|
| O1 | Pin / "Keep open" for the overlay | `Views/OverlayWindow.xaml.cs:665-676` hid the overlay on focus loss |
| O2 | Movable, resizable, minimizable overlay | `Views/OverlayWindow.xaml.cs:291-305` made it a borderless `WS_POPUP` + `WS_EX_TOOLWINDOW` |
| O3 | Fix the crash after a `llama://` handoff | `App.xaml.cs:114-116` |
| O4 | Load a model instead of dropping the prompt | `Views/OverlayWindow.xaml.cs:132` (40 retries × 3 s) |
| O5 | Configurable overlay shortcut | `GlobalHotkey.cs:66` (Alt+Space only) |
| B1 | One reused chat window for the buttons | `browser-buttons/buttons.js` |
| B2 | Send the main text of a page, not menus | `browser-buttons/buttons.js` |

Brief 3 turned the list into a self-paced loop: one feature per pass, verify it, stop only when all are done. Interpretation that was not visible to the user: "verify it works" was read as "compile and run the existing tests" whenever a real run would need clicks on the user's desktop (see the standing rules in section 2).

## 2. Starting point

**Minute zero (2026-10-23).** The upstream ZIP was unpacked; all 300 source files had one mtime (13:59), which later served as proof that the original was untouched. The official `LlamaApp-v0.13.0.msixbundle` was installed and running. Its server listened on `127.0.0.1:9931` with `ggml-org/gemma-3-4b-it-qat-GGUF:Q4_0` (context 4,096 tokens). The laptop GPU had 4 GB VRAM.

**What was missing.** No .NET SDK, no admin rights. So for the first five days nothing in the app could be rebuilt, and every app-side fix stayed a proposal.

**Earlier work reused, not repeated.** An earlier session had written codebase docs (`docs/`, with a "known drift" list of 43 entries) and a user guide. Those helped find the code locations in section 1 quickly. They are **not** in this repo: they contain local notes and were not part of the request.

**Standing rules that shaped the work** (invisible in the code):
- *No synthetic input.* An earlier experiment sent keystrokes to a window and they reached the user's Chrome instead. Since then: never send keys or clicks to windows on the user's PC; test headless.
- *Never kill a process by name.* Only PIDs that Claude started and captured.
- *Smallest change that works,* enforced also by a "ponytail" minimal-solution hook.
- *Questions are read-only;* replies in ASD-STE100 Simplified Technical English; the user reads only the final message of each turn.
- *Never print the server API key.*

## 3. Design decisions

**Bookmarklets, not a Chrome extension.** Four `javascript:` bookmarks need no store, no permissions and no install step beyond a drag. An extension was rejected as more moving parts for four buttons. Cost: a bookmarklet runs under the page's Content Security Policy (see problem 7).

**Handoff path: `llama://` first, then the server's own chat page.** Version 1 sent text through `llama://chat?prompt=…` into the Llama overlay. After the crash (problem 3), the dropped prompts (problem 2) and the user's "closed by itself" report, the buttons switched to opening the llama.cpp WebUI that the Llama server already serves: `http://127.0.0.1:9931/?model=<id>&load=true&q=<prompt>`. The parameter names came from the WebUI bundle (`gp={LOAD:"load",MODEL:"model",QUERY:"q"}`). It must be the real query string; `#/?q=` does not work. `q` sends at once; `load=true` loads an unloaded model. Rejected alternative: an own answer page that calls the API with `fetch` — it would trigger Chrome's local-network permission prompt per site, and strict sites block it with CSP `connect-src`.

**Text cap 7,000 characters.** 12,000 characters of a Wikipedia article came to 4,421 tokens, above the 4,096-token context, and the server refused it. Address cap 30,000 characters: the server answered at 30,000.

**B2 heuristic.** Prefer `main, [role="main"]`; else the only `<article>` when exactly one exists; use it only if it has at least 500 characters; else `body.innerText`. Rejected: a readability library (a dependency for a 10-line rule).

**Build in a copy.** `llama-ui-build/` = upstream minus `docs/`. The original folder stayed pristine so the diff in this repo is exact.

**.NET SDK per user.** `dotnet-install.ps1` installed SDK 10.0.403 into `%LOCALAPPDATA%\Microsoft\dotnet` without admin. It is not on `PATH`; every build calls `dotnet.exe` by full path.

**O2 with WinUI title-bar APIs, not Win32 styles.** `ExtendsContentIntoTitleBar = true`, `SetTitleBar(DragArea)`, `SetBorderAndTitleBar(true, true)`, resizable and minimizable but not maximizable, `IsShownInSwitchers = true`, and `AppWindow.Closing` → cancel + `Hide()`. This let the patch **delete** the `WS_POPUP`/`WS_EX_TOOLWINDOW` code, four constants and the `GetWindowLong`/`SetWindowLong` P/Invokes. The overlay centers only on its first show (`_placed`).

**O1 pin is per session.** Not saved to settings: YAGNI until someone asks for it to persist.

**O3: bound the wait, do not redesign activation.** `await Task.WhenAny(Task.Run(() => instance.RedirectActivationToAsync(activatedArgs).AsTask()), Task.Delay(5000));` The upstream line awaited only the `IAsyncAction` object, not its completion, before `Environment.Exit(0)`.

**O4: one new setting.** `Settings.LastLoadedModelId` is saved when a model reaches "loaded". `App.LoadModelForPromptAsync()` loads it, or the only listed model. On final give-up, the text goes to the clipboard ("Text copied, not sent") instead of being lost.

**O5: fallback, not failure.** `GlobalHotkey.Register(onPressed, preferred)` tries the saved shortcut first, then the others. Later (brief 4) the list grew to 5 and gained "(used by another app)" marks. **Ctrl+Shift+L was proposed and then rejected** before shipping: Excel uses it to toggle filters and VS Code uses it, and a global hotkey would block it in those apps.

**Run unpackaged for the test, do not install.** Installing the self-built package (Developer Mode is on, so `Add-AppxPackage -Register` needs no admin) would replace the user's installed 0.13.0. The user was asked; they chose "start the app with improved UI", and the unpackaged run was used. Cost: fresh settings and no toasts (problem 10).

**Repo history: two commits.** Commit 1 is the upstream ZIP as downloaded; commit 2 is our work. A GitHub fork was rejected because the exact upstream commit of the ZIP is unknown and upstream may have moved since 2026-10-23.

**Descoped on purpose:** B1 (blocked, section 4), a persistent pin, a free-form shortcut recorder (5 fixed choices cover the case), the codebase docs, and an update of the original mockup page.

## 4. The crux: getting text from a web page into a local model without losing it

Every hard problem in this project was the same problem: a piece of text leaves a web page and must arrive, once, in a chat with a loaded model.

**Through the app (`llama://`).** The handoff starts a second LlamaApp process, which redirects its activation to the running one and exits. In 23 warm handoffs the running Llama crashed 12 times; in 12 cold starts, 0 times. Windows event 1000 named `CoreMessagingXP.dll`, exception `0xc000027b`; the error report named `combase.dll` and `0x800706bf` (`RPC_S_CALL_FAILED_DNE`). The inferred cause: the second process exits while the cross-process call is still in flight. When the handoff did not crash, the text could still be lost: with no model loaded, the overlay retried 40 × 3 s and logged "gave up placing the shared prompt".

**Around the app (the WebUI).** Opening the server's chat page avoided the crash and the overlay. It brought its own limits: Chrome keeps 6 connections per host and each chat page holds one open (`/models/sse`), so the 5th or 6th window got no answer. And B1 — reuse one chat window — turned out impossible from a bookmarklet. Tested on a private server instance (`llama.exe serve --host 127.0.0.1 --port 9941`, stopped by its PID afterwards), the WebUI page is served with:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

With COOP `same-origin`, each chat window lives in its own browsing-context group, so `window.open(url, 'llama-chat')` from another page never finds it. The server option `--path <dir>` drops the header, but it also replaces the built-in WebUI (`/` returns 404 without an `index.html`). Copying the static SvelteKit build (`_app/immutable/bundle.DflMQ0y2.js`, CSS, icons) into such a folder would work until the next runtime update makes it stale. That trade-off changes the user's server settings (`CustomServeArguments`), so it was left as the user's decision.

**Back into the app (O3 + O4).** Once the SDK was installed, both app-side losses got fixes: a bounded wait for the handoff, and a model load plus a clipboard fallback for the prompt.

Rule learned: *a handoff has two ends; test the receiver's state (model loaded? process alive?), not only that the sender fired.*

## 5. Tools and features used

| Tool | What it did here |
|---|---|
| Claude Code (Opus 5.5) | All code, tests and docs; no subagents were used for this work. |
| `advisor` tool | Consulted at decision points; the surviving summaries do not record which advice changed the plan. |
| `/loop` (dynamic mode) + `ScheduleWakeup` | Ran 7 passes of brief 3, then stopped itself. |
| `PushNotification` | One message when the loop stopped. |
| `AskUserQuestion` | Which app to start; repo name, visibility and history for this repo. |
| Artifact tool | Published the button mockup page (private; later outdated by the design change, not updated). |
| Headless Chrome + Chrome DevTools Protocol (Node scripts) | Ran bookmark code with `Runtime.evaluate(userGesture: true)` on real sites, read popup targets from `/json`, read answers from `document.body.innerText` and SSE bodies with `Network.getResponseBody`. Ports 9333–9335, throwaway profiles. |
| `llama.exe serve` on port 9941 | A private server instance to read the WebUI's response headers. |
| `dotnet-install.ps1`, `dotnet build`, `dotnet test` | Per-user SDK 10.0.403; builds and the two upstream test projects. |
| Win32 `RegisterHotKey` via PowerShell `Add-Type` | Measured which shortcuts were free, releasing each at once. |
| Windows Event Log, WER reports, Llama logs | Crash evidence; startup evidence for each test run. |
| `gh` CLI | Created and pushed this repo. |

## 6. What went wrong, and the fixes

1. **Wrong length limit from memory.** Version 1 assumed a 2,048-character cap on links and added a `navigator.share` path for long text. Measured: links of 12,000 and 29,998 characters arrived; 32,698 did not (limit about 32,767). The share path was deleted. *Measure the limit; do not recall it.*
2. **Dropped prompt.** The user's first real test arrived (34 characters) but no model was loaded; the overlay logged "gave up placing the shared prompt". Fixed later by O4.
3. **Crash on warm handoff:** `CoreMessagingXP.dll`, `0xc000027b`, 12 of 23. Fixed in code by O3; not yet re-tested by hand.
4. **"Closed by itself multiple times" and "cannot be moved or minimized"** (user's words). Avoided first by the WebUI design, then fixed in the app by O1 and O2.
5. **Five or more chat windows → no answer.** Cause: 6 connections per host. Not fixed; documented.
6. **Long prompt keeps spinning.** After the first long page summary in a session, later long prompts (also at 3,000 characters) were answered by the server — full SSE stream captured, `finish_reason: stop` — but the page showed nothing. Not fixed; cause in the WebUI not found.
7. **GitHub CSP.** A page-initiated `javascript:` URL was blocked by GitHub's CSP in tests; the same code run directly delivered 8,237 characters. A real bookmark-bar click may be exempt; not verified.
8. **B1 blocked by COOP** (section 4). Not done; needs a decision.
9. **Global hotkey failed.** Log: `global hotkey registration failed for Alt+Space (another app may own it).` Measured on 2026-10-28: Alt+Space and Ctrl+Alt+Space taken, Ctrl+Shift+Space free. The user later named the owners: "ctlr-alt-space, alt-space start other apps like Gemini desktop and claude". Fixed by O5 and the 5-choice list.
10. **No notifications in the unpackaged run.** Log: `toast notification registration failed; toasts disabled`. Windows toasts need package identity. Not fixable without installing; the README says so.
11. **Misleading instruction.** Claude wrote "Open Settings → Chat overlay"; the user replied "did not see Chat overlay , where is it". "Chat overlay" is a card on the **General** page, not a menu item. Claude corrected the path and confirmed from file times that the running build contained the card (`SettingsWindow.xaml` 23:38:12, `LlamaApp.exe` 23:39:04).
12. **The list offered dead choices.** With 2 of 3 shortcuts owned by other apps, the picker was not useful, and it pre-selected Alt+Space (the default) while Ctrl+Shift+Space was live. Fix: select the live shortcut, mark owned ones via `GlobalHotkey.IsFree` (register with id 2 on a null window, release at once), add Ctrl+Alt+L and Ctrl+Shift+Alt+L.
13. **Locked build output.** The rebuild needed the running build stopped. `Stop-Process` on its captured PID left its children running (`llama.exe`, `msedgewebview2.exe`); they were stopped by their PIDs, read from the parent-PID query of the process Claude had started.
14. **Claims that had to be corrected in front of the user:** upstream 0.13.0 *did* show "Alt+Space unavailable" (earlier claim: "shows no message"); the loop-stop notification said "5 of 6" items done, the correct count was 6 of 7.
15. **Compiler warning introduced by O5:** `App.xaml.cs(303,63): warning CS8602: Dereference of a possibly null reference.` Fixed with `_hotkey?.Name`.
16. **While writing this document:** the transcript extractor crashed with `UnicodeEncodeError: 'charmap' codec can't encode character '→'` (Windows console code page 1252). Fixed with `sys.stdout.reconfigure(encoding='utf-8')`; `PYTHONIOENCODING` was ignored because Python ran with `-I`.

**Near-miss.** Early tests with named windows "did not reuse" in headless Chrome, and it was tempting to blame headless mode. Reading the actual response headers on a private server showed the real cause, COOP, which also applies in a normal Chrome.

**Fragile on purpose / by luck.**
- The WebUI query parameters (`model`, `load`, `q`) are read from a minified bundle, not a documented API. A llama.cpp update can rename them.
- The model ID is fixed in `buttons.js:10`.
- The "free shortcut" check is a moment-in-time probe: an app that starts later can take a shortcut that was free.

## 7. Verification

| Claim | How it was checked |
|---|---|
| Buttons build correct URLs, caps, selection rules | `node check.js` → `CHECK_OK (bookmark length 6053 characters)`, 12 checks |
| Buttons answer on real pages | Headless Chrome: Explain 107–605 tokens at 27–34 tokens/s; 4 clicks in a row; unloaded model loaded and answered |
| B2 sends less noise | Wikipedia "Bicycle lane": 17,690 characters of body text → 7,114 sent; menu text before the article 446 → 154 characters. MDN 4,769 → 2,975. BBC and The Guardian used `<main>`. GitHub: little change (3,732 → 3,635 characters before "README"). Hacker News: full body kept. |
| COOP blocks B1 | Response headers read from a private `llama.exe serve` on port 9941 |
| App changes compile | `dotnet build`: 0 errors after each pass and after the final change |
| Nothing upstream broke | `LlamaApp.Tests` 585/585, `LlamaApp.LlamaCpp.Tests` 717/717 (after O4 and O5) |
| Build starts and serves | Log of the unpackaged run: `listening on http://127.0.0.1:9931`, `loaded 1 local model(s)`, overlay WebView initialized |
| Shortcut fallback | Log: Alt+Space and Ctrl+Alt+Space failed, `global hotkey registered: Ctrl+Shift+Space` |
| Shortcut list and save | The user: "the list looks right, saved Ctrl+Alt+L"; log `global hotkey registered: Ctrl+Alt+L`; `settings.json` `OverlayHotkey` = `Ctrl+Alt+L` |
| This repo's diff is exact | Upstream committed unchanged from the pristine folder (301 files); then the 8 changed files copied from the build folder |

**Not verified:** O1, O2, O3 and O4 by hand (they need clicks on the desktop, which the no-synthetic-input rule forbids for Claude); a real bookmark-bar click and the drag to the bookmarks bar; the notifications (need an installed package); the upstream CI workflow on this repo.

## 8. Where things stand

**Done:** browser buttons with B2; O1–O5 in code; O5 tested by the user; this repo.

**Unfinished, with the reason:**
- **B1, one chat window** — blocked by the server's COOP header. Unblocks if the owner accepts `--path` with a copied WebUI (and re-copies it after each runtime update), or if an own answer page is built.
- **Hand test of O1–O4** — needs the owner to press the shortcut, drag, pin and send a prompt with no model loaded.
- **Notifications** — need the build installed as a package, which replaces an installed Llama 0.13.0. To go back: install the official `LlamaApp-v0.13.0.msixbundle` again.
- **Problems 5, 6 and 7** — documented, not fixed.
- **The crash write-up for upstream** (as "known drift" entry 44) — offered, not written.

**Knowledge captured outside this repo:** a local `HANDOFF.md` resume file (status, commands, measurements) and a persistent agent memory rule "no synthetic input". Neither is published.

**Next steps (options):**
1. Hand-test O1–O4 with the steps in the README.
2. Decide on B1.
3. Offer O3 upstream as an issue or pull request to ggml-org/Llama-Windows, with the crash evidence from section 4.
