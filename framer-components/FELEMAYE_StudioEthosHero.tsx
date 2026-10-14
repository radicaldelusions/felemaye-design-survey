// FELEMAYE — About / Studio Ethos hero (Framer code component).
// Kinetic manifesto ticker, architectural-blue accents (#0F172A #1E293B #2563EB), Framer Motion reveals, and a tactile Polaroid
// (rotate 2deg → 0 on hover, layered shadow, marker captions on the white border). Stacks flex-col on mobile, row from 1024px.
// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight auto
import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type Props = { eyebrow: string; headline: string; body: string; credentials: string; manifesto: string; photo?: { src?: string }; caption: string; captionSub: string; style?: React.CSSProperties }
const DEF = {
    eyebrow: "About the Studio · Studio Ethos",
    headline: "Designed from memory,\nbuilt for futures.",
    body: "FELEMAYE is a Los Angeles and New York design studio working across spatial design, surface development, and critical inquiry. Every room begins as a conversation about memory, material, and the people who will live inside it.",
    credentials: "Cornell University\nLos Angeles · New York",
    manifesto: "Material before decoration\nMemory is a client\nSurfaces carry stories\nDraw it, then build it\nSlow rooms, sharp details\nDesigned for the people inside",
    caption: "Felema, on site",
    captionSub: "scouting light · Los Angeles",
}
const NAVY = "#0F172A", SLATE = "#1E293B", BLUE = "#2563EB", INK = "#EDE6D8", MUTED = "#94A3B8"
const SANS = "Inter,system-ui,sans-serif", SERIF = "'Cormorant Garamond',Georgia,serif"
const MARKER = "'Permanent Marker','Reenie Beanie','Caveat','Bradley Hand',cursive"

