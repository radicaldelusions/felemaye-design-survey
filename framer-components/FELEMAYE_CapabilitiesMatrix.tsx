// FELEMAYE — Capabilities Matrix (Framer code component)
// Kinetic, hand-drawn-feeling relationship diagram for /capabilities.
//  - No centre node. Six disciplines orbit slowly; hovering or tapping one traces its connections.
//  - Every node is at least 84px across on screen. Editorial palette on a deep off-black canvas.
//  - The detail card is ALWAYS pinned to the lower-left of the diagram (bottom:24px; left:24px), so it never covers the middle or your toolbar.
//  - Each node and the card's button route to /inquiry?vertical=<slug>.
//  - Title block uses Inter and is deliberately short; "toolbarClearance" keeps room above your pencils / scale-ruler graphics.
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Props = { inquiryPath: string; toolbarClearance: number; speed: number; title: string; style?: React.CSSProperties }
type N = { id: string; slug: string; code: string; label: string; short: string; color: string; ink: string; blurb: string }
const NODES: N[] = [
    { id: "sd", slug: "spatial-design", code: "SD", label: "Spatial Design & Interiors", short: "SPATIAL", color: "#D4A373", ink: "#1a1208", blurb: "Interiors, courtyards and environments, from first sketch to installed." },
    { id: "ss", slug: "surface-library", code: "SL", label: "Surface Design / Surface Library", short: "SURFACE", color: "#FAEDCD", ink: "#1f1708", blurb: "Wallcoverings, carpets and textiles, developed and licensed." },
    { id: "bv", slug: "bim-vdc", code: "BV", label: "BIM / VDC", short: "BIM·VDC", color: "#B7C0A8", ink: "#12170a", blurb: "Revit ecosystems and cross-firm coordination that keep every drawing honest." },
    { id: "pf", slug: "ffe-procurement", code: "PF", label: "FF&E and OS&E Procurement", short: "FF&E", color: "#C9B79C", ink: "#1a1308", blurb: "Sourcing, budgets and lead times, managed end to end." },
    { id: "cs", slug: "creative-strategy", code: "CS", label: "Creative Strategy", short: "STRATEGY", color: "#E9EDC9", ink: "#161a08", blurb: "Positioning, narrative and the brief behind the brief." },
    { id: "ta", slug: "talent-alignment", code: "TA", label: "Talent Alignment", short: "TALENT", color: "#CCD5AE", ink: "#121a08", blurb: "Team alignment, cultural stewardship and collaborative networks." },
    { id: "ci", slug: "critical-inquiry", code: "CI", label: "Critical Inquiry", short: "INQUIRY", color: "#E5D3B3", ink: "#1a1408", blurb: "Research, criticism and the questions behind a commission." },
    { id: "ma", slug: "media-archives", code: "MA", label: "Media Archives", short: "ARCHIVES", color: "#C5CCB0", ink: "#12170a", blurb: "Essays, criticism and sonic records: the practice thinking in public." },
    { id: "rd", slug: "radical-delusions-lab", code: "RD", label: "Radical Delusions Lab ©", short: "RDL ©", color: "#D9B8A0", ink: "#1f1008", blurb: "The speculative sandbox: unconstrained concepts and poetic research." },
]
const EDGES: [string, string, string][] = [["sd", "ss", "specifies"], ["sd", "bv", "models it"], ["bv", "pf", "schedules"], ["sd", "pf", "FF&E packages"], ["cs", "sd", "briefs"], ["cs", "ss", "positions"], ["ci", "cs", "frames"], ["ci", "ma", "publishes"], ["rd", "ci", "provokes"], ["rd", "ss", "prototypes"], ["ta", "cs", "aligns"], ["ta", "bv", "coordinates"], ["ma", "sd", "documents"]]
// Hyper-specific scope lines used in the negative space between the nodes (and in the detail card on narrow screens).
const SCOPE: Record<string, string[]> = {
    sd: ["Concept through installation", "Space planning, finishes and details", "Permit-ready drawings, CA §5537 / §5538 scope"],
    ss: ["Wallcoverings, bespoke carpets, textiles", "Pattern, repeat and colourway development", "Licensing and trade sampling"],
    bv: ["Revit models and family standards", "Title blocks, sheets, shared parameters", "Cross-firm coordination and review"],
    pf: ["FF&E and OS&E specification packages", "Budget, quote and lead-time tracking", "Order, delivery and punch list"],
    cs: ["Positioning and narrative", "The brief behind the brief", "Brand-to-space alignment"],
    ta: ["Team alignment", "Cultural stewardship", "Collaborative networks"],
    ci: ["Research and criticism", "The questions behind a commission", "Panels, essays and curation"],
    ma: ["Essays and criticism", "Sonic records", "The practice thinking in public"],
    rd: ["Speculative concepts", "Poetic research", "Prototypes for the surface studio"],
}
const GOLD = "#D4A373", MONO = "ui-monospace,'SF Mono',Menlo,monospace"

