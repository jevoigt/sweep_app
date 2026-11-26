# Update your existing live game

The updated project is in **Downloads/Sweep-Race**. Its files are ready to upload into your existing GitHub repository, `jevoigt/sweep_app`.

1. Open that repository on GitHub, then open the existing **Sweep-Race** folder. You should see `package.json`, `game.mjs`, `server.mjs`, and `public/` here.
2. Choose **Add file → Upload files**.
3. In Finder, open Downloads/Sweep-Race. Press Command + Shift + . to show hidden files. Select the folder’s **contents**, including its `public/` and `test/` folders, and drag them into GitHub’s upload area.
4. Check the destination before committing: the files must replace the existing `Sweep-Race/game.mjs`, `Sweep-Race/public/app.js`, etc. Do not create `Sweep-Race/Sweep-Race/`.
5. Commit the changes. All existing paths are reused; no old application files need deletion for this update.
6. In your existing Render service, keep:

   | Setting | Value |
   | --- | --- |
   | Root Directory | `Sweep-Race` |
   | Build Command | `npm test` |
   | Start Command | `npm start` |

7. If Render does not auto-deploy the commit, choose **Manual Deploy → Deploy latest commit**. Use **Clear build cache & deploy** if you changed the build command.
8. When it succeeds, refresh your existing game URL: https://sweep-app-mcn1.onrender.com. If an iPhone has the old page open, reload it after deployment.

**Your public URL stays the same.** Deployment resets existing in-memory rooms, so create a new room to test the update.

## What changed in this update

The supplied five MP3 files replace the synthesized background music. Playback order is Kokiri Forest → Shop → Market → Kakariko Village → Ocarina of Time → repeat. Each new game/attempt starts the sequence again. The lobby, countdown, and results remain silent; mute and the separate explosion effect remain available.

**Upload the whole updated folder contents**, including:

- `public/music/` with **all five MP3 files** (about 10.3 MiB total).
- The new `public/playlist.js` manifest.
- Updated `public/music.js`, `public/app.js`, `server.mjs`, styles, and tests.

Each MP3 is below GitHub’s browser-upload per-file limit. Keep the existing folder structure: the assets should appear at `Sweep-Race/public/music/` in your current repository. Upload the extracted files and folders, not a ZIP file as a single repository file.

No extra music service, database, API key, or package install is required. Keep Render’s Build Command as `npm test` and Start Command as `npm start`. Music streaming uses hosting bandwidth. Your game URL stays unchanged.

Existing Daily puzzles, per-browser attempt counts, custom boards, eight-player races, and tap/hold controls remain. Deployments still reset active in-memory runs.
