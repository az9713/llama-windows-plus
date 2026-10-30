# llama-windows-plus

Usability improvements for **Llama for Windows**, plus browser buttons that send web pages to it.

This repo starts from an unmodified copy of the upstream app and adds our changes on top:

- **Upstream:** [ggml-org/Llama-Windows](https://github.com/ggml-org/Llama-Windows), version 0.13.0. It is a Windows 11 tray app that runs [llama.cpp](https://github.com/ggml-org/llama.cpp) models locally. MIT license, Copyright (c) 2026 Hugging Face Inc. (see [`LICENSE`](LICENSE)).
- **Upstream README:** [`UPSTREAM-README.md`](UPSTREAM-README.md).
- **History:** commit 1 is the upstream source as downloaded on 2026-10-23. Commit 2 adds our work. To see only our changes, run `git diff HEAD~1 HEAD`, or compare the two commits on GitHub.

We did not change llama.cpp. The AI engine (`llama.exe`) is the same.

## What we added

### In the app (8 files changed)

| Feature | What it does | Before (0.13.0) |
|---|---|---|
| **Keep open** | A pin button on the chat overlay. When it is on, the overlay stays open when you click another window. | The overlay closed each time it lost focus. |
| **Movable overlay** | You can drag the overlay by its top bar, resize it and minimize it. It shows on the taskbar and in Alt+Tab. Closing it hides it, so the chat stays. | A fixed, borderless window in the center of the screen. |
| **Shortcut picker** | Settings → General → **Chat overlay** has 5 shortcuts: Alt+Space, Ctrl+Alt+Space, Ctrl+Shift+Space, Ctrl+Alt+L and Ctrl+Shift+Alt+L. Shortcuts that another app owns are marked "(used by another app)". If your shortcut is taken at startup, Llama uses the next free one and says which. | Only Alt+Space. If another app owned it, the overlay had no shortcut. |
| **Model auto-load** | If text arrives (Share, or a `llama://chat` link) while no model is loaded, Llama loads your last model, or the only model you have. If the text still cannot be sent, Llama copies it to the clipboard and tells you. | Llama tried 40 times, 3 seconds apart, then dropped the text. |
| **Handoff crash fix** | A second Llama start (for example from a `llama://` link) now waits at most 5 seconds to pass its request to the running Llama, then exits. | The running Llama crashed in 12 of 23 tests (`CoreMessagingXP.dll`, exception `0xc000027b`). |

Changed files: `App.xaml.cs`, `GlobalHotkey.cs`, `Settings.cs`, `SettingsWindow.xaml`, `SettingsWindow.xaml.cs`, `Views/MainWindow.xaml.cs`, `Views/OverlayWindow.xaml`, `Views/OverlayWindow.xaml.cs`.

New settings in `settings.json`: `OverlayHotkey` (the shortcut you picked) and `LastLoadedModelId` (the model to load for incoming text).

### Browser buttons (new folder `browser-buttons/`)

Four bookmark buttons for Chrome: **Explain**, **Summarize page**, **Translate** and **Reply**. Click one on any web page. A small chat window opens with the Llama chat page, and the model answers at once.

- **What they send:** the text you selected. With no selection, they send the main part of the page (`<main>`, `[role="main"]` or the only `<article>`, if it has at least 500 characters), else the full page text.
- **Limits:** at most 7,000 characters of text (larger texts did not fit the 4,096-token context of the test model) and at most 30,000 characters in the address.
- **Files:** `buttons.js` (the button code), `llama-buttons.html` (the install page: open it in Chrome and drag the buttons to the bookmarks bar), `check.js` (run `node check.js`; it prints `CHECK_OK` when its 12 checks pass).
- **Model:** the buttons use `ggml-org/gemma-3-4b-it-qat-GGUF:Q4_0` on `http://127.0.0.1:9931/`. To use another model, change `MODEL` in `buttons.js:10` and drag the buttons again.

## Build and run

You need the .NET 10 SDK and Windows 11 x64.

1. Build:
   ```
   dotnet build LlamaApp.csproj -c Debug -p:Platform=x64 -r win-x64
   ```
2. Run without installing:
   ```
   bin\x64\Debug\net10.0-windows10.0.19041.0\win-x64\LlamaApp.exe
   ```
3. Run the tests:
   ```
   dotnet test LlamaApp.Tests\LlamaApp.Tests.csproj -p:Platform=x64
   dotnet test LlamaApp.LlamaCpp.Tests\LlamaApp.LlamaCpp.Tests.csproj -p:Platform=x64
   ```

**Caution:** an unpackaged run uses its own settings in `%LOCALAPPDATA%\Llama`, not the settings of an installed Llama. Windows notifications do not show in an unpackaged run, so the messages about shortcuts and model loading do not appear.

## Status

| Item | Tested |
|---|---|
| Shortcut picker | Yes, on a real PC: two shortcuts were owned by other desktop apps, the list marked them, and Ctrl+Alt+L was saved and works. |
| Browser buttons | Yes: `check.js`, plus headless Chrome on Wikipedia, MDN, BBC, The Guardian, GitHub and Hacker News. |
| Model auto-load | Builds; existing unit tests pass (585/585 and 717/717). Not yet tried by hand. |
| Keep open, movable overlay, crash fix | Builds. Not yet tried by hand. |

CI: the upstream workflow builds and tests both x64 and arm64 on each push to `main`. One upstream test, `EnrolledFolderWatcherTests.A_Burst_Of_Model_Changes_Fires_One_Callback`, depends on timing. On 2026-10-30 it failed on both runners in the first attempt (716/717 passed) and passed when we ran it again. If it fails, run the failed jobs again.

Known problems that we did not fix:

- **One chat window for the buttons:** each click opens a new window. The Llama server sends `Cross-Origin-Opener-Policy: same-origin` on its chat page, so a button cannot find and reuse the old window.
- **Five or more chat windows:** the next window gets no answer. Chrome allows 6 connections to one server, and each open chat page keeps one. Close old chat windows.
- **Long prompts later in a session:** after the first long page summary, a later long prompt can keep spinning in the chat page although the server sent the full answer.

The full story, with the dead ends, is in [`DEVELOPMENT-JOURNEY.md`](DEVELOPMENT-JOURNEY.md).

## License

MIT, as upstream. See [`LICENSE`](LICENSE).