export default function CapabilitiesMatrix(props: Props) {
    const p = { inquiryPath: "/inquiry", toolbarClearance: 96, speed: 1, title: "Capabilities Matrix", ...Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== "")) } as Props
    const wrap = React.useRef<HTMLDivElement>(null)
    const [w, setW] = React.useState(900)
    const [t, setT] = React.useState(0)
    const [hot, setHot] = React.useState<string | null>(null)
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
        let raf = 0, last = performance.now()
        const loop = (n: number) => { const dt = (n - last) / 1000; last = n; if (!document.hidden && !actRef.current) setT((x) => x + dt * (p.speed || 1)); raf = requestAnimationFrame(loop) }
        raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
    }, [vis, p.speed])
    const [menu, setMenu] = React.useState(false)
    const actRef = React.useRef<string | null>(null); actRef.current = act
    const narrow = w < 700
    const VW = narrow ? 420 : 960, VH = narrow ? 760 : 600
    const R = narrow ? 46 : 58                      // node radius: 92px / 108px diameter in viewBox units (>= 84px on screen)
    const cx = VW / 2, cy = VH / 2 + (narrow ? 44 : 0)
    const ring = narrow ? 150 : 250
    const pos: Record<string, { x: number; y: number }> = {}
    NODES.forEach((n, i) => { const a = (i / NODES.length) * Math.PI * 2 - Math.PI / 2 + t * 0.06; pos[n.id] = { x: cx + Math.cos(a) * (narrow ? 142 : 372), y: cy + Math.sin(a) * (narrow ? 270 : 218) } })
    const related = new Set<string>(); if (act) { related.add(act); EDGES.forEach(([a, b]) => { if (a === act) related.add(b); if (b === act) related.add(a) }) }
    const node = NODES.find((n) => n.id === act)
    const neighbours = (id: string) => EDGES.filter(([a, b]) => a === id || b === id).map(([a, b]) => NODES.find((x) => x.id === (a === id ? b : a))!.short).slice(0, 3).join(" • ")
    const href = (n: N) => `${p.inquiryPath}?vertical=${n.slug}`
    return (
        <div ref={wrap} style={{ ...p.style, position: "relative", width: "100%", transform: "translateZ(0)", willChange: "transform", backfaceVisibility: "hidden", background: "#0B0B0C", color: "#EDE6D8", fontFamily: "Inter,system-ui,sans-serif", border: "1px solid #222226", boxSizing: "border-box", paddingBottom: p.toolbarClearance, overflow: "hidden" }}>
            {/* compact title block */}
            <div style={{ display: "flex", maxHeight: 80, overflow: "hidden", borderBottom: "1px solid #222226", fontFamily: "Inter,system-ui,sans-serif", transform: "translateZ(0)", willChange: "transform", backfaceVisibility: "hidden" }}>
                <div style={{ flex: "1 1 auto", padding: "10px 16px" }}>
                    <div style={{ font: `9px ${MONO}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#A39B8B" }}>Drawing title</div>
                    <div style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, textTransform: "uppercase", fontSize: narrow ? 14 : 16, letterSpacing: ".08em", marginTop: 2 }}>{p.title}</div>
                </div>
                {!narrow && [["Sheet", "C-001"], ["Scale", "NTS"], ["By", "F.Y."]].map(([k, v]) => <div key={k} style={{ padding: "10px 18px", borderLeft: "1px solid #222226" }}><div style={{ font: `9px ${MONO}`, letterSpacing: ".24em", textTransform: "uppercase", color: "#A39B8B" }}>{k}</div><div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{v}</div></div>)}
            </div>
            {/* desktop: collapsed left vertical rail (codes only), expands to the nine titles on hover/focus or tap */}
            {!narrow && (
                <nav aria-label="Practice index" onMouseEnter={() => setMenu(true)} onMouseLeave={() => setMenu(false)} onFocus={() => setMenu(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenu(false) }}
                    style={{ position: "absolute", left: 0, top: 81, bottom: p.toolbarClearance, zIndex: 3, width: menu ? 292 : 56, background: menu ? "rgba(20,20,22,.97)" : "rgba(11,11,12,.85)", borderRight: "1px solid #222226", transition: "width .28s cubic-bezier(.2,.7,.2,1), background .28s", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: menu ? "12px 0 30px rgba(0,0,0,.45)" : "none" }}>
                    <button aria-expanded={menu} onClick={() => setMenu(!menu)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, minHeight: 48, padding: "0 19px", color: GOLD, font: `10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", whiteSpace: "nowrap", borderBottom: "1px solid #222226" }}><span aria-hidden="true" style={{ fontSize: 15, width: 18 }}>{menu ? "×" : "☰"}</span>Practice index</button>
                    {NODES.map((n) => (
                        <a key={n.id} href={href(n)} onMouseEnter={() => setHot(n.id)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(n.id)} onBlur={() => setHot(null)} aria-label={n.label}
                            style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 44, padding: "0 16px", color: act === n.id ? GOLD : "#EDE6D8", textDecoration: "none", whiteSpace: "nowrap", borderLeft: `2px solid ${act === n.id ? n.color : "transparent"}` }}>
                            <span style={{ font: `700 11px ${MONO}`, color: n.color, width: 22, letterSpacing: ".06em" }}>{n.code}</span>
                            <span style={{ font: `500 13px Inter,system-ui,sans-serif`, opacity: menu ? 1 : 0, transition: "opacity .2s" }}>{n.label}</span>
                        </a>
                    ))}
                </nav>
            )}
            {/* phones: collapsed menu button with the original nine practice verticals, each a fast-track inquiry link */}
            {narrow && <div style={{ position: "absolute", left: 16, top: 70, zIndex: 3 }}>
                <button aria-expanded={menu} aria-controls="cm-menu" onClick={() => setMenu(!menu)} style={{ display: "flex", alignItems: "center", gap: 10, background: "#141416", color: GOLD, border: "1px solid #222226", font: `10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", padding: "0 14px", minHeight: 44, cursor: "pointer" }}><span aria-hidden="true" style={{ fontSize: 15 }}>{menu ? "×" : "☰"}</span>Practice index</button>
                {menu && (
                    <nav id="cm-menu" aria-label="Practice index" style={{ marginTop: 6, background: "#141416", border: "1px solid #222226", width: "min(300px, calc(100vw - 48px))", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
                        {NODES.map((n, i) => <a key={n.id} href={href(n)} onMouseEnter={() => setHot(n.id)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(n.id)} onBlur={() => setHot(null)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "0 14px", minHeight: 44, borderTop: i ? "1px solid #222226" : 0, color: act === n.id ? GOLD : "#EDE6D8", textDecoration: "none", font: `500 13px Inter,system-ui,sans-serif` }}><span style={{ font: `10px ${MONO}`, color: n.color, width: 22 }}>{n.code}</span>{n.label}</a>)}
                    </nav>
                )}
            </div>}
            <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" role="group" aria-label="How the practice's disciplines connect" style={{ display: "block", height: "auto", transform: "translateZ(0)", willChange: "transform", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <defs><pattern id="cm-g" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#1d1d1d" strokeWidth="1" /></pattern></defs>
                <rect width={VW} height={VH} fill="url(#cm-g)" />
                <ellipse cx={cx} cy={cy} rx={narrow ? 142 : 372} ry={narrow ? 270 : 218} fill="none" stroke="#222226" strokeDasharray="3 6" />
                {EDGES.map(([a, b, lab], i) => {
                    const P0 = pos[a], Q0 = pos[b], on = act && (a === act || b === act)
                    const mx = (P0.x + Q0.x) / 2 + (cx - (P0.x + Q0.x) / 2) * 0.25, my = (P0.y + Q0.y) / 2 + (cy - (P0.y + Q0.y) / 2) * 0.25
                    // stop each connector outside the circle and its perimeter text: move the endpoint along the direction toward the curve's control point
                    const trim = (P: { x: number; y: number }) => { const dx = mx - P.x, dy = my - P.y, d = Math.hypot(dx, dy) || 1; return { x: P.x + (dx / d) * (R + 22), y: P.y + (dy / d) * (R + 22) } }
                    const P = trim(P0), Q = trim(Q0)
                    const lx = 0.25 * P.x + 0.5 * mx + 0.25 * Q.x, ly = 0.25 * P.y + 0.5 * my + 0.25 * Q.y
                    return <g key={i} opacity={act ? (on ? 1 : 0.08) : 0.45} style={{ transition: "opacity .25s" }}><path d={`M${P.x},${P.y} Q${mx},${my} ${Q.x},${Q.y}`} fill="none" stroke={on ? GOLD : "#8a8272"} strokeWidth={on ? 2 : 1} />{on && <g><rect x={lx - lab.length * 3.6 - 6} y={ly - 10} width={lab.length * 7.2 + 12} height="20" fill="#0B0B0C" /><text x={lx} y={ly + 4} textAnchor="middle" fontFamily={MONO} fontSize="11" letterSpacing=".6" fill={GOLD}>{lab}</text></g>}</g>
                })}
                {!narrow && (() => {
                    const x0 = cx - 196, y0 = cy - 74, W = 392, H = 148, k = 12
                    const rows = node ? SCOPE[node.id] : ["SD  Concept → installation", "BV  Revit & sheet standards", "PF  FF&E / OS&E packages", "SL  Pattern & licensing", "CS  Positioning & brief", "CI  Research & criticism"]
                    return (
                        <g style={{ pointerEvents: "none" }}>
                            <rect x={x0} y={y0} width={W} height={H} fill="#0B0B0C" />
                            <path d={`M${x0},${y0 + k}V${y0}H${x0 + k} M${x0 + W - k},${y0}H${x0 + W}V${y0 + k} M${x0 + W},${y0 + H - k}V${y0 + H}H${x0 + W - k} M${x0 + k},${y0 + H}H${x0}V${y0 + H - k}`} fill="none" stroke={node ? node.color : "#4a4640"} strokeWidth="1" />
                            <text x={x0 + 18} y={y0 + 26} fontFamily={MONO} fontSize="9" letterSpacing="2.4" fill={node ? node.color : "#7d766a"}>{node ? node.label.toUpperCase() : "SCOPE INDEX"}</text>
                            {node ? rows.map((r, i) => <text key={r} x={x0 + 18} y={y0 + 56 + i * 26} fontFamily="Inter,system-ui,sans-serif" fontSize="12.5" fill="#D8D0C0">{r}</text>)
                                : rows.map((r, i) => <text key={r} x={x0 + 18 + (i % 2) * 188} y={y0 + 56 + Math.floor(i / 2) * 26} fontFamily={MONO} fontSize="9.5" letterSpacing=".6" fill="#8f887a">{r}</text>)}
                        </g>
                    )
                })()}
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
                                <text fontFamily="Inter,system-ui,sans-serif" fontWeight="700" fontSize={narrow ? 6.2 : 7.2} letterSpacing=".5" fill={n.ink} opacity=".8"><textPath href={`#cm-in-${n.id}`} startOffset="50%" textAnchor="middle">{n.label.toUpperCase()}</textPath></text>
                                <text fontFamily={MONO} fontSize="8" letterSpacing="1" fill="#666666"><textPath href={`#cm-out-${n.id}`} startOffset="50%" textAnchor="middle">{neighbours(n.id)}</textPath></text>
                                <text x={P.x} y={P.y + (narrow ? 29 : 36) * 0.364} textAnchor="middle" fontFamily="Inter,system-ui,sans-serif" fontWeight="800" fontSize={narrow ? 29 : 36} letterSpacing=".02em" fill={n.ink}>{n.code}</text>
                                <text x={P.x} y={P.y + R * 0.6 + (narrow ? 10.5 : 13) * 0.36} textAnchor="middle" fontFamily={MONO} fontSize={narrow ? 10.5 : 13} letterSpacing=".6" fontWeight="700" fill={n.ink}>{n.short}</text>
                                </g>
                        </a>
                    )
                })}
            </svg>
            {/* detail card: always lower-left of the diagram */}
            <div aria-live="polite" style={{ position: "absolute", left: narrow ? 24 : 80, bottom: p.toolbarClearance + 24, width: "min(340px, calc(100% - 48px))", background: "#141416", border: `1px solid ${node ? node.color : "#222"}`, padding: "14px 16px", opacity: node ? 1 : 0, transform: `translate3d(0,${node ? 0 : 8}px,0)`, willChange: "transform, opacity", backfaceVisibility: "hidden", transition: "opacity .2s,transform .2s", pointerEvents: node ? "auto" : "none", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
                {node && <>
                    <div style={{ font: `10px ${MONO}`, letterSpacing: ".22em", textTransform: "uppercase", color: node.color }}>{node.label}</div>
                    <p style={{ margin: "6px 0 10px", fontSize: 14, lineHeight: 1.55 }}>{node.blurb}</p>
                    {narrow && <ul style={{ margin: "0 0 10px", padding: "0 0 0 16px", fontSize: 12.5, lineHeight: 1.6, color: "#C9C1B1" }}>{SCOPE[node.id].map((r) => <li key={r}>{r}</li>)}</ul>}
                    <div style={{ font: `10px ${MONO}`, color: "#A39B8B", lineHeight: 1.7 }}>{EDGES.filter(([a, b]) => a === node.id || b === node.id).map(([a, b, l]) => `${NODES.find((x) => x.id === (a === node.id ? b : a))!.code} ${l}`).join(" · ")}</div>
                    <a href={href(node)} style={{ display: "inline-block", marginTop: 10, padding: "12px 0", color: GOLD, font: `10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", textDecoration: "underline", textUnderlineOffset: 4 }}>Start an inquiry ↗</a>
                </>}
            </div>
            {!act && <div style={{ position: "absolute", left: 24, bottom: p.toolbarClearance + 20, font: `10px ${MONO}`, letterSpacing: ".18em", textTransform: "uppercase", color: "#7d766a" }}>{coarse ? "Tap a discipline" : "Hover a discipline"}</div>}
        </div>
    )
}
CapabilitiesMatrix.defaultProps = { inquiryPath: "/inquiry", toolbarClearance: 96, speed: 1, title: "Capabilities Matrix", width: 960, height: 760 }
addPropertyControls(CapabilitiesMatrix, {
    title: { type: ControlType.String, title: "Title" },
    inquiryPath: { type: ControlType.String, title: "Inquiry path" },
    toolbarClearance: { type: ControlType.Number, title: "Toolbar room", min: 0, max: 220, step: 4, unit: "px" },
    speed: { type: ControlType.Number, title: "Orbit speed", min: 0, max: 3, step: 0.1 },
})
