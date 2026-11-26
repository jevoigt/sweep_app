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

## What changed

- Quiet elevator-style music plays only during active gameplay, with a remembered mute control. Home, lobby, countdown, and result screens are silent.
- Include the new `public/music.js` file when uploading this update.

- Smiling Minesweeper-mine homepage artwork.
- **2–8 players** per room with a host-controlled start.
- **Easy:** 9 rows × 9 columns, 10 mines.
- **Medium:** 16 rows × 16 columns, 40 mines.
- **Hard:** 30 rows × 16 columns, 99 mines.
- Every round starts fully hidden, with exactly the selected mine count randomly scattered across the entire board. Everyone gets the same layout. The first click can hit a mine.
- Large-board scrolling, tile zoom, and Fit controls. The old Opening button has been removed.
- Live standings for the whole room and preserved scroll position during rival moves.
- Multi-player frozen-score rules and first-clear immediate wins.
- A new-round lobby for fresh boards and difficulty changes.

The build runs tests directly because the app has no external dependencies. It does not require `npm ci` or a lockfile on Render.
