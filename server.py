#!/usr/bin/env python3
"""FRONTLINE multiplayer server.

Serves the game from ./public and runs private matches over WebSockets on the
same port. Standard library only — run with:  python3 server.py
"""
import asyncio
import base64
import hashlib
import json
import math
import mimetypes
import os
import random
import socket
import struct
import time

PORT = int(os.environ.get("PORT", "3000"))
PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

MAPS = ["harbor", "dust", "foundry", "sundown", "normandy"]
LOADOUTS = ["assault", "smg", "gunner", "marksman"]
MODES = ["ffa", "dom", "hp", "inf", "dday"]
CHARS = ["bulwark", "viper", "wraith", "hawk"]
TEAM_MODES = ("dom", "hp", "inf", "dday")
MAX_PLAYERS = 12
SCORE_LIMIT = {"ffa": 30, "dom": 200, "hp": 150, "inf": 0, "dday": 300}
# D-Day: 100 soldiers, 50 a side. Per side: landing infantry, paratroopers, fighter pilots.
DDAY_ROLES = ({"inf": 20, "para": 15, "jet": 15}, {"inf": 20, "para": 15, "jet": 15})
DDAY_TIME_MS = 15 * 60 * 1000
ROLE_CHOICES = ("random", "inf", "para", "jet")
BOT_NAMES = ["Miller", "Baker", "Carter", "Hayes", "Ward", "Brooks", "Reed", "Price", "Kelly", "Foster",
             "Wagner", "Becker", "Hoffmann", "Krause", "Vogel", "Lang", "Brandt", "Keller", "Roth", "Frank"]
NUKE_KILLS = 20
NUKE_DELAY_MS = 10000
TIME_LIMIT_MS = 10 * 60 * 1000
INF_TIME_LIMIT_MS = 5 * 60 * 1000
DOM_R = 3.5
DDAY_R = 8.0
DOM_CAP_S = 5.0
HP_R = 4.0
HP_ROTATE_MS = 60000
TICK_S = 0.25

# Objective spots per map. Keep in sync with `zones` in public/game.js MAPS.
MAP_ZONES = {
    "harbor": {"dom": [(-23.5, -6), (-4.5, 7.5), (32, 0)],
               "hp": [(-4.5, 7.5), (5.5, -25.5), (32, 0), (0, 23), (-23.5, -6)]},
    "dust": {"dom": [(-30, 2.5), (-6, 0), (30, -3.5)],
             "hp": [(-6, 0), (0, -16), (18, 0), (0, 24), (-18, 0)]},
    "sundown": {"dom": [(-24, 0), (0, -2), (24, 0)],
                "hp": [(0, -2), (-24, 0), (24, 0), (-15.5, -23.5), (5.5, 31)]},
    "foundry": {"dom": [(-27, 0), (0, -7.5), (27.5, 0)],
                "hp": [(0, -7.5), (0, -26.5), (22, -4.5), (0, 17.5), (-22, -4.5)]},
    "normandy": {"dom": [(-25, -40), (25, 10), (85, 50)],
                 "hp": [(-25, -40), (25, 10), (85, 50)]},
}


def dom_like(mode):
    """D-Day plays the flags like Domination."""
    return mode in ("dom", "dday")
COUNTDOWN_MS = 4000
RESPAWN_MS = 3000
LOAD_TIMEOUT_S = 20
REGEN_DELAY_MS = 4000

rooms = {}
_next_id = [1]


def now_ms():
    return int(time.time() * 1000)


# ---------------------------------------------------------------- WebSocket --

