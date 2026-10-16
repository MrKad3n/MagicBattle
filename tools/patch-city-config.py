from pathlib import Path
p = Path(r"C:\Users\kaden\OneDrive\Documents\GitHub\Games\dungeon.html")
text = p.read_text(encoding="utf-8")
old_start = "/* =============================================================\n   EMBERFALL CITY CONFIG\n   ============================================================= */\nconst CITY_CONFIG = {"
old_end = "/* =============================================================\n   SYLVARIS WILDES CONFIG\n   ============================================================= */"
i = text.find(old_start)
j = text.find(old_end)
if i < 0 or j < 0:
    raise SystemExit(f"markers not found {i} {j}")
new = """/* =============================================================
   EMBERFALL CITY CONFIG
   ============================================================= */
const CITY_CONFIG = (typeof EMBERFALL_CITY === 'object' && EMBERFALL_CITY) ? EMBERFALL_CITY : {
	name: 'EmberFall City', worldW: 22000, worldH: 5600, groundY: 4800,
	playerStart: { x: 980, y: 4730 }, platforms: [], buildings: [], lanterns: [],
	npcs: [], walkers: [], dummies: [], slimeSpawns: []
};

"""
text = text[:i] + new + text[j:]
needle = '<script src="conversational-npc.js"></script>'
ins = '<script src="emberfall-city.js?v=1"></script>\n<script src="conversational-npc.js"></script>'
if "emberfall-city.js" not in text:
    text = text.replace(needle, ins, 1)
p.write_text(text, encoding="utf-8")
print("ok", i, j)
