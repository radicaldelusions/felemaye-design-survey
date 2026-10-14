// FELEMAYE — AudioContext (src/context/AudioContext.tsx equivalent): persistent site-wide audio engine + React hook (Framer code component)
// HOOK: import { useStudioAudio } from "./FELEMAYE_AudioContext.tsx" gives { playing, title, toggle, play, pause, next, prev } to any component.
// The StudioIpod click wheel in FELEMAYE_HomeDeskStudio.tsx drives this same engine through the "fy-audio" event.
// WHERE: place ONE instance in your site-wide layout (the layout/template that wraps every page) so it stays mounted while visitors navigate.
// WHY IT SURVIVES NAVIGATION: the <audio> element is created once on window.__fyAudio and lives outside React, so even if Framer remounts this
// component on a route change, playback does not restart. Nothing redirects: on "/" it only draws a small "FELEMAYE | Sound On" pill.
// BROWSER RULE: browsers will not start sound until the visitor taps something, so the first play is always the pill. That cannot be bypassed.
// SOURCE: add audio file URLs (mp3/m4a), one per line. Easiest hosting: Supabase Storage bucket "site-audio" (public). Spotify itself cannot be
// used as a seamless background track (logged-out visitors only hear 30-second previews), so Spotify lives in the iPod drawer instead.
// CONTROL FROM ANYWHERE: window.dispatchEvent(new CustomEvent("fy-audio", { detail: { cmd: "toggle" | "play" | "pause" | "next" | "prev" } }))
// STATE EVENT: "fy-audio-state" with detail { playing, title, index }.
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Props = { tracks: string; titles: string; volume: number; homePath: string; showMiniToggle: boolean; style?: React.CSSProperties }
type Eng = { a: HTMLAudioElement; list: string[]; names: string[]; i: number; ready: boolean }

const GOLD = "#D4A373"
const MONO = "ui-monospace,'SF Mono',Menlo,monospace"
const read = (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch {} }
// "Seen" flag: once the Sound On pill has been shown (or answered) it never returns on later routes or visits in this browser.
const seen = () => { try { return localStorage.getItem("fy_sound_gate") !== null || (window as any).__fyGateSeen === true } catch { return (window as any).__fyGateSeen === true } }
const markSeen = () => { (window as any).__fyGateSeen = true; try { localStorage.setItem("fy_sound_gate", "1") } catch {} }

function engine(): Eng {
    const w = window as any
    if (!w.__fyAudio) { const a = new Audio(); a.preload = "none"; a.loop = false; w.__fyAudio = { a, list: [], names: [], i: 0, ready: false } as Eng }
    return w.__fyAudio
}
const emit = (e: Eng) => { try { window.dispatchEvent(new CustomEvent("fy-audio-state", { detail: { playing: !e.a.paused, title: e.names[e.i] || "", index: e.i } })) } catch {} }

export function useStudioAudio() {
    const [st, setSt] = React.useState({ playing: false, title: "" })
    React.useEffect(() => {
        const on = (e: any) => setSt({ playing: !!e.detail?.playing, title: e.detail?.title || "" })
        window.addEventListener("fy-audio-state", on); return () => window.removeEventListener("fy-audio-state", on)
    }, [])
    const send = (cmd: string) => { try { window.dispatchEvent(new CustomEvent("fy-audio", { detail: { cmd } })) } catch {} }
    return { ...st, toggle: () => send("toggle"), play: () => send("play"), pause: () => send("pause"), next: () => send("next"), prev: () => send("prev") }
}

