// FELEMAYE — Capabilities Matrix (Framer code component)
// Kinetic, hand-drawn-feeling relationship diagram for /capabilities.
//  - No centre node. Six disciplines orbit slowly; hovering or tapping one traces its connections.
//  - Every node is at least 84px across on screen. Editorial palette on a deep off-black canvas.
//  - The detail card is ALWAYS pinned to the lower-left of the diagram (bottom:24px; left:24px), so it never covers the middle or your toolbar.
//  - 2026-10-23: the scope callout is no longer fixed in the centre. When a discipline is active the orbit comes to rest and the
//    callout is placed in the largest clear field next to that node, clear of every node, its ring text, the lit connectors and
//    their labels, then tied back to the node with a drafting leader and a detail tag (code / sheet). Scope lists are editable
//    in Framer's right-hand panel (one list per discipline).
//  - Each node and the card's button route to /inquiry?vertical=<slug>.
//  - Title block uses Jost (the site sans, as in the footer) and is deliberately short; "toolbarClearance" keeps room above your pencils / scale-ruler graphics.
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Props = { inquiryPath: string; toolbarClearance: number; speed: number; title: string; style?: React.CSSProperties; [k: string]: any }
type N = { id: string; slug: string; code: string; label: string; short: string; color: string; ink: string; blurb: string }
const NODES: N[] = [
    { id: "sd", slug: "spatial-design", code: "SD", label: "Spatial Design & Interiors", short: "SPATIAL", color: "#D4A373", ink: "#1a1208", blurb: "Residential and hospitality interiors, courtyards and additions, carried from the first site visit to the punch list." },
    { id: "ss", slug: "surface-library", code: "SL", label: "Surface Design / Surface Library", short: "SURFACE", color: "#FAEDCD", ink: "#1f1708", blurb: "Original wallcoverings, carpets and textiles, drawn in the studio and licensed to manufacturers." },
    { id: "bv", slug: "bim-vdc", code: "BV", label: "BIM / VDC", short: "BIM·VDC", color: "#B7C0A8", ink: "#12170a", blurb: "Revit ecosystems and cross-firm coordination that keep every drawing honest." },
    { id: "pf", slug: "ffe-procurement", code: "PF", label: "FF&E and OS&E Procurement", short: "FF&E", color: "#C9B79C", ink: "#1a1308", blurb: "Furniture, fixtures and operating supplies specified, priced and tracked until they are installed." },
    { id: "cs", slug: "creative-strategy", code: "CS", label: "Creative Strategy", short: "STRATEGY", color: "#E9EDC9", ink: "#161a08", blurb: "Positioning and the written brief a project is designed against, settled before anyone draws." },
    { id: "ta", slug: "talent-alignment", code: "TA", label: "Talent Alignment", short: "TALENT", color: "#CCD5AE", ink: "#121a08", blurb: "Putting the right consultants, makers and trades on a project, and keeping them working from the same set." },
    { id: "ci", slug: "critical-inquiry", code: "CI", label: "Critical Inquiry", short: "INQUIRY", color: "#E5D3B3", ink: "#1a1408", blurb: "Research into place, history and culture that sits underneath a commission." },
    { id: "ma", slug: "media-archives", code: "MA", label: "Media Archives", short: "ARCHIVES", color: "#C5CCB0", ink: "#12170a", blurb: "The studio's essays, recordings and project documentation, kept and published." },
    { id: "rd", slug: "radical-delusions-lab", code: "RD", label: "Radical Delusions Lab ©", short: "RDL ©", color: "#D9B8A0", ink: "#1f1008", blurb: "The studio's open sandbox for ideas that have no client yet." },
]
const EDGES: [string, string, string][] = [["sd", "ss", "specifies"], ["sd", "bv", "models it"], ["bv", "pf", "schedules"], ["sd", "pf", "FF&E packages"], ["cs", "sd", "briefs"], ["cs", "ss", "positions"], ["ci", "cs", "frames"], ["ci", "ma", "publishes"], ["rd", "ci", "provokes"], ["rd", "ss", "prototypes"], ["ta", "cs", "aligns"], ["ta", "bv", "coordinates"], ["ma", "sd", "documents"]]
// Scope per discipline (defaults). Each list can be replaced in Framer's property panel: "Scope · SD", "Scope · BV", …
const SCOPE: Record<string, string[]> = {
    sd: ["Site survey, as-built measure and existing-conditions drawings", "Zoning and code feasibility before design starts", "Schematic design, design development and permit sets (CA B&P §5537 / §5538 scope)", "Finish, fixture and lighting selections with elevations and RCPs", "Consultant coordination: structural, civil, MEP, Title 24", "Construction administration, RFIs and punch list"],
    ss: ["Pattern drawing, repeat engineering and colourways", "Wallcovering, broadloom and rug development with mills", "Strike-offs, sampling and trade lookbooks", "Licensing agreements and royalty tracking", "Project-specific custom runs"],
    bv: ["BIM Execution Plan (LOD 100 – LOD 500)", "Revit Creation: Templates & Families", "Point Clouds", "Title blocks, sheets, shared parameters", "As-Built Documentation", "BIM Company Audit & Training Plan"],
    pf: ["FF&E and OS&E specification books and schedules", "Trade pricing, quotes and budget reconciliation", "Purchase orders, deposits and lead-time tracking", "Freight, receiving, inspection and white-glove installation", "Resale certificates and use-tax handling (CA / NY)"],
    cs: ["Discovery interviews and the design intent survey", "Written brief: goals, constraints and a definition of done", "Brand-to-space translation for hospitality and retail", "Concept narratives and presentation decks", "Collateral for boards, officials and investors"],
    ta: ["Consultant RFPs, bid comparison and selection", "Trade and maker sourcing from a vetted network", "Scopes of work and responsibility matrices", "Coordination meetings and shared-model protocols", "Mentorship and studio staffing"],
    ci: ["Site histories and archival research", "Neighbourhood and community studies (the 90008 Index)", "Precedent studies and design criticism", "Panels, lectures and curated programmes", "Writing for publication"],
    ma: ["Essays and criticism", "Sonic records and studio playlists", "Project photography and film", "Press features and interviews", "The studio archive"],
    rd: ["Speculative concepts and unbuilt proposals", "Material experiments and prototypes for the Surface Library", "Objects and craft: Dem Arts & Crafts", "Collaborations with artists and makers"],
}
// measure text in viewBox units with the font the callout uses, then wrap to a width
let _ctx: CanvasRenderingContext2D | null = null
const measure = (t: string, size: number) => {
    try { _ctx ||= document.createElement("canvas").getContext("2d"); if (_ctx) { _ctx.font = `${size}px Jost, system-ui, sans-serif`; return _ctx.measureText(t).width } } catch {}
    return t.length * size * 0.55
}
const wrapTo = (t: string, maxW: number, size: number) => { const out: string[] = []; let cur = ""; t.split(" ").forEach((w) => { const nxt = (cur + " " + w).trim(); if (measure(nxt, size) > maxW && cur) { out.push(cur); cur = w } else cur = nxt }); if (cur) out.push(cur); return out }
const FS = 12.5, LH = 19
const GOLD = "#D4A373", MONO = "ui-monospace,'SF Mono',Menlo,monospace"

