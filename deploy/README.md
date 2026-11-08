# Running the Planning Tool on the Mac mini

The Mac mini runs a small server that stores everything in one SQLite file,
syncs your laptop and phone, and serves the app itself. Tailscale gives it a
private HTTPS address that only your own devices can reach, from anywhere,
with no ports opened on your router.

```
 iPhone / laptop ──HTTPS over Tailscale──▶ tailscale serve ──▶ 127.0.0.1:3000 (this server)
                                                                   │
                                          ~/PlanningTool/planning.db + backups/
```

Plan for about 20 minutes. Everything below runs on the Mac mini unless it says otherwise.

## 1. Prepare the Mac mini

**Software:** [Homebrew](https://brew.sh), then:

```bash
brew install node pnpm git
```

Any Node version from 22 up works (`node --version`).

**Keep it available:** in System Settings:

- **Energy**: turn on _Prevent automatic sleeping when the display is off_ and
  _Start up automatically after a power failure_.
- **Users & Groups**: turn on _Automatically log in as …_. The server starts when
  you are logged in. If FileVault is on, macOS can't log in by itself after a
  restart: after a power cut, log in once (screen sharing works) and the server
  starts.

## 2. Install the server

```bash
git clone https://github.com/nick442/Planning_tool.git ~/Code/Planning_tool
```

```bash
cd ~/Code/Planning_tool && deploy/install.sh
```

This builds the app, installs a launchd service that starts at login and
restarts if it ever stops, and prints an **access token**. Keep that token:
each device needs it once.

What goes where:

| What            | Where                                                     |
| --------------- | --------------------------------------------------------- |
| Database        | `~/PlanningTool/planning.db`                              |
| Nightly backups | `~/PlanningTool/backups/planning-YYYY-MM-DD.db` (30 kept) |
| Log             | `~/Library/Logs/planning-tool.log`                        |
| Service file    | `~/Library/LaunchAgents/com.planningtool.server.plist`    |

To change the locations or the port, set `PLANNING_DATA_DIR`,
`PLANNING_BACKUP_DIR` or `PLANNING_PORT` and run `deploy/install.sh` again. For
example, to keep the backups in iCloud Drive as well as Time Machine:

```bash
PLANNING_BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Planning backups" deploy/install.sh
```

Reinstalling keeps the existing token.

Check that it runs:

```bash
curl http://127.0.0.1:3000/api/health
```

## 3. Give it an HTTPS address with Tailscale

1. Install Tailscale on the **Mac mini, laptop and phone** (Mac App Store /
   App Store / Google Play, or [tailscale.com/download](https://tailscale.com/download))
   and sign in with the same account everywhere. On the Mac mini, enable
   _Launch at login_ in the Tailscale menu.
2. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), under
   **DNS**, make sure **MagicDNS** is on and enable **HTTPS Certificates**.
3. On the Mac mini, forward HTTPS to the server:

   ```bash
   tailscale serve --bg 3000
   ```

   With the Tailscale app from the App Store the command is
   `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 3000`.
   It prints the address, something like `https://mac-mini.tail1234.ts.net`.
   The setting survives restarts; `tailscale serve status` shows it.

Only devices signed in to your tailnet can open that address, and the access
token is a second lock on the data.

## 4. Set up each device

Open the address from step 3 on the device (Tailscale must be connected).

1. Tap **Enter sync token** at the bottom of the goal list (on a phone, top right
   inside a goal) and paste the token. The status turns to **Synced**.
2. Install the app:
   - **iPhone / iPad**: Safari → Share → **Add to Home Screen**.
   - **Android**: Chrome → ⋮ → **Install app**.
   - **Laptop**: Chrome/Edge → the install icon in the address bar, or Safari →
     File → **Add to Dock**.

The installed app opens full screen and works without a connection; changes
sync when the Mac mini can be reached again.

## Backups

- **Nightly copies**: every day after 03:00 the server copies the database to
  the backup folder (made safely while it runs) and keeps the newest 30. If the
  Mac was asleep, the copy is made as soon as it wakes. `curl
http://127.0.0.1:3000/api/health` shows the latest one (`lastBackup`).
- **Time Machine**: backs up `~/PlanningTool` along with the rest of your home folder.
- **Your own copy**: in the app, **Export / import → Download JSON export**
  saves everything as a JSON file, on any device.

### Restoring

From a nightly backup:

```bash
deploy/restore.sh
```

```bash
deploy/restore.sh planning-2026-11-07.db
```

The first lists the backups, the second restores one. The current database is kept as
`planning.db.before-restore-<time>`. The restored database gets a new sync
identity, so every device sends it everything it has: changes made after the
backup come back as soon as each device syncs.

From a JSON export: in the app, **Export / import → Import JSON file**. Imports
merge: where a record exists in both places, the most recently changed version
wins, so an old file never overwrites newer work.

## Updating

```bash
cd ~/Code/Planning_tool && deploy/update.sh
```

This pulls the latest code, rebuilds and restarts the service. Open apps show a
**New version is ready · Reload** message.

## Troubleshooting

| Symptom                              | What to check                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Address doesn't open                 | Is Tailscale connected on this device and on the Mac mini? `tailscale serve status` on the Mac mini.      |
| App says **Offline** while online    | Same as above; `curl http://127.0.0.1:3000/api/health` on the Mac mini.                                   |
| App says **Enter sync token**        | Tap it and paste the token (printed by `install.sh`; also in the service file under `PLANNING_TOKEN`).    |
| Server not running                   | `launchctl print gui/$(id -u)/com.planningtool.server` and `tail -n 50 ~/Library/Logs/planning-tool.log`. |
| Port 3000 is taken by something else | `PLANNING_PORT=3100 deploy/install.sh`, then `tailscale serve --bg 3100`.                                 |
| Start over with the service          | `deploy/uninstall.sh` (keeps the data), then `deploy/install.sh`.                                         |
