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

**D-Day** (50 vs 50 on Normandy): pick your role (or Random) in the lobby, and switch mid-match from the death screen (keys 7/8/9) or the pause menu; you trade places with a bot on your side and the new role starts on your next spawn. Landing infantry (the Allies ride landing craft onto the beach; the Axis hold the trenches), paratroopers (ride in standing in the door of a troop carrier: C-47s for the Allies, Ju 52s for the Axis, flying in Vics of three like the real D-Day drops; the light goes red for READY, then green for JUMP, so press Space; the static line opens your chute, then steer with WASD and shoot on the way down) or fighter pilots (mouse steers, W/S throttle, click for guns, right-click/F/Space for bombs). Bot fighters fly in WWII flights: a finger-four (the German Schwarm, two pairs), a Vic of three or a pair. Wingmen hold their slots, bomb when their leader does and break off to fight enemy planes that come close. Your own plane always flies free. Bots fill every empty slot so both sides always have 20 infantry, 15 paratroopers and 15 pilots. Planes are fragile: every hit on one does triple damage, so a couple of rifle hits bring one down. The map is 480 m across: hold flags A and B (bunkers on the bluff), C (village), D (farm) and E (gun battery); first to 500. Online, the host's game runs the bots, so the host should keep the game tab open and in front.

Modes: Deathmatch (first to 30 kills), Domination (hold flags A/B/C, first to 200), Hardpoint (hold the moving hill, first to 150), Infected (one knife zombie; everyone it kills turns; survive 5 minutes). The host picks the mode in the lobby; all four also work offline vs bots. Reach 20 kills to call a tactical nuke (not in Infected).

## Host it 24/7 (works with this Mac off)

The repo is ready for [Render](https://render.com)'s free plan (`Dockerfile` + `render.yaml`):

1. Push this folder to a GitHub repo.
2. On Render: **New → Blueprint**, pick the repo, click **Apply**.
3. You get a permanent link like `https://frontline-xxxx.onrender.com`.

Free-plan servers go to sleep after 15 minutes with nobody playing; the first visit after that takes about a minute to wake it.
