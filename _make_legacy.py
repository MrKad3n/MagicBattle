"""Reconstruct the pre-fix fire generator so the test harness can be A/B validated."""
from pathlib import Path

src = Path('fire-dungeon-world.js').read_text(encoding='utf-8')

# 1) shallow inset, no raised-floor aware depth
src = src.replace(
    """		/* Penetration into room shells — depth only, not door aperture size. */
		const HALL_INSET = 240;""",
    """		const HALL_INSET = 200;""", 1)
src = src.replace(
    """		function throatDepth(room){
			/* Raised floors act like a thick inner wall at the door; dig past them. */
			const raised = (room && room.raisedFloor) || 0;
			return Math.max(HALL_INSET, raised + 200);
		}
""", """		function throatDepth(room){ return HALL_INSET; }
""", 1)

# 2) old exitAnchor: no raised-floor door seating
src = src.replace(
    """			if(dir === 'left' || dir === 'right'){
				const doorH = ex.h || DOOR_H;
				let y = room.y + (ex.y != null ? ex.y : Math.round((room.h - doorH) * 0.42));
				/* Seat the door on the raised walk surface so the hall floor meets the room floor. */
				if(room.raisedFloor){
					const walk = room.y + room.h - room.raisedFloor;
					if(y + doorH > walk + 8) y = walk - doorH + 16;
				}
				return {
					x: dir === 'left' ? room.x : room.x + room.w,
					y: snap(y),
					w: 8,
					h: doorH,
				};
			}""",
    """			if(dir === 'left') return { x: room.x, y: room.y + (ex.y != null ? ex.y : Math.round((room.h - DOOR_H) * 0.42)), w: 8, h: ex.h || DOOR_H };
			if(dir === 'right') return { x: room.x + room.w, y: room.y + (ex.y != null ? ex.y : Math.round((room.h - DOOR_H) * 0.42)), w: 8, h: ex.h || DOOR_H };""", 1)

# 3) old openExit: Y-shifted punch, no throat stub carve, no +TILE
src = src.replace(
    """			const depth = throatDepth(room);
			/* Punch at the same Y the hall carves — deepen into the room, keep door size. */
			const openY = snap(A.y);
			if(dir === 'left'){
				room.extraOpenings.push({ x: room.x - 40, y: openY, w: 40 + depth, h: doorH });
				horiz(room.x - 40, room.x + depth, openY, doorH);
			}
			if(dir === 'right'){
				room.extraOpenings.push({ x: room.x + room.w - depth, y: openY, w: depth + 40, h: doorH });
				horiz(room.x + room.w - depth, room.x + room.w + 40, openY, doorH);
			}
			if(dir === 'top'){
				room.extraOpenings.push({ x: snap(A.x), y: room.y - 40, w: doorW, h: 40 + depth });
				vert(snap(A.x), room.y - 40, room.y + depth, doorW);
			}
			if(dir === 'bottom'){
				room.extraOpenings.push({ x: snap(A.x), y: room.y + room.h - depth, w: doorW, h: depth + 48 });
				vert(snap(A.x), room.y + room.h - depth, room.y + room.h + 48, doorW);
			}""",
    """			const openY = snap(A.y) + Math.max(0, HALL_H - doorH);
			if(dir === 'left') room.extraOpenings.push({ x: room.x - 40, y: openY, w: 40 + HALL_INSET, h: doorH });
			if(dir === 'right') room.extraOpenings.push({ x: room.x + room.w - HALL_INSET, y: openY, w: HALL_INSET + 40, h: doorH });
			if(dir === 'top') room.extraOpenings.push({ x: snap(A.x), y: room.y - 40, w: doorW, h: 40 + HALL_INSET });
			if(dir === 'bottom') room.extraOpenings.push({ x: snap(A.x), y: room.y + room.h - HALL_INSET, w: doorW, h: HALL_INSET + 48 });""", 1)

# 4) old horiz/vert without +TILE
src = src.replace(
    """			/* +TILE so the far edge is included after floor/ceil tile stamping (depth, not width of the door). */
			return carve(left, snap(y), Math.max(80, right - left + TILE), h || HALL_H);""",
    """			return carve(left, snap(y), Math.max(80, right - left), h || HALL_H);""", 1)