class Conn:
    def __init__(self, reader, writer):
        self.reader = reader
        self.writer = writer
        self.closed = False

    async def recv(self):
        """Return the next text message, or None when the socket closes."""
        buf = b""
        while True:
            head = await self.reader.readexactly(2)
            fin = head[0] & 0x80
            opcode = head[0] & 0x0F
            masked = head[1] & 0x80
            length = head[1] & 0x7F
            if length == 126:
                length = struct.unpack(">H", await self.reader.readexactly(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", await self.reader.readexactly(8))[0]
            if length > 1 << 20:
                return None
            mask = await self.reader.readexactly(4) if masked else b"\0\0\0\0"
            data = bytearray(await self.reader.readexactly(length))
            for i in range(length):
                data[i] ^= mask[i & 3]
            if opcode == 0x8:
                return None
            if opcode == 0x9:
                self._frame(0xA, bytes(data))
                continue
            if opcode == 0xA:
                continue
            buf += data
            if fin:
                return buf.decode("utf-8", "replace")

    def _frame(self, opcode, payload):
        if self.closed:
            return
        n = len(payload)
        if n < 126:
            header = struct.pack(">BB", 0x80 | opcode, n)
        elif n < 65536:
            header = struct.pack(">BBH", 0x80 | opcode, 126, n)
        else:
            header = struct.pack(">BBQ", 0x80 | opcode, 127, n)
        try:
            self.writer.write(header + payload)
        except Exception:
            self.closed = True

    def send_raw(self, text):
        self._frame(0x1, text.encode("utf-8"))

    def close(self):
        if not self.closed:
            self.closed = True
            try:
                self.writer.close()
            except Exception:
                pass


# -------------------------------------------------------------------- Rooms --

class BotConn:
    closed = False

    def send_raw(self, text):
        pass

    def close(self):
        pass


class Player:
    def __init__(self, conn):
        self.id = _next_id[0]
        _next_id[0] += 1
        self.conn = conn
        self.name = "Player"
        self.room = None
        self.loadout = "assault"
        self.char = "bulwark"
        self.team = -1
        self.role = ""
        self.pref_role = "random"
        self.bot = False
        self.reset()

    def reset(self):
        self.kills = 0
        self.deaths = 0
        self.hp = 100
        self.alive = False
        self.loaded = False
        self.died_at = 0
        self.last_hit = 0
        self.pos = None

    def public(self):
        return {"id": self.id, "name": self.name, "loadout": self.loadout, "char": self.char, "team": self.team,
                "role": self.role, "bot": self.bot, "kills": self.kills, "deaths": self.deaths, "hp": self.hp, "alive": self.alive}


class Room:
    def __init__(self, code, host):
        self.code = code
        self.host_id = host.id
        self.map = "harbor"
        self.mode = "ffa"
        self.state = "lobby"
        self.players = {}
        self.start_at = 0
        self.end_at = 0
        self.load_task = None
        self.nuke_at = 0
        self.nuke_by = None
        self.reset_objectives()

    def reset_objectives(self):
        self.scores = [0.0, 0.0]
        self.flags = [{"owner": -1, "cap": -1, "prog": 0.0, "contested": False}
                      for _ in MAP_ZONES[self.map]["dom"]]
        self.hp_idx = 0
        self.hp_until = 0
        self.hp_holder = -1
        self.ticks = 0

    def teams_on(self):
        return self.mode in TEAM_MODES

    def obj(self):
        s = [int(self.scores[0]), int(self.scores[1])]
        if dom_like(self.mode):
            return {"s": s, "f": [[f["owner"], f["cap"], round(f["prog"], 2), f["contested"]] for f in self.flags]}
        if self.mode == "hp":
            return {"s": s, "hp": [self.hp_idx, self.hp_until, self.hp_holder]}
        return {"s": s}


def send(p, msg):
    p.conn.send_raw(json.dumps(msg, separators=(",", ":")))


def broadcast(room, msg, except_id=None):
    text = json.dumps(msg, separators=(",", ":"))
    for p in list(room.players.values()):
        if p.id != except_id:
            p.conn.send_raw(text)


def lobby_state(room):
    return {"t": "lobby", "code": room.code, "hostId": room.host_id, "map": room.map, "mode": room.mode,
            "state": room.state, "players": [p.public() for p in room.players.values()]}


def go_msg(room):
    return {"t": "go", "mode": room.mode, "startAt": room.start_at, "endAt": room.end_at,
            "scoreLimit": SCORE_LIMIT[room.mode], "obj": room.obj(), "nukeKills": NUKE_KILLS, "nukeAt": room.nuke_at, "nukeBy": room.nuke_by,
            "players": [p.public() for p in room.players.values()]}


def make_code():
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(random.choice(chars) for _ in range(6))
        if code not in rooms:
            return code


def clean_name(n):
    n = "".join(ch for ch in str(n or "") if ch.isprintable()).strip()[:16]
    return n or "Soldier"


def join_room(p, room):
    p.room = room
    p.reset()
    room.players[p.id] = p
    send(p, {"t": "welcome", "id": p.id, "code": room.code})
    broadcast(room, lobby_state(room))
    if room.state != "lobby":
        send(p, {"t": "load", "map": room.map})


def leave_room(p):
    room = p.room
    if not room:
        return
    room.players.pop(p.id, None)
    p.room = None
    if not humans(room):
        if room.load_task:
            room.load_task.cancel()
        rooms.pop(room.code, None)
        return
    if room.host_id == p.id:
        room.host_id = humans(room)[0].id
    broadcast(room, {"t": "left", "id": p.id, "name": p.name})
    broadcast(room, lobby_state(room))
    if room.state == "loading":
        check_all_loaded(room)
    elif room.state == "playing" and room.mode == "inf":
        check_infected(room)


def start_loading(room):
    room.state = "loading"
    room.nuke_at = 0
    room.nuke_by = None
    room.reset_objectives()
    remove_bots(room)
    for p in room.players.values():
        p.reset()
        p.team = -1
        p.role = ""
    broadcast(room, lobby_state(room))
    broadcast(room, {"t": "load", "map": room.map})

    async def timeout():
        await asyncio.sleep(LOAD_TIMEOUT_S)
        begin_match(room)
    room.load_task = asyncio.ensure_future(timeout())


def check_all_loaded(room):
    if room.state == "loading" and room.players and all(p.loaded for p in humans(room)):
        begin_match(room)


def begin_match(room):
    """Everyone has the map ready: give all clients the same start time."""
    if room.state != "loading":
        return
    if room.load_task:
        room.load_task.cancel()
        room.load_task = None
    room.state = "playing"
    room.start_at = now_ms() + COUNTDOWN_MS
    room.end_at = room.start_at + (INF_TIME_LIMIT_MS if room.mode == "inf" else DDAY_TIME_MS if room.mode == "dday" else TIME_LIMIT_MS)
    room.hp_until = room.start_at + HP_ROTATE_MS
    for p in room.players.values():
        p.alive = p.loaded
        p.hp = 100
    assign_teams(room)
    if room.mode == "dday":
        fill_dday(room)
    broadcast(room, go_msg(room))


def fill_dday(room):
    """Give each human a random role, then fill every empty slot with a bot."""
    quota = [dict(q) for q in DDAY_ROLES]
    people = list(room.players.values())
    random.shuffle(people)
    for p in sorted(people, key=lambda x: x.pref_role == "random"):
        q = quota[p.team]
        open_roles = [r for r, n in q.items() if n > 0] or ["inf"]
        p.role = p.pref_role if q.get(p.pref_role, 0) > 0 else random.choice(open_roles)
        q[p.role] = max(0, q.get(p.role, 0) - 1)
    for team in (0, 1):
        for role, n in quota[team].items():
            for _ in range(n):
                b = Player(BotConn())
                b.bot, b.team, b.role, b.room = True, team, role, room
                b.name = ("Pvt. " if team == 0 else "Gfr. ") + random.choice(BOT_NAMES)
                b.char, b.loadout = random.choice(CHARS), random.choice(LOADOUTS)
                b.loaded = b.alive = True
                room.players[b.id] = b


def remove_bots(room):
    for pid in [pid for pid, x in room.players.items() if x.bot]:
        room.players.pop(pid)


def humans(room):
    return [x for x in room.players.values() if not x.bot]


def kill_self(room, p, w):
    """Crashes and other deaths with nobody to blame."""
    p.hp = 0
    p.alive = False
    p.deaths += 1
    p.died_at = now_ms()
    broadcast(room, {"t": "kill", "killer": p.id, "victim": p.id, "head": False, "w": w,
                     "kk": p.kills, "vd": p.deaths, "vt": p.team})


def assign_teams(room):
    players = list(room.players.values())
    random.shuffle(players)
    for i, p in enumerate(players):
        if room.mode == "inf":
            p.team = 0
        elif room.teams_on():
            p.team = i % 2
        else:
            p.team = -1
    if room.mode == "inf" and players:
        players[0].team = 1


def check_infected(room):
    """Infected needs a zombie and a survivor; fix it up after someone leaves."""
    survivors = [p for p in room.players.values() if p.team == 0]
    if not survivors:
        return end_match(room)
    if not any(p.team == 1 for p in room.players.values()) and len(survivors) > 1:
        z = random.choice(survivors)
        z.team = 1
        broadcast(room, {"t": "team", "id": z.id, "team": 1})


def winning_team(room):
    if room.nuke_by is not None and room.nuke_by in room.players:
        return room.players[room.nuke_by].team
    if room.mode == "inf":
        return 0 if any(p.team == 0 for p in room.players.values()) else 1
    if dom_like(room.mode) or room.mode == "hp":
        a, b = room.scores
        return -1 if int(a) == int(b) else (0 if a > b else 1)
    return -1


def end_match(room):
    room.state = "lobby"
    for p in room.players.values():
        p.alive = False
        p.loaded = False
    standings = sorted((p.public() for p in room.players.values()),
                       key=lambda x: (x["id"] != room.nuke_by, -x["kills"], x["deaths"]))
    broadcast(room, {"t": "end", "players": standings, "nukeBy": room.nuke_by, "mode": room.mode,
                     "winTeam": winning_team(room), "scores": [int(x) for x in room.scores]})
    room.nuke_at = 0
    room.nuke_by = None
    remove_bots(room)
    broadcast(room, lobby_state(room))


def on_loaded(room, p):
    p.loaded = True
    if room.state == "loading":
        done = sum(1 for x in room.players.values() if x.loaded)
        broadcast(room, {"t": "loadProgress", "loaded": done, "total": len(room.players)})
        check_all_loaded(room)
    elif room.state == "playing":
        # Joined mid-match: drop straight in.
        p.alive = True
        p.hp = 100
        if room.mode == "dday":
            sizes = [sum(1 for x in humans(room) if x.team == t and x is not p) for t in (0, 1)]
            team = 0 if sizes[0] <= sizes[1] else 1
            bots = [x for x in room.players.values() if x.bot and x.team == team]
            p.team = team
            wanted = [x for x in bots if x.role == p.pref_role]
            p.role = random.choice(wanted or bots).role if bots else random.choice(["inf", "para", "jet"])
            same = [x for x in bots if x.role == p.role]
            if same:
                room.players.pop(same[0].id)
                broadcast(room, {"t": "left", "id": same[0].id, "name": same[0].name}, p.id)
        elif room.mode == "inf":
            p.team = 1
        elif room.teams_on():
            sizes = [sum(1 for x in room.players.values() if x.team == t and x is not p) for t in (0, 1)]
            p.team = 0 if sizes[0] <= sizes[1] else 1
        broadcast(room, {"t": "team", "id": p.id, "team": p.team, "role": p.role}, p.id)
        send(p, go_msg(room))
        broadcast(room, {"t": "spawned", "id": p.id}, p.id)


def on_hit(room, p, m):
    if room.state != "playing" or now_ms() < room.start_at:
        return
    t = room.players.get(m.get("target"))
    if not t or t is p or not p.alive or not t.alive:
        return
    if room.teams_on() and t.team == p.team:
        return
    try:
        dmg = max(0, min(250, float(m.get("dmg", 0))))
    except (TypeError, ValueError):
        return
    t.hp -= dmg
    t.last_hit = now_ms()
    if t.hp <= 0:
        t.hp = 0
        t.alive = False
        t.deaths += 1
        t.died_at = now_ms()
        p.kills += 1
        if room.mode == "inf" and t.team == 0:
            t.team = 1
        broadcast(room, {"t": "kill", "killer": p.id, "victim": t.id, "head": bool(m.get("head")),
                         "w": str(m.get("w", ""))[:12], "kk": p.kills, "vd": t.deaths, "vt": t.team})
        if room.mode == "ffa" and p.kills >= SCORE_LIMIT["ffa"]:
            end_match(room)
        elif room.mode == "inf" and not any(x.team == 0 for x in room.players.values()):
            end_match(room)
    else:
        broadcast(room, {"t": "damage", "target": t.id, "from": p.id, "hp": round(t.hp)})


def handle(p, m):
    t = m.get("t")
    if t == "ping":
        return send(p, {"t": "pong", "c": m.get("c"), "s": now_ms()})
    if t == "create":
        leave_room(p)
        p.name = clean_name(m.get("name"))
        if m.get("loadout") in LOADOUTS:
            p.loadout = m["loadout"]
        if m.get("char") in CHARS:
            p.char = m["char"]
        if m.get("role") in ROLE_CHOICES:
            p.pref_role = m["role"]
        room = Room(make_code(), p)
        rooms[room.code] = room
        return join_room(p, room)
    if t == "join":
        code = str(m.get("code", "")).upper().strip()
        room = rooms.get(code)
        if not room:
            return send(p, {"t": "error", "msg": f"No match found with code {code or '(blank)'}"})
        if len(humans(room)) >= MAX_PLAYERS and p.id not in room.players:
            return send(p, {"t": "error", "msg": "That match is full"})
        leave_room(p)
        p.name = clean_name(m.get("name"))
        if m.get("loadout") in LOADOUTS:
            p.loadout = m["loadout"]
        if m.get("char") in CHARS:
            p.char = m["char"]
        if m.get("role") in ROLE_CHOICES:
            p.pref_role = m["role"]
        return join_room(p, room)

    room = p.room
    if not room:
        return
    if t == "leave":
        leave_room(p)
    elif t == "setMap":
        if p.id == room.host_id and room.state == "lobby" and m.get("map") in MAPS \
                and (m["map"] == "normandy") == (room.mode == "dday"):
            room.map = m["map"]
            room.reset_objectives()
            broadcast(room, lobby_state(room))
    elif t == "setMode":
        if p.id == room.host_id and room.state == "lobby" and m.get("mode") in MODES:
            room.mode = m["mode"]
            # D-Day has its own map; leaving D-Day goes back to a normal one.
            if room.mode == "dday":
                room.map = "normandy"
            elif room.map == "normandy":
                room.map = "harbor"
            room.reset_objectives()
            broadcast(room, lobby_state(room))
    elif t == "setChar":
        if m.get("char") in CHARS:
            p.char = m["char"]
            broadcast(room, lobby_state(room))
    elif t == "setLoadout":
        if m.get("loadout") in LOADOUTS:
            p.loadout = m["loadout"]
            broadcast(room, lobby_state(room))
    elif t == "start":
        if p.id == room.host_id and room.state == "lobby":
            start_loading(room)
    elif t == "loaded":
        on_loaded(room, p)
    elif t == "state":
        if room.state == "playing" and p.alive:
            pos = m.get("p")
            if isinstance(pos, list) and len(pos) == 3 and all(isinstance(v, (int, float)) for v in pos):
                p.pos = pos
            broadcast(room, {"t": "state", "id": p.id, "p": m.get("p"), "y": m.get("y"), "x": m.get("x"),
                             "c": m.get("c"), "s": m.get("s"), "w": m.get("w"),
                             "r": m.get("r"), "z": m.get("z")}, p.id)
    elif t == "shot":
        if room.state == "playing" and p.alive:
            broadcast(room, {"t": "shot", "id": p.id, "f": m.get("f"), "e": m.get("e"), "w": m.get("w")}, p.id)
    elif t == "hit":
        on_hit(room, p, m)
    elif t == "throw":
        if room.state == "playing" and p.alive and m.get("k") in ("frag", "smoke", "bomb"):
            broadcast(room, {"t": "throw", "id": p.id, "k": m["k"], "p": m.get("p"), "v": m.get("v")}, p.id)
    elif t == "nuke":
        if room.state == "playing" and room.mode != "inf" and not room.nuke_at and p.kills >= NUKE_KILLS:
            room.nuke_at = now_ms() + NUKE_DELAY_MS
            room.nuke_by = p.id
            broadcast(room, {"t": "nuke", "by": p.id, "at": room.nuke_at})
    elif t == "setRole":
        set_role(room, p, m.get("role"))
    elif t == "crash":
        if room.state == "playing" and p.alive:
            kill_self(room, p, "crash")
    elif t in ("bstate", "bshot", "bhit", "brespawn", "bthrow", "bcrash"):
        handle_bots(room, p, t, m)
    elif t == "respawn":
        if room.state == "playing" and not p.alive and p.loaded and now_ms() - p.died_at >= RESPAWN_MS - 400:
            p.alive = True
            p.hp = 100
            p.pos = None
            broadcast(room, {"t": "spawned", "id": p.id, "team": p.team})


def set_role(room, p, role):
    """Before a match this is a preference. In D-Day it trades roles with a bot on your
    team, so each side keeps its 50/25/25 split; the new role starts on your next spawn."""
    if role not in ROLE_CHOICES:
        return
    p.pref_role = role
    if room.state != "playing" or room.mode != "dday" or role == "random" or role == p.role:
        return
    bots = [x for x in room.players.values() if x.bot and x.team == p.team and x.role == role]
    if not bots:
        return send(p, {"t": "roleFull", "role": role})
    b = random.choice(sorted(bots, key=lambda x: x.alive)[:max(1, len(bots) // 2)])
    b.role, p.role = p.role, role
    broadcast(room, {"t": "role", "id": p.id, "role": p.role})
    broadcast(room, {"t": "role", "id": b.id, "role": b.role})


def handle_bots(room, p, t, m):
    """The host's game runs the D-Day bots and reports what they do."""
    if p.id != room.host_id or room.state != "playing":
        return
    if t == "bstate":
        out = []
        for e in m.get("b") or []:
            if not (isinstance(e, list) and len(e) >= 4 and all(isinstance(v, (int, float)) for v in e[1:4])):
                continue
            b = room.players.get(e[0])
            if b and b.bot and b.alive:
                b.pos = e[1:4]
                out.append(e)
        shots = [x for x in (m.get("s") or [])[:400]
                 if isinstance(x, list) and len(x) == 8 and getattr(room.players.get(x[0]), "bot", False)]
        if out or shots:
            broadcast(room, {"t": "bstate", "b": out, "s": shots}, p.id)
        return
    b = room.players.get(m.get("id"))
    if not b or not b.bot:
        return
    if t == "bshot" and b.alive:
        broadcast(room, {"t": "shot", "id": b.id, "f": m.get("f"), "e": m.get("e"), "w": m.get("w")}, p.id)
    elif t == "bthrow" and b.alive and m.get("k") in ("frag", "bomb"):
        broadcast(room, {"t": "throw", "id": b.id, "k": m["k"], "p": m.get("p"), "v": m.get("v")}, p.id)
    elif t == "bhit":
        on_hit(room, b, m)
    elif t == "bcrash" and b.alive:
        kill_self(room, b, "crash")
    elif t == "brespawn" and not b.alive and now_ms() - b.died_at >= RESPAWN_MS - 400:
        b.alive = True
        b.hp = 100
        b.pos = None
        broadcast(room, {"t": "spawned", "id": b.id, "team": b.team})


async def tick():
    while True:
        await asyncio.sleep(TICK_S)
        n = now_ms()
        for room in list(rooms.values()):
            if room.state != "playing":
                continue
            if n >= room.end_at or (room.nuke_at and n >= room.nuke_at):
                end_match(room)
                continue
            if (dom_like(room.mode) or room.mode == "hp") and n >= room.start_at:
                update_objectives(room, n)
                if room.state != "playing":
                    continue
            for p in room.players.values():
                if p.alive and p.hp < 100 and n - p.last_hit > REGEN_DELAY_MS:
                    p.hp = min(100, p.hp + 12)
                    send(p, {"t": "hp", "hp": round(p.hp)})


def zone_counts(room, x, z, r):
    """Alive players of each team standing inside a circular zone."""
    counts = [0, 0]
    for p in room.players.values():
        if p.alive and p.pos and p.team in (0, 1) and p.pos[1] < 6 and math.hypot(p.pos[0] - x, p.pos[2] - z) < r:
            counts[p.team] += 1
    return counts


def update_objectives(room, n):
    room.ticks += 1
    if dom_like(room.mode):
        for i, (x, z) in enumerate(MAP_ZONES[room.map]["dom"]):
            f = room.flags[i]
            c = zone_counts(room, x, z, DDAY_R if room.mode == "dday" else DOM_R)
            f["contested"] = c[0] > 0 and c[1] > 0
            if f["contested"]:
                continue
            team = 0 if c[0] else 1 if c[1] else -1
            if team < 0 or team == f["owner"]:
                f["prog"] = max(0.0, f["prog"] - TICK_S / DOM_CAP_S)
                if f["prog"] == 0:
                    f["cap"] = -1
                continue
            if f["cap"] != team:
                f["cap"], f["prog"] = team, 0.0
            # Taking an enemy flag takes longer than a neutral one; more players cap faster.
            need = DOM_CAP_S * (1.6 if f["owner"] >= 0 else 1.0)
            f["prog"] += TICK_S / need * min(3, c[team])
            if f["prog"] >= 1:
                f["owner"], f["cap"], f["prog"] = team, -1, 0.0
                broadcast(room, {"t": "cap", "i": i, "team": team})
        for f in room.flags:
            if f["owner"] >= 0:
                room.scores[f["owner"]] += TICK_S
    else:
        zones = MAP_ZONES[room.map]["hp"]
        if n >= room.hp_until:
            room.hp_idx = (room.hp_idx + 1) % len(zones)
            room.hp_until += HP_ROTATE_MS
            broadcast(room, {"t": "hpmove", "i": room.hp_idx})
        x, z = zones[room.hp_idx]
        c = zone_counts(room, x, z, HP_R)
        room.hp_holder = 2 if c[0] and c[1] else 0 if c[0] else 1 if c[1] else -1
        if room.hp_holder in (0, 1):
            room.scores[room.hp_holder] += TICK_S
    broadcast(room, dict(room.obj(), t="obj"))
    if max(room.scores) >= SCORE_LIMIT[room.mode]:
        end_match(room)


# --------------------------------------------------------------------- HTTP --

async def serve_ws(reader, writer, headers):
    key = headers.get("sec-websocket-key", "")
    accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
    writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                  f"Sec-WebSocket-Accept: {accept}\r\n\r\n").encode())
    conn = Conn(reader, writer)
    p = Player(conn)
    try:
        while True:
            text = await conn.recv()
            if text is None:
                break
            try:
                m = json.loads(text)
            except ValueError:
                continue
            if isinstance(m, dict):
                handle(p, m)
            await writer.drain()
    except (asyncio.IncompleteReadError, ConnectionError, OSError):
        pass
    finally:
        leave_room(p)
        conn.close()


def serve_file(writer, path):
    rel = path.split("?")[0]
    if rel == "/":
        rel = "/index.html"
    full = os.path.normpath(os.path.join(PUBLIC, rel.lstrip("/")))
    if not full.startswith(PUBLIC) or not os.path.isfile(full):
        writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot found")
        return
    with open(full, "rb") as f:
        body = f.read()
    ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
    if full.endswith(".js"):
        ctype = "text/javascript"
    writer.write((f"HTTP/1.1 200 OK\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\n"
                  "Cache-Control: no-cache\r\nConnection: close\r\n\r\n").encode() + body)


async def on_client(reader, writer):
    try:
        request = (await reader.readuntil(b"\r\n\r\n")).decode("latin-1")
    except Exception:
        writer.close()
        return
    lines = request.split("\r\n")
    parts = lines[0].split(" ")
    path = parts[1] if len(parts) > 1 else "/"
    headers = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    if headers.get("upgrade", "").lower() == "websocket":
        await serve_ws(reader, writer, headers)
        return
    serve_file(writer, path)
    try:
        await writer.drain()
    finally:
        writer.close()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


async def main():
    server = await asyncio.start_server(on_client, "0.0.0.0", PORT)
    asyncio.ensure_future(tick())
    print("\n  FRONTLINE server running")
    print(f"  You:              http://localhost:{PORT}")
    print(f"  Friends (same Wi-Fi): http://{lan_ip()}:{PORT}\n", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