export default function CapabilitiesMatrix(props: Props) {
    const p = { inquiryPath: "/inquiry", toolbarClearance: 96, speed: 1, title: "Capabilities Matrix", ...Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== "")) } as Props
    const wrap = React.useRef<HTMLDivElement>(null)
    const [w, setW] = React.useState(900)
    const [t, setT] = React.useState(0)
    const [hot, setHotRaw] = React.useState<string | null>(null)
    // leaving a node waits a moment, so the pointer can travel along the leader into the callout without it closing
    const leaveT = React.useRef<any>(null)
    const setHot = (v: string | null) => { clearTimeout(leaveT.current); if (v) setHotRaw(v); else leaveT.current = setTimeout(() => setHotRaw(null), 380) }
    const [sel, setSel] = React.useState<string | null>(null)
    const [coarse, setCoarse] = React.useState(false)
    const [vis, setVis] = React.useState(true)
    React.useEffect(() => {
        if (!wrap.current) return
        const ro = new ResizeObserver((e) => setW(e[0].contentRect.width)); ro.observe(wrap.current)
        const io = new IntersectionObserver((e) => setVis(e[0].isIntersecting)); io.observe(wrap.current)
        try { setCoarse(window.matchMedia("(pointer: coarse)").matches) } catch {}
        return () => { ro.disconnect(); io.disconnect() }
    }, [])
    const act = hot ?? sel
    React.useEffect(() => {
        let reduce = false; try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches } catch {}
        if (reduce || !vis) return
        // the orbit eases to rest while a discipline is active and eases back afterwards (same feel as the Transmatrix drift)
        let raf = 0, last = performance.now(), vel = actRef.current ? 0 : 1
        const loop = (n: number) => {
            const dt = Math.min((n - last) / 1000, 0.05); last = n
            vel += ((actRef.current ? 0 : 1) - vel) * (1 - Math.exp(-dt * 5))
            if (!document.hidden && vel > 0.001) setT((x) => x + dt * (p.speed || 1) * vel)
            const dr = rotTarget.current - rotRef.current
            if (Math.abs(dr) > 0.0005) { rotRef.current += dr * (1 - Math.exp(-dt * 6)); setRot(rotRef.current) }
            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
    }, [vis, p.speed])
    const [menu, setMenu] = React.useState(false)
    // extra orbit rotation used to open a clear field for a callout when the resting angle leaves none
    const [rot, setRot] = React.useState(0)
    const rotRef = React.useRef(0), rotTarget = React.useRef(0)
    React.useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); setSel(null) } }
        window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc)
    }, [])
    const actRef = React.useRef<string | null>(null); actRef.current = act
    const narrow = w < 700
    const VW = narrow ? 420 : 960, VH = narrow ? 760 : 600
    const R = narrow ? 46 : 58                      // node radius: 92px / 108px diameter in viewBox units (>= 84px on screen)
    const cx = VW / 2, cy = VH / 2 + (narrow ? 44 : 0)
    const ring = narrow ? 150 : 250
    const posAt = (extra: number) => { const m: Record<string, { x: number; y: number }> = {}; NODES.forEach((n, i) => { const a = (i / NODES.length) * Math.PI * 2 - Math.PI / 2 + t * 0.06 + extra; m[n.id] = { x: cx + Math.cos(a) * (narrow ? 142 : 372), y: cy + Math.sin(a) * (narrow ? 270 : 218) } }); return m }
    const pos = posAt(rot)
    const related = new Set<string>(); if (act) { related.add(act); EDGES.forEach(([a, b]) => { if (a === act) related.add(b); if (b === act) related.add(a) }) }
    const node = NODES.find((n) => n.id === act)
    const neighbours = (id: string) => EDGES.filter(([a, b]) => a === id || b === id).map(([a, b]) => NODES.find((x) => x.id === (a === id ? b : a))!.short).slice(0, 3).join(" • ")
    const href = (n: N) => `${p.inquiryPath}?vertical=${n.slug}`
    const scopeOf = (n: N) => { const v = (props as any)["scope" + n.code]; return Array.isArray(v) && v.filter(Boolean).length ? v.filter(Boolean) : SCOPE[n.id] }
    // connector geometry, shared by the drawing and by the callout placement
    const geo = (a: string, b: string, pm: Record<string, { x: number; y: number }> = pos) => {
        const P0 = pm[a], Q0 = pm[b]
        const mx = (P0.x + Q0.x) / 2 + (cx - (P0.x + Q0.x) / 2) * 0.25, my = (P0.y + Q0.y) / 2 + (cy - (P0.y + Q0.y) / 2) * 0.25
        const trim = (P: { x: number; y: number }) => { const dx = mx - P.x, dy = my - P.y, d = Math.hypot(dx, dy) || 1; return { x: P.x + (dx / d) * (R + 22), y: P.y + (dy / d) * (R + 22) } }
        const P = trim(P0), Q = trim(Q0)
        return { P, Q, mx, my, lx: 0.25 * P.x + 0.5 * mx + 0.25 * Q.x, ly: 0.25 * P.y + 0.5 * my + 0.25 * Q.y }
    }
    // Callout placement: search the canvas for the clear field nearest the active node. Obstacles are every node (with its ring
    // text), the lit connectors and their labels, the practice-index button and the lower-left detail card.
    const tKey = Math.round(t * 8)
    const place = (pm: Record<string, { x: number; y: number }>, nd: N, step: number) => {
        const node = nd, pos = pm
        const sc = (w || VW) / VW
        const circles: { x: number; y: number; r: number; wt: number }[] = NODES.map((n) => ({ ...pos[n.id], r: R + 22, wt: related.has(n.id) ? 100 : 1 }))
        const rects: { x: number; y: number; w: number; h: number }[] = [
            { x: 0, y: 0, w: 330 / sc, h: 64 / sc },                                   // practice index button
        ]

        EDGES.forEach(([a, b, lab]) => {
            if (a !== node.id && b !== node.id) return
            const g = geo(a, b, pm)
            for (let k = 0; k <= 24; k++) { const u = k / 24, x = (1 - u) * (1 - u) * g.P.x + 2 * (1 - u) * u * g.mx + u * u * g.Q.x, y = (1 - u) * (1 - u) * g.P.y + 2 * (1 - u) * u * g.my + u * u * g.Q.y; circles.push({ x, y, r: 8, wt: 100 }) }
            rects.push({ x: g.lx - lab.length * 3.6 - 8, y: g.ly - 12, w: lab.length * 7.2 + 16, h: 24 })
        })
        const A = pos[node.id]
        let best: any = null
        // Layouts to try: one column at three widths, and two columns. Keep whichever finds the clearest field nearest the node.
        const conn = EDGES.filter(([a, b]) => a === node.id || b === node.id).map(([a, b, l]) => `${NODES.find((x) => x.id === (a === node.id ? b : a))!.code} ${l}`).join(" · ")
        for (const [wrapW, cols, pen, showBlurb] of [[300, 1, 0, 1], [236, 1, 30, 1], [260, 2, 35, 1], [190, 2, 40, 1], [188, 1, 60, 1], [150, 2, 80, 1], [220, 3, 85, 1], [150, 3, 90, 1], [260, 2, 300, 0], [220, 3, 320, 0], [190, 2, 340, 0], [270, 1, 400, -1], [240, 1, 420, -1], [200, 2, 440, -1]] as [number, number, number, number][]) {
            // showBlurb -1 = compact: smaller type, no definition line, no connection line (still has the inquiry link)
            const fs = showBlurb === -1 ? 11 : FS, lh = showBlurb === -1 ? 16 : LH
            const list = scopeOf(node).map((r) => wrapTo(r, wrapW, fs))
            const per = Math.ceil(list.length / cols)
            const colsArr = Array.from({ length: cols }, (_, c) => list.slice(c * per, c * per + per))
            const colH = (col: string[][]) => col.reduce((a, it) => a + it.length * lh + 4, -4)
            const colW = Math.max(...list.flat().map((r) => measure(r, fs) + 22))
            const innerW = Math.max(node.label.length * 7.4, cols * colW + (cols - 1) * 22)
            const blurb = showBlurb === 1 ? wrapTo(node.blurb, Math.max(innerW, 220), FS) : []
            const connL = showBlurb === -1 ? [] : wrapTo(conn, Math.max(innerW, 220), 9 * 1.15)
            const W = Math.ceil(Math.max(220, innerW, ...blurb.map((r) => measure(r, FS)))) + 44
            const listTop = blurb.length ? 50 + blurb.length * LH + 12 : 50
            const H = listTop + Math.max(...colsArr.map(colH)) + 18 + connL.length * 14 + 26
            const ops: { x: number; y: number; t: string; k: "num" | "txt" }[] = []
            let n0 = 0
            colsArr.forEach((col, c) => { let yy = listTop; col.forEach((lines) => { n0++; lines.forEach((r, k) => { if (k === 0) ops.push({ x: 20 + c * (colW + 22), y: yy, t: String(n0).padStart(2, "0"), k: "num" }); ops.push({ x: 42 + c * (colW + 22), y: yy, t: r, k: "txt" }); yy += lh }); yy += 4 }) })
            const hits = (x: number, y: number) => {
                let n = 0
                for (const c of circles) { const qx = Math.max(x, Math.min(c.x, x + W)), qy = Math.max(y, Math.min(c.y, y + H)); if ((qx - c.x) ** 2 + (qy - c.y) ** 2 < c.r * c.r) n += c.wt }
                for (const r of rects) if (x < r.x + r.w && x + W > r.x && y < r.y + r.h && y + H > r.y) n += 100
                return n
            }
            for (let y = 8; y <= VH - H - 8; y += step) for (let x = 8; x <= VW - W - 8; x += step) {
                const n = hits(x, y)
                const qx = Math.max(x, Math.min(A.x, x + W)), qy = Math.max(y, Math.min(A.y, y + H))
                const d = Math.hypot(qx - A.x, qy - A.y)
                const score = n * 1000 + Math.abs(d - (R + 56)) + pen
                if (!best || score < best.score) best = { x, y, score, qx, qy, W, H, ops, blurb, connL, fs }
            }
        }
        if (!best) return null
        const ang = Math.atan2(best.qy - A.y, best.qx - A.x)
        return { ...best, tag: { x: best.qx, y: best.qy }, end: { x: A.x + Math.cos(ang) * (R + 4), y: A.y + Math.sin(ang) * (R + 4) } }
    }
    const callout = React.useMemo(() => (narrow || !node ? null : place(pos, node, 10)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [act, narrow, tKey, w, Math.round(rot * 200)])
    // when a discipline is chosen and its callout would cover a partner node, turn the orbit to the nearest angle that clears it
    React.useEffect(() => {
        if (narrow || !node) return
        const here = place(posAt(rotRef.current), node, 20)
        if (!here || here.score < 290) return   // the full callout (with definition) already fits
        let bestD = 0, bestS = here.score
        for (let d = -0.7; d <= 0.701; d += 0.1) { if (Math.abs(d) < 0.01) continue; const r = place(posAt(rotRef.current + d), node, 20); if (r && r.score < bestS - 1) { bestS = r.score; bestD = d } }
        if (bestD) rotTarget.current = rotRef.current + bestD
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [act, narrow, w])
    return (
        <div ref={wrap} style={{ ...p.style, position: "relative", width: "100%", transform: "translateZ(0)", willChange: "transform", backfaceVisibility: "hidden", background: "#0B0B0C", color: "#EDE6D8", fontFamily: "Jost,system-ui,sans-serif", border: "1px solid #222226", boxSizing: "border-box", paddingBottom: p.toolbarClearance, overflow: "hidden" }}>
            {/* compact title block */}
            <div style={{ display: "flex", maxHeight: 80, overflow: "hidden", borderBottom: "1px solid #222226", fontFamily: "Jost,system-ui,sans-serif", transform: "translateZ(0)", willChange: "transform", backfaceVisibility: "hidden" }}>
                <div style={{ flex: "1 1 auto", padding: "10px 16px" }}>
                    <div style={{ font: `9px ${MONO}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#A39B8B" }}>Drawing title</div>
                    <div style={{ fontFamily: "Jost,system-ui,sans-serif", fontWeight: 700, textTransform: "uppercase", fontSize: narrow ? 14 : 16, letterSpacing: ".08em", marginTop: 2 }}>{p.title}</div>
                </div>
                {!narrow && [["Sheet", "C-001"], ["Scale", "NTS"], ["By", "F.Y."]].map(([k, v]) => <div key={k} style={{ padding: "10px 18px", borderLeft: "1px solid #222226" }}><div style={{ font: `9px ${MONO}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#A39B8B" }}>{k}</div><div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{v}</div></div>)}
            </div>
            {/* collapsed left-hand vertical menu: the original nine practice verticals, each a fast-track inquiry link */}
            <div style={{ position: "absolute", left: 16, top: 70, zIndex: 3 }}>
                <button aria-expanded={menu} aria-controls="cm-menu" onClick={() => setMenu(!menu)} style={{ display: "flex", alignItems: "center", gap: 10, background: "#141416", color: GOLD, border: "1px solid #222226", font: `10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", padding: "0 14px", minHeight: 44, cursor: "pointer" }}>
                    {/* drawn index mark: three rules fold into a cross when open */}
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ overflow: "visible" }}>
                        <g stroke="currentColor" strokeWidth="1.2">
                            <line x1="0" x2="12" y1="2" y2="2" style={{ transformOrigin: "6px 2px", transformBox: "view-box", transform: menu ? "translateY(4px) rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(.16,1,.3,1)" }} />
                            <line x1="0" x2="12" y1="6" y2="6" style={{ opacity: menu ? 0 : 1, transition: "opacity .15s ease" }} />
                            <line x1="0" x2="12" y1="10" y2="10" style={{ transformOrigin: "6px 10px", transformBox: "view-box", transform: menu ? "translateY(-4px) rotate(-45deg)" : "none", transition: "transform .3s cubic-bezier(.16,1,.3,1)" }} />
                        </g>
                    </svg>
                    Practice index</button>
                {menu && (
                    <nav id="cm-menu" aria-label="Practice index" style={{ marginTop: 6, background: "#141416", border: "1px solid #222226", width: "min(300px, calc(100vw - 48px))", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
                        {NODES.map((n, i) => <a key={n.id} href={href(n)} onMouseEnter={() => setHot(n.id)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(n.id)} onBlur={() => setHot(null)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "0 14px", minHeight: 44, borderTop: i ? "1px solid #222226" : 0, color: act === n.id ? GOLD : "#EDE6D8", textDecoration: "none", font: `500 13px Jost,system-ui,sans-serif` }}><span style={{ font: `10px ${MONO}`, color: n.color, width: 22 }}>{n.code}</span>{n.label}</a>)}
                    </nav>
                )}
            </div>
            <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" role="group" aria-label="How the practice's disciplines connect" style={{ display: "block", height: "auto", transform: "translateZ(0)", willChange: "transform", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <defs><pattern id="cm-g" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#1d1d1d" strokeWidth="1" /></pattern></defs>
                <rect width={VW} height={VH} fill="url(#cm-g)" onClick={() => setSel(null)} />
                <ellipse cx={cx} cy={cy} rx={narrow ? 142 : 372} ry={narrow ? 270 : 218} fill="none" stroke="#222226" strokeDasharray="3 6" />
                {EDGES.map(([a, b, lab], i) => {
                    const on = act && (a === act || b === act)
                    // each connector stops outside the circle and its perimeter text
                    const { P, Q, mx, my, lx, ly } = geo(a, b)
                    return <g key={i} opacity={act ? (on ? 1 : 0.08) : 0.45} style={{ transition: "opacity .25s" }}><path d={`M${P.x},${P.y} Q${mx},${my} ${Q.x},${Q.y}`} fill="none" stroke={on ? GOLD : "#8a8272"} strokeWidth={on ? 2 : 1} />{on && <g><rect x={lx - lab.length * 3.6 - 6} y={ly - 10} width={lab.length * 7.2 + 12} height="20" fill="#0B0B0C" /><text x={lx} y={ly + 4} textAnchor="middle" fontFamily={MONO} fontSize="11" letterSpacing=".6" fill={GOLD}>{lab}</text></g>}</g>
                })}
                {NODES.map((n) => {
                    const P = pos[n.id], on = !act || related.has(n.id)
                    return (
                        <a key={n.id} href={href(n)} aria-label={`${n.label}. ${n.blurb} Open the inquiry form.`} onMouseEnter={() => setHot(n.id)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(n.id)} onBlur={() => setHot(null)} onClick={(e) => { if (coarse && sel !== n.id) { e.preventDefault(); setSel(n.id) } }} style={{ cursor: "pointer", outline: "none" }}>
                            <g opacity={on ? 1 : 0.2} style={{ transition: "opacity .25s" }}>
                                <circle cx={P.x} cy={P.y} r={R + 10} fill="transparent" />
                                <circle cx={P.x} cy={P.y} r={R} fill={n.color} stroke={act === n.id ? "#fff" : "#0B0B0C"} strokeWidth={act === n.id ? 3 : 2} />
                                <circle cx={P.x} cy={P.y} r={R - 6} fill="none" stroke={n.ink} strokeOpacity=".25" strokeDasharray="2 3" />
                                <defs>
                                    <path id={`cm-in-${n.id}`} d={`M${P.x},${P.y + (R - 13)} A${R - 13},${R - 13} 0 1 1 ${P.x},${P.y - (R - 13)} A${R - 13},${R - 13} 0 1 1 ${P.x},${P.y + (R - 13)}`} />
                                    <path id={`cm-out-${n.id}`} d={`M${P.x},${P.y + (R + 9)} A${R + 9},${R + 9} 0 1 1 ${P.x},${P.y - (R + 9)} A${R + 9},${R + 9} 0 1 1 ${P.x},${P.y + (R + 9)}`} />
                                </defs>
                                <text fontFamily="Jost,system-ui,sans-serif" fontWeight="700" fontSize={narrow ? 6.2 : 7.2} letterSpacing=".5" fill={n.ink} opacity=".8"><textPath href={`#cm-in-${n.id}`} startOffset="50%" textAnchor="middle">{n.label.toUpperCase()}</textPath></text>
                                <text fontFamily={MONO} fontSize="8" letterSpacing="1" fill="#8a8272"><textPath href={`#cm-out-${n.id}`} startOffset="50%" textAnchor="middle">{neighbours(n.id)}</textPath></text>
                                <text x={P.x} y={P.y - 2} textAnchor="middle" dominantBaseline="central" fontFamily="Jost,system-ui,sans-serif" fontWeight="700" fontSize={narrow ? 26 : 32} fill={n.ink}>{n.code}</text>
                                <text x={P.x} y={P.y + R * 0.56} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontSize={narrow ? 9.5 : 12} letterSpacing=".6" fontWeight="600" fill={n.ink} opacity=".9">{n.short}</text>
                                </g>
                        </a>
                    )
                })}
                {callout && node && (
                    <g onMouseEnter={() => setHot(node.id)} onMouseLeave={() => setHot(null)}>
                        {/* leader: from the node's edge to the detail tag on the callout */}
                        <path d={`M${callout.end.x},${callout.end.y} L${callout.tag.x},${callout.tag.y}`} stroke={node.color} strokeWidth="1" fill="none" />
                        <circle cx={callout.end.x} cy={callout.end.y} r="2.6" fill={node.color} />
                        <rect x={callout.x} y={callout.y} width={callout.W} height={callout.H} fill="#0B0B0C" />
                        <path d={(() => { const { x, y, W, H } = callout, k = 12; return `M${x},${y + k}V${y}H${x + k} M${x + W - k},${y}H${x + W}V${y + k} M${x + W},${y + H - k}V${y + H}H${x + W - k} M${x + k},${y + H}H${x}V${y + H - k}` })()} fill="none" stroke={node.color} strokeWidth="1" />
                        <text x={callout.x + 20} y={callout.y + 28} fontFamily={MONO} fontSize="9.5" letterSpacing="2.2" fill={node.color}>{node.label.toUpperCase()}</text>
                        {callout.blurb.map((r: string, i: number) => <text key={"b" + i} x={callout.x + 20} y={callout.y + 50 + i * LH} fontFamily="Jost,system-ui,sans-serif" fontSize={FS} fontStyle="italic" fill="#BFB6A5">{r}</text>)}
                        <line x1={callout.x + 20} x2={callout.x + callout.W - 20} y1={callout.y + 50 + callout.blurb.length * LH - 6} y2={callout.y + 50 + callout.blurb.length * LH - 6} stroke="#2a2a2e" />
                        {callout.ops.map((o: any, i: number) => o.k === "num"
                            ? <text key={i} x={callout.x + o.x} y={callout.y + o.y} fontFamily={MONO} fontSize="9" fill={node.color}>{o.t}</text>
                            : <text key={i} x={callout.x + o.x} y={callout.y + o.y} fontFamily="Jost,system-ui,sans-serif" fontSize={callout.fs} fill="#E2DACA">{o.t}</text>)}
                        {callout.connL.map((r: string, i: number) => <text key={"c" + i} x={callout.x + 20} y={callout.y + callout.H - 40 - (callout.connL.length - 1 - i) * 14} fontFamily={MONO} fontSize="9" fill="#A39B8B">{r}</text>)}
                        <a href={href(node)} style={{ pointerEvents: "auto" }}><text x={callout.x + 20} y={callout.y + callout.H - 18} fontFamily={MONO} fontSize="9.5" letterSpacing="1.8" fill={GOLD} textDecoration="underline">START AN INQUIRY ↗</text></a>
                        {/* detail tag: drafting-style section marker where the leader meets the callout */}
                        <g>
                            <circle cx={callout.tag.x} cy={callout.tag.y} r="15" fill="#0B0B0C" stroke={node.color} strokeWidth="1" />
                            <line x1={callout.tag.x - 15} x2={callout.tag.x + 15} y1={callout.tag.y} y2={callout.tag.y} stroke={node.color} strokeWidth=".8" />
                            <text x={callout.tag.x} y={callout.tag.y - 4} textAnchor="middle" fontFamily={MONO} fontSize="8.5" fontWeight="600" fill={node.color}>{node.code}</text>
                            <text x={callout.tag.x} y={callout.tag.y + 10} textAnchor="middle" fontFamily={MONO} fontSize="6.5" fill="#A39B8B">C-001</text>
                        </g>
                    </g>
                )}
            </svg>
            {/* detail card: always lower-left of the diagram */}
            {narrow && <div aria-live="polite" style={{ position: "absolute", left: 24, bottom: p.toolbarClearance + 24, width: "min(340px, calc(100% - 48px))", background: "#141416", border: `1px solid ${node ? node.color : "#222"}`, padding: "14px 16px", opacity: node ? 1 : 0, transform: `translate3d(0,${node ? 0 : 8}px,0)`, willChange: "transform, opacity", backfaceVisibility: "hidden", transition: node ? "opacity .3s ease,transform .45s cubic-bezier(.16,1,.3,1)" : "opacity .18s ease,transform .18s ease", pointerEvents: node ? "auto" : "none", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
                {node && <>
                    <div style={{ font: `10px ${MONO}`, letterSpacing: ".22em", textTransform: "uppercase", color: node.color }}>{node.label}</div>
                    <p style={{ margin: "6px 0 10px", fontSize: 14, lineHeight: 1.55 }}>{node.blurb}</p>
                    {narrow && <ul style={{ margin: "0 0 10px", padding: "0 0 0 16px", fontSize: 12.5, lineHeight: 1.6, color: "#C9C1B1" }}>{scopeOf(node).map((r) => <li key={r}>{r}</li>)}</ul>}
                    <div style={{ font: `10px ${MONO}`, color: "#A39B8B", lineHeight: 1.7 }}>{EDGES.filter(([a, b]) => a === node.id || b === node.id).map(([a, b, l]) => `${NODES.find((x) => x.id === (a === node.id ? b : a))!.code} ${l}`).join(" · ")}</div>
                    <a href={href(node)} style={{ display: "inline-block", marginTop: 10, padding: "12px 0", color: GOLD, font: `10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", textDecoration: "underline", textUnderlineOffset: 4 }}>Start an inquiry ↗</a>
                </>}
            </div>}
            {!act && <div style={{ position: "absolute", left: 24, bottom: p.toolbarClearance + 20, font: `10px ${MONO}`, letterSpacing: ".18em", textTransform: "uppercase", color: "#A39B8B" }}>{coarse ? "Tap a discipline" : "Hover a discipline"}</div>}
        </div>
    )
}
CapabilitiesMatrix.defaultProps = { inquiryPath: "/inquiry", toolbarClearance: 96, speed: 1, title: "Capabilities Matrix", width: 960, height: 760 }
addPropertyControls(CapabilitiesMatrix, {
    title: { type: ControlType.String, title: "Title" },
    inquiryPath: { type: ControlType.String, title: "Inquiry path" },
    toolbarClearance: { type: ControlType.Number, title: "Toolbar room", min: 0, max: 220, step: 4, unit: "px" },
    speed: { type: ControlType.Number, title: "Orbit speed", min: 0, max: 3, step: 0.1 },
    ...Object.fromEntries(NODES.map((n) => ["scope" + n.code, { type: ControlType.Array, title: "Scope · " + n.code, control: { type: ControlType.String }, defaultValue: SCOPE[n.id] }])),
})