src = src.replace(
    """			return carve(snap(x), top, w || 200, Math.max(80, bot - top + TILE));""",
    """			return carve(snap(x), top, w || 200, Math.max(80, bot - top));""", 1)

# 5) old connectSide: single HALL_H, no door-span join
src = src.replace(
    """			const span = spanDoorsY(A, B);
			const h = span.h;
			const aRight = a.x + a.w;
			const bRight = b.x + b.w;
			const aDepth = throatDepth(a);
			const bDepth = throatDepth(b);""",
    """			const span = spanDoorsY(A, B);
			const h = HALL_H;
			const aRight = a.x + a.w;
			const bRight = b.x + b.w;
			const aDepth = throatDepth(a);
			const bDepth = throatDepth(b);""", 1)
src = src.replace("""				if(Math.abs(A.y - B.y) <= 24){
					horiz(x0, x1, span.y, h);
				} else {
					const midX = snap((aRight + b.x) / 2 - 80);
					horiz(x0, midX + 160, A.y, A.h || HALL_H);
					vert(midX, A.y, B.y + (B.h || HALL_H), 160);
					horiz(midX, x1, B.y, B.h || HALL_H);
				}""",
    """				if(Math.abs(A.y - B.y) <= 20){
					horiz(x0, x1, A.y, h);
				} else {
					const midX = snap((aRight + b.x) / 2 - 80);
					horiz(x0, midX + 160, A.y, h);
					vert(midX, A.y, B.y + h, 160);
					horiz(midX, x1, B.y, h);
				}""", 1)
src = src.replace("""				if(Math.abs(A.y - B.y) <= 24){
					horiz(x0, x1, span.y, h);
				} else {
					const midX = snap((bRight + a.x) / 2 - 80);
					horiz(x0, midX + 160, B.y, B.h || HALL_H);
					vert(midX, A.y, B.y + (B.h || HALL_H), 160);
					horiz(midX, x1, A.y, A.h || HALL_H);
				}""",
    """				if(Math.abs(A.y - B.y) <= 20){
					horiz(x0, x1, A.y, h);
				} else {
					const midX = snap((bRight + a.x) / 2 - 80);
					horiz(x0, midX + 160, A.y, h);
					vert(midX, A.y, B.y + h, 160);
					horiz(midX, x1, B.y, h);
				}""", 1)
src = src.replace("""			horiz(aMouth, col + 160, A.y, A.h || HALL_H);
			vert(col, A.y, B.y + (B.h || HALL_H), 160);
			horiz(bMouth, col + 160, B.y, B.h || HALL_H);""",
    """			horiz(aMouth, col + 160, A.y, h);
			vert(col, A.y, B.y + h, 160);
			horiz(bMouth, col + 160, B.y, h);""", 1)

# 6) old start hall
src = src.replace("""			const sDepth = throatDepth(s);
			const cDepth = throatDepth(c1);
			const span = spanDoorsY(A, B);
			horiz(s.x + s.w - sDepth, c1.x + cDepth, span.y, span.h);
			s.extraOpenings.push({ x: s.x + s.w - sDepth, y: span.y, w: sDepth + 40, h: span.h });
			c1.extraOpenings.push({ x: c1.x - 40, y: span.y, w: 40 + cDepth, h: span.h });
			if(Math.abs(A.y - B.y) > 16){
				vert(c1.x - 8, A.y, B.y + (B.h || HALL_H), 160);
			}""",
    """			const y = snap(Math.min(A.y, B.y));
			horiz(s.x + s.w - HALL_INSET, c1.x + HALL_INSET, y, HALL_H);
			s.extraOpenings.push({ x: s.x + s.w - HALL_INSET, y: y, w: HALL_INSET + 40, h: HALL_H });
			c1.extraOpenings.push({ x: c1.x - 40, y: y, w: 40 + HALL_INSET, h: HALL_H });
			if(Math.abs(A.y - B.y) > 16){
				vert(c1.x - 8, A.y, B.y + HALL_H, 160);
			}""", 1)

src = src.replace('global.generateFireInfernalDepths = generateFireInfernalDepths;',
                  'global.generateFireLegacy = generateFireInfernalDepths;', 1)

Path('_legacy-fire-world.js').write_text(src, encoding='utf-8')
print('legacy written', len(src))
