# Put Sweep Race online

You need two accounts: **GitHub** to store the source and **Render** to run the website. Players only need the resulting URL, not either account. Your computer can be off after deployment.

The route is:

**This folder → your GitHub repository → a Render Web Service → your public HTTPS URL.**

GitHub Pages alone cannot host this app: it serves static files, and this game needs its Node.js multiplayer server running.

## 1. Put this folder on GitHub

### Option A: use the GitHub website

1. Sign in at https://github.com and create a **new repository** named `sweep-race` (or another name).
2. Choose Public or Private. Either works for connecting your own repository to Render. Skip automatic README, license, and `.gitignore` files because this folder already includes them.
3. Choose the option to upload an existing file from the empty repository page, or use **Add file → Upload files**.
4. Open the `Sweep-Race` folder on your Mac. Drag its **contents** into GitHub. Upload `public/` and `test/` as folders, along with the root files. The root of the repository must show `package.json`, `server.mjs`, and `render.yaml` directly, not inside a second `Sweep-Race` folder.
5. Commit the upload.

Finder normally hides dotfiles. For the complete repository including automatic tests, press **Command + Shift + .** in Finder and include `.github/`, `.gitignore`, and `.node-version`. If the browser upload does not accept dotfiles, use Option B. The visible `render.yaml` and application files are enough to run the website; `.github/` enables GitHub’s test workflow.

### Option B: use Terminal

Create an empty repository on GitHub first. Then run these from Terminal, replacing `YOUR-USERNAME` and the repository name in the remote URL:

```sh
cd ~/Downloads/Sweep-Race
git init -b main
git add .
git commit -m "Build multiplayer Minesweeper race"
git remote add origin https://github.com/YOUR-USERNAME/sweep-race.git
git push -u origin main
```

Git may ask you to configure your name/email or authenticate to GitHub. Use your own account; no credentials are included in this project.

## 2. Connect Render

1. Sign in at https://render.com. You can use your GitHub account.
2. In the dashboard, choose **New → Web Service**. Use **Web Service**, not Static Site.
3. Connect GitHub and select your new `sweep-race` repository. If needed, grant Render access to just that repository.
4. Choose these settings:

   | Setting | Value |
   | --- | --- |
   | Branch | `main` |
   | Root Directory | Leave blank if `package.json` is at the repository root |
   | Language / Runtime | Node |
   | Build Command | `npm ci --ignore-scripts && npm test` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

5. Set environment variable `NODE_VERSION` to `22` if Render does not pick up `.node-version` automatically. No secret environment variables are needed.
6. Create the Web Service and wait for the deploy to finish.
7. Open the generated HTTPS address, such as `https://YOUR-SERVICE-NAME.onrender.com`. This is the URL to share with people.

Alternatively, choose **New → Blueprint** and connect the repository. Render reads `render.yaml`, which already specifies the free web-service setup. Review that it shows a free service before creating it. The service name/URL may need to be unique.

After you deploy, new pushes to the connected branch can automatically redeploy your site. Redeploys reset active matches in this version.

## 3. Test the public URL with a friend

1. Open the deployed URL on your iPhone. Enter your name and tap **Create race**.
2. Tap **Share invite** and send the link to a friend on a different device.
3. They enter their name and tap **Join**.
4. Both tap **I’m ready**. You should get the same board and opening.
5. Play a round and a rematch. Try app-switching and returning to Safari.

An invite must use the deployed URL. A `localhost` link only refers to the device opening it and will not work for friends on the internet.

## Can this cost $0?

Yes, for hobby use within the providers’ included usage: use your GitHub account, Render’s **Free** web-service instance, and its included `onrender.com` URL. There is no paid game API or database in this project. A custom domain is optional and typically costs extra to register.

Render documents these free-service limits:

- Services sleep after **15 minutes without incoming traffic**. Waking them takes about **one minute**.
- Sleeping, restarts, and redeploys reset this app’s in-memory rooms. Create a fresh room afterward.
- Free instance hours, bandwidth, and build minutes have monthly limits. Render documents that some usage can incur charges when a payment method is on file; without one, affected services/builds may instead be suspended. Check your dashboard and billing settings before launch.
- Free services can restart unexpectedly. This tier is appropriate for trying the game with friends, rather than guaranteed availability.

Do not choose a paid instance or add paid services unless you want them. Check current pricing before confirming provider signup or deployment; hosting plans can change.

Official references checked while preparing this project:

- [Render: deploy a Node app](https://render.com/docs/deploy-node-express-app)
- [Render: free services and limits](https://render.com/docs/free)
- [Render: Blueprint configuration](https://render.com/docs/blueprint-spec)
- [GitHub: what GitHub Pages supports](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## Troubleshooting

**The page is loading for a long time:** the free service may be waking up. Give it about a minute.

**Room expired or server restarted:** make a new room. This version has no permanent storage.

**Friend sees your player instead of a join screen:** use a different device or private window. Ordinary tabs on the same site share a saved session.

**Cannot find `package.json`:** files are probably inside an extra directory in GitHub. Move them to the repository root, or set Render’s Root Directory to the actual folder containing `package.json`.

**Cross-origin error:** use Render’s direct HTTPS service URL. The app expects the normal Render reverse-proxy headers. Custom reverse proxies must preserve `Host` and set `X-Forwarded-Proto` correctly.

**App works locally but not on GitHub Pages:** deploy it as a Render Web Service. GitHub Pages cannot execute `server.mjs`.
