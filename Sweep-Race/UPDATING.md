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

Rooms now support up to **12 players**. Completed-game messages are green for a win, red for a loss, and amber for tied leaders. Daily failures also use red.

Explosion sound effects are always enabled, including for players who previously muted them. The **Music** button is the only audio control. The five-track playlist and its remembered music preference remain.

Upload the complete updated folder contents, including the existing five files in `public/music/`. Keep Render’s settings above and redeploy the latest commit. No additional service or dependency is required.

## Solo play update

Hosts can start with one ready player. A solo game ends on clearing all safe tiles, hitting a mine, or conceding. Multiplayer races still support twelve players. The homepage shows “2–12 players” and “Or play solo”; reload the page after deploying this upload.