export default function AudioEngine(props: Props) {
    const p = { tracks: "", titles: "", volume: 0.5, homePath: "/", showMiniToggle: true, ...Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) } as Props
    const [playing, setPlaying] = React.useState(false)
    const [fresh, setFresh] = React.useState(false)
    const [onHome, setOnHome] = React.useState(true)
    const [title, setTitle] = React.useState("")

    React.useEffect(() => {
        const e = engine()
        const list = p.tracks.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        const names = p.titles.split(/\r?\n/).map((s) => s.trim())
        if (list.join("|") !== e.list.join("|")) { const was = !e.a.paused; e.list = list; e.names = list.map((u, i) => names[i] || decodeURIComponent((u.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "")).replace(/[_-]+/g, " ")); e.i = 0; if (!e.ready || !was) e.a.src = list[0] || "" }
        e.a.volume = Math.max(0, Math.min(1, p.volume))
        if (!e.ready) {
            e.ready = true
            e.a.addEventListener("ended", () => { e.i = (e.i + 1) % Math.max(1, e.list.length); e.a.src = e.list[e.i]; e.a.play().catch(() => {}); emit(e) })
            e.a.addEventListener("play", () => emit(e)); e.a.addEventListener("pause", () => emit(e))
        }
        const sync = () => { setPlaying(!e.a.paused); setTitle(e.names[e.i] || "") }
        const onState = () => sync()
        const play = () => { if (!e.list.length) return; if (!e.a.src) e.a.src = e.list[e.i]; e.a.play().then(() => write("fy_sound", "on")).catch(() => {}) }
        const pause = () => { e.a.pause(); write("fy_sound", "off") }
        const step = (d: number) => { if (!e.list.length) return; const was = !e.a.paused; e.i = (e.i + d + e.list.length) % e.list.length; e.a.src = e.list[e.i]; if (was) e.a.play().catch(() => {}); emit(e) }
        const onCmd = (ev: any) => { const c = ev?.detail?.cmd; if (c === "play") play(); else if (c === "pause") pause(); else if (c === "toggle") (e.a.paused ? play() : pause()); else if (c === "next") step(1); else if (c === "prev") step(-1) }
        window.addEventListener("fy-audio", onCmd); window.addEventListener("fy-audio-state", onState)
        sync()
        // Resume after navigation: if the visitor had sound on, make sure it is still playing (no restart if it already is).
        if (read("fy_sound") === "on" && e.a.paused && e.list.length) e.a.play().catch(() => {})
        const loc = () => { try { setOnHome(window.location.pathname === p.homePath || window.location.pathname === "") } catch {} ; setFresh((was) => was || (read("fy_sound") === null && !seen())) }
        loc(); window.addEventListener("popstate", loc)
        const t = setInterval(loc, 800)
        return () => { window.removeEventListener("fy-audio", onCmd); window.removeEventListener("fy-audio-state", onState); window.removeEventListener("popstate", loc); clearInterval(t) }
    }, [p.tracks, p.titles, p.volume, p.homePath])

    const hasTracks = p.tracks.trim().length > 0
    const cmd = (c: string) => window.dispatchEvent(new CustomEvent("fy-audio", { detail: { cmd: c } }))
    const accept = () => { cmd("play"); markSeen(); setFresh(false) }
    const decline = () => { write("fy_sound", "off"); markSeen(); setFresh(false) }
    // Showing the pill once counts as seeing it: later route changes fall straight through to the small mini toggle.
    React.useEffect(() => { if (fresh && onHome && hasTracks) { const t = setTimeout(markSeen, 1500); return () => clearTimeout(t) } }, [fresh, onHome, hasTracks])
    const btn: React.CSSProperties = { font: `600 10px ${MONO}`, letterSpacing: ".2em", textTransform: "uppercase", color: "#0B0B0C", background: GOLD, border: 0, padding: "12px 16px", minHeight: 44, cursor: "pointer" }
    return (
        <div style={{ ...p.style, position: "fixed", right: 16, bottom: 16, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, pointerEvents: "none" }}>
            {fresh && onHome && hasTracks && (
                <div role="dialog" aria-label="Sound" style={{ pointerEvents: "auto", background: "#141416", border: "1px solid #222226", padding: "10px 10px 10px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}>
                    <span style={{ font: `10px ${MONO}`, letterSpacing: ".22em", textTransform: "uppercase", color: "#EDE6D8" }}>FELEMAYE | Sound On</span>
                    <button style={btn} onClick={accept}>Play</button>
                    <button aria-label="No sound" onClick={decline} style={{ background: "transparent", border: 0, color: "#A39B8B", font: `16px ${MONO}`, cursor: "pointer", minWidth: 44, minHeight: 44 }}>×</button>
                </div>
            )}
            {p.showMiniToggle && hasTracks && !fresh && (
                <button aria-label={playing ? "Pause studio sound" : "Play studio sound"} aria-pressed={playing} onClick={() => cmd("toggle")} title={title || "Studio sound"} style={{ pointerEvents: "auto", width: 48, height: 48, borderRadius: 24, background: "#0B0B0C", border: `1px solid ${GOLD}`, color: GOLD, cursor: "pointer", display: "grid", placeItems: "center" }}>
                    {playing ? <span style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 16 }}>{[0, 1, 2, 3].map((i) => <i key={i} style={{ width: 3, background: GOLD, height: 16, animation: `fyeq 0.9s ${i * 0.15}s ease-in-out infinite alternate`, transformOrigin: "bottom" }} />)}</span> : <span style={{ fontSize: 18 }}>♪</span>}
                </button>
            )}
            <style>{`@keyframes fyeq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}@media(prefers-reduced-motion:reduce){[style*="fyeq"]{animation:none!important}}`}</style>
        </div>
    )
}

AudioEngine.defaultProps = { tracks: "", titles: "", volume: 0.5, homePath: "/", showMiniToggle: true, width: 200, height: 60 }
addPropertyControls(AudioEngine, {
    tracks: { type: ControlType.String, title: "Audio URLs", displayTextArea: true, description: "One mp3/m4a URL per line" },
    titles: { type: ControlType.String, title: "Track titles", displayTextArea: true, description: "Optional, one per line" },
    volume: { type: ControlType.Number, title: "Volume", min: 0, max: 1, step: 0.05 },
    homePath: { type: ControlType.String, title: "Home path" },
    showMiniToggle: { type: ControlType.Boolean, title: "Mini toggle" },
})