export default function StudioEthosHero(props: Props) {
    const p = { ...DEF, ...Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) } as Props
    const calm = useReducedMotion()
    const lines = p.headline.split("\n")
    const items = p.manifesto.split("\n").map((s) => s.trim()).filter(Boolean)
    const loop = [...items, ...items]
    const rise = (d: number) => ({ initial: calm ? false : { opacity: 0, y: 26 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: d, ease: [0.22, 1, 0.36, 1] as any } })
    const css = `
.seh *{box-sizing:border-box}
.seh .wrap{width:100%;max-width:80rem;margin:0 auto;padding:0 16px;overflow:hidden}@media(min-width:640px){.seh .wrap{padding:0 24px}}
@media (min-width:768px){.seh .wrap{padding:0 48px}}@media (min-width:1024px){.seh .wrap{padding:0 64px}}
.seh .row{display:flex;flex-direction:column;gap:48px;align-items:center}
@media (min-width:1024px){.seh .row{flex-direction:row;gap:48px;align-items:center;justify-content:space-between}.seh .col-t{flex:0 0 60%;max-width:60%}.seh .col-p{flex:0 0 40%;max-width:40%}}
.seh .col-t,.seh .col-p{min-width:0;width:100%}
.seh .tick{display:flex;width:max-content;animation:sehslide 38s linear infinite;will-change:transform}
.seh .tick:hover{animation-play-state:paused}
@keyframes sehslide{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
@media(prefers-reduced-motion:reduce){.seh .tick{animation:none}}
.seh .pol{rotate:2deg;transition:rotate 1.1s cubic-bezier(.22,1,.36,1);will-change:transform}
.seh .pol:hover{rotate:-1deg}
`
    return (
        <section className="seh" style={{ ...p.style, width: "100%", background: `linear-gradient(180deg,${NAVY} 0%,${SLATE} 100%)`, color: INK, padding: "clamp(48px,8vw,104px) 0 0", overflow: "hidden", position: "relative", maxWidth: "100%", boxSizing: "border-box" }}>
            <style>{css}</style>
            <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${BLUE}14 1px,transparent 1px),linear-gradient(90deg,${BLUE}14 1px,transparent 1px)`, backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at 30% 30%,#000 0%,transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at 30% 30%,#000 0%,transparent 70%)", pointerEvents: "none" }} />
            <div className="wrap max-w-7xl mx-auto px-6 md:px-12 lg:px-16" style={{ position: "relative" }}>
                <div className="row flex-col lg:flex-row">
                    <div className="col-t">
                        <motion.div {...rise(0)} style={{ font: `500 11px ui-monospace,Menlo,monospace`, letterSpacing: ".28em", textTransform: "uppercase", color: BLUE, display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ width: 36, height: 1, background: BLUE, display: "inline-block" }} />{p.eyebrow}
                        </motion.div>
                        <h1 style={{ margin: "22px 0 0", font: `400 clamp(40px,6.4vw,84px)/1.02 ${SERIF}`, letterSpacing: "-.01em", color: INK }}>
                            {lines.map((l, i) => (
                                <span key={i} style={{ display: "block", overflow: "hidden" }}>
                                    <motion.span style={{ display: "block", fontStyle: i === 1 ? "italic" : "normal", color: i === 1 ? "#93B4F5" : INK }} initial={calm ? false : { y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.95, delay: 0.1 + i * 0.14, ease: [0.22, 1, 0.36, 1] }}>{l}</motion.span>
                                </span>
                            ))}
                        </h1>
                        <motion.div {...rise(0.3)} style={{ marginTop: 22, font: `600 clamp(15px,1.6vw,19px) ${SANS}`, letterSpacing: ".08em", color: "#93B4F5" }}>Felema Yemaneberhan <span style={{ color: BLUE, margin: "0 8px" }}>|</span> <span lang="ti" style={{ fontFamily: "'Noto Sans Ethiopic','Abyssinica SIL',Inter,sans-serif" }}>ፈለማ የማነበርሃን</span></motion.div>
                        <motion.p {...rise(0.35)} style={{ font: `300 clamp(15px,1.5vw,18px)/1.75 ${SANS}`, color: "#CBD5E1", margin: "28px 0 0", maxWidth: "62ch" }}>{p.body}</motion.p>
                        <motion.div {...rise(0.5)} style={{ marginTop: 28, paddingLeft: 16, borderLeft: `2px solid ${BLUE}`, font: `500 12px/1.9 ui-monospace,Menlo,monospace`, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED, whiteSpace: "pre-line" }}>{p.credentials}</motion.div>
                    </div>
                    <motion.div {...rise(0.25)} className="col-p" style={{ display: "flex", justifyContent: "center" }}>
                        <motion.figure className="pol rotate-2 hover:rotate-0 transition-transform" animate={calm ? undefined : { y: [0, -10, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} style={{ margin: 0, width: "min(100%, 440px)", background: "#FBFAF6", padding: "16px 16px 0", boxShadow: "0 2px 3px rgba(0,0,0,.25),0 14px 28px rgba(2,6,23,.45),0 34px 60px rgba(2,6,23,.4)", position: "relative" }}>
                            <div aria-hidden style={{ position: "absolute", top: -14, left: "50%", width: 96, height: 26, transform: "translateX(-50%) rotate(-3deg)", background: "rgba(214,205,178,.55)", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                            <div style={{ aspectRatio: "1 / 1", background: p.photo?.src ? `#000 url(${p.photo.src}) center/cover` : `repeating-linear-gradient(135deg,${SLATE},${SLATE} 10px,#243247 10px,#243247 20px)`, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25), inset 0 6px 14px rgba(0,0,0,.25)", display: "grid", placeItems: "center", color: "#7C8CA5", font: `11px ui-monospace,monospace`, letterSpacing: ".2em" }}>{!p.photo?.src && "ADD PHOTO"}</div>
                            <figcaption style={{ padding: "16px 6px 20px", textAlign: "center", color: "#1b2a4a" }}>
                                <div style={{ font: `400 clamp(22px,3vw,28px)/1.1 ${MARKER}`, transform: "rotate(-1.5deg)" }}>{p.caption}</div>
                                <div style={{ font: `400 clamp(16px,2.2vw,19px)/1.2 ${MARKER}`, color: BLUE, marginTop: 6, transform: "rotate(-1deg)" }}>{p.captionSub}</div>
                            </figcaption>
                        </motion.figure>
                    </motion.div>
                </div>
            </div>
            <div aria-label="Studio manifesto" style={{ marginTop: "clamp(48px,7vw,88px)", borderTop: `1px solid ${BLUE}55`, borderBottom: `1px solid ${BLUE}55`, background: "#0B1220", overflow: "hidden", position: "relative" }}>
                <div className="tick" style={{ padding: "16px 0" }}>
                    {loop.map((t, i) => (
                        <span key={i} style={{ display: "inline-flex", alignItems: "center", whiteSpace: "nowrap", font: `600 clamp(12px,1.4vw,15px) ${SANS}`, letterSpacing: ".26em", textTransform: "uppercase", color: i % 2 ? "#CBD5E1" : "#93B4F5" }}>
                            {t}<span aria-hidden style={{ margin: "0 28px", color: BLUE }}>◆</span>
                        </span>
                    ))}
                </div>
            </div>
        </section>
    )
}
StudioEthosHero.defaultProps = { ...DEF, width: 1200, height: 760 }
addPropertyControls(StudioEthosHero, {
    eyebrow: { type: ControlType.String, title: "Eyebrow" },
    headline: { type: ControlType.String, title: "Headline", displayTextArea: true, description: "Line break = new line" },
    body: { type: ControlType.String, title: "Body", displayTextArea: true },
    credentials: { type: ControlType.String, title: "Credentials", displayTextArea: true },
    manifesto: { type: ControlType.String, title: "Ticker lines", displayTextArea: true, description: "One per line" },
    photo: { type: ControlType.ResponsiveImage, title: "Polaroid photo" },
    caption: { type: ControlType.String, title: "Caption" },
    captionSub: { type: ControlType.String, title: "Caption 2" },
})
