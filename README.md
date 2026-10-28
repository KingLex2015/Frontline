# FRONTLINE

A multiplayer browser FPS: private matches with a join code, 3 maps, and 4 loadouts.

## Run it

```bash
python3 server.py
```

Open http://localhost:3000. No installs needed (Python 3 only; Three.js loads from a CDN).

## Play with friends

1. Click **Create Private Match**. You get a 6-character code.
2. Friends open the game and type the code (or use the **Copy Invite** link).
3. The host picks the map and presses **Start Match**. Every player loads the map, the
   server waits until all of them report ready, then gives everyone the same countdown.
   Players who join mid-match drop straight in.

- **Same Wi-Fi:** friends open `http://<your-computer's-IP>:3000` (the server prints it).
- **Over the internet:** with the server running, start a Cloudflare tunnel (the tool is in `tools/`):

  ```bash
  tools/cloudflared tunnel --no-autoupdate --protocol http2 --url http://localhost:3000
  ```

  It prints a `https://….trycloudflare.com` link. Send that to friends. The link changes each time
  the tunnel restarts and only works while this Mac is on.

## Loadouts

| Loadout  | Primary            | Secondary          |
|----------|--------------------|--------------------|
| Assault  | M4 Vanguard (AR)   | P-11 pistol        |
| SMG      | Viper-9            | P-11 pistol        |
| Gunner   | Titan LMG (100 rd) | P-11 pistol        |
| Marksman | Longbow .50 sniper | Ranger DMR sniper  |

## Controls

WASD move · Shift sprint (hold while scoped to steady aim) · Space jump · C crouch / slide while sprinting ·
Hold F to aim (right mouse also works) · T frag grenade · Y smoke grenade · N call nuke (at 20 kills) · Left mouse fire · R reload · 1/2/Q/wheel swap · Tab scoreboard · Esc pause (loadout + settings)

Modes: Deathmatch (first to 30 kills), Domination (hold flags A/B/C, first to 200), Hardpoint (hold the moving hill, first to 150), Infected (one knife zombie; everyone it kills turns; survive 5 minutes). The host picks the mode in the lobby; all four also work offline vs bots. Reach 20 kills to call a tactical nuke (not in Infected).

## Host it 24/7 (works with this Mac off)

The repo is ready for [Render](https://render.com)'s free plan (`Dockerfile` + `render.yaml`):

1. Push this folder to a GitHub repo.
2. On Render: **New → Blueprint**, pick the repo, click **Apply**.
3. You get a permanent link like `https://frontline-xxxx.onrender.com`.

Free-plan servers go to sleep after 15 minutes with nobody playing; the first visit after that takes about a minute to wake it.
