// FELEMAYE — Studio Perspective(s): dynamic media archive (Framer code component).
// Replaces the /perspectives list. Title, filters and cards share ONE container (max-w-7xl, px-6 md:px-12 lg:px-16), so nothing sits against the left edge.
// Cards: press cards, event/talk cards with inline VIDEO previews (Vimeo / YouTube, loads on tap), audio essays (mp3/m4a player, Spotify or SoundCloud embed).
// ADD / EDIT ENTRIES: one per line in "Entries":  Date | type | Title | Source / note | URL      (type = press, event, podcast, essay, talk)
// A Vimeo/YouTube URL becomes a video preview; an .mp3/.m4a URL becomes an audio player; Spotify/SoundCloud URLs become embedded players. Anything else is a link card.
// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight auto
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Props = { heading: string; intro: string; entries: string; style?: React.CSSProperties }
const DEF_ENTRIES = [
    "Apr 2026|press|This blue, curvy Baldwin Hills house is Black postmodernism in motion|LA Times|",
    "Jan 2022|press|Case Study: The metaverse can help underserved communities raise awareness and build solidarity.||",
    "Sept 2021|press|Creative Inspiration: An event on visibility in design||",
    "Jun 2021|event|Deem Forum Session Three: Reciprocity|Deem Journal|",
    "Jun 2021|podcast|Mother Tongue|WHEREING, hosted by Nina Freedman. Season 1, episode 13|",
    "Apr 2021|event|CPDI Africa Global Studio for African Centered Architecture||",
    "Feb 2021|event|VISIBILITY x DSGN|Virtual symposium for Black makers, with The Designer's Workshop|",
    "Feb 2021|press|10 Questions With Kamille Glenn|Interior Design|",
    "2021|essay|If They Just Told Us the Truth About Great Zimbabwe|Deem Journal / CPDI Africa Blog|",
    "Oct 2020|essay|A Journey to the Past for the Future|CPDI Africa|",
    "Nov 2017|talk|Natome Medri: Rehabilitation of a Vernacular Identity|ASWAD 9th Biennial Conference, Seville|https://vimeo.com/507593414",
].join("\n")
const DEF = { heading: "Studio Perspective(s)", intro: "Select conversations, writings and collective inquiry. A record of ideas shaping the studio's spatial practice.", entries: DEF_ENTRIES }
type E = { date: string; type: string; title: string; note: string; url: string }
const TYPES = ["all", "press", "event", "podcast", "essay", "talk"]
const GOLD = "#D4A373", BG = "#0B0B0C", CARD = "#141416", LINE = "#222226", TEXT = "#EDE6D8", MUTED = "#A39B8B"
const SANS = "Jost,Inter,system-ui,sans-serif", SERIF = "'Cormorant Garamond',Georgia,serif", MONO = "ui-monospace,'SF Mono',Menlo,monospace"

function media(url: string): { kind: "video" | "audio" | "embed" | "link"; src: string } {
    if (!url) return { kind: "link", src: "" }
    let m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/); if (m) return { kind: "video", src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1` }
    m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/); if (m) return { kind: "video", src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1` }
    if (/\.(mp3|m4a|wav|ogg)(\?|$)/i.test(url)) return { kind: "audio", src: url }
    m = url.match(/open\.spotify\.com\/(episode|show|track|album|playlist)\/([\w]+)/); if (m) return { kind: "embed", src: `https://open.spotify.com/embed/${m[1]}/${m[2]}` }
    if (/soundcloud\.com\//.test(url)) return { kind: "embed", src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&visual=false` }
    return { kind: "link", src: url }
}
function thumb(url: string): string {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/); return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : ""
}

export default function Perspectives(props: Props) {
    const p = { ...DEF, ...Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined && v !== "")) } as Props
    const [f, setF] = React.useState("all")
    const [playing, setPlaying] = React.useState<string | null>(null)
    const rows: E[] = p.entries.split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((r) => r[2]).map(([date, type, title, note, url]) => ({ date, type: (type || "press").toLowerCase(), title, note: note || "", url: url || "" }))
    const shown = rows.filter((r) => f === "all" || r.type === f)
    const css = `.px *{box-sizing:border-box}.px{container-type:inline-size}.px .wrap{width:100%;max-width:1280px;margin:0 auto;padding:0 24px}@container (min-width:768px){.px .wrap{padding:0 48px}}@container (min-width:1024px){.px .wrap{padding:0 64px}}
.px .pill{font:500 11px ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${TEXT};background:transparent;border:1px solid #3a3a3c;border-radius:999px;padding:0 16px;min-height:44px;cursor:pointer}.px .pill[aria-pressed=true]{background:${GOLD};color:${BG};border-color:${GOLD}}.px .pill:focus-visible,.px a:focus-visible,.px button:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
.px .grid{display:grid;grid-template-columns:minmax(0,1fr);gap:20px}@container (min-width:640px){.px .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@container (min-width:1024px){.px .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}}
.px .card{background:${CARD};border:1px solid ${LINE};display:flex;flex-direction:column;min-width:0;transition:border-color .25s}.px .card:hover{border-color:${GOLD}}
.px .vid{position:relative;aspect-ratio:16/9;background:#050505;display:block;width:100%;border:0;padding:0;cursor:pointer;overflow:hidden}.px .vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}`
    return (
        <section className="px" style={{ ...p.style, width: "100%", background: BG, color: TEXT, padding: "clamp(40px,7vw,96px) 0" }}>
            <style>{css}</style>
            <div className="wrap max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
                <h1 style={{ font: `400 clamp(38px,6vw,76px)/1.04 ${SERIF}`, margin: "0 0 12px" }}>{p.heading}</h1>
                <p style={{ font: `300 clamp(15px,1.5vw,18px)/1.7 ${SANS}`, color: MUTED, maxWidth: 640, margin: "0 0 32px" }}>{p.intro}</p>
                <div role="group" aria-label="Filter" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
                    {TYPES.map((t) => <button key={t} className="pill" aria-pressed={f === t} onClick={() => setF(t)}>{t}</button>)}
                </div>
                <div className="grid">
                    {shown.map((r, i) => {
                        const id = `${i}-${r.title}`, m = media(r.url), t = thumb(r.url)
                        return (
                            <article key={id} className="card">
                                {m.kind === "video" && (
                                    <div className="vid" style={{ cursor: playing === id ? "default" : "pointer" }}>
                                        {playing === id ? <iframe src={m.src} title={r.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" /> : (
                                            <button className="vid" onClick={() => setPlaying(id)} aria-label={`Play video: ${r.title}`} style={{ background: t ? `#000 url(${t}) center/cover` : "linear-gradient(135deg,#1b1b1f,#0b0b0c)", color: GOLD, display: "grid", placeItems: "center" }}>
                                                <span style={{ width: 64, height: 64, borderRadius: 32, border: `1px solid ${GOLD}`, background: "rgba(11,11,12,.7)", display: "grid", placeItems: "center", fontSize: 22 }}>▶</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                                {m.kind === "embed" && <iframe src={m.src} title={r.title} loading="lazy" allow="autoplay; encrypted-media" style={{ border: 0, width: "100%", height: 152, display: "block" }} />}
                                <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, font: `500 10px ${MONO}`, letterSpacing: ".18em", textTransform: "uppercase" }}><span style={{ color: MUTED }}>{r.date}</span><span style={{ color: GOLD }}>{r.type}{m.kind === "video" ? " · video" : m.kind === "audio" || m.kind === "embed" ? " · audio" : ""}</span></div>
                                    <h2 style={{ font: `400 clamp(21px,2.2vw,26px)/1.2 ${SERIF}`, margin: 0, overflowWrap: "anywhere" }}>{r.title}</h2>
                                    {r.note && <div style={{ font: `300 13px/1.5 ${SANS}`, color: MUTED }}>{r.note}</div>}
                                    {m.kind === "audio" && <audio controls preload="none" src={m.src} style={{ width: "100%", marginTop: 6 }} />}
                                    {(m.kind === "link" || m.kind === "video") && r.url && <a href={r.url} target="_blank" rel="noopener" style={{ marginTop: "auto", paddingTop: 8, color: GOLD, textDecoration: "none", font: `500 11px ${MONO}`, letterSpacing: ".18em", textTransform: "uppercase", minHeight: 44, display: "inline-flex", alignItems: "center" }}>{m.kind === "video" ? "Open on source" : "Read"} ↗</a>}
                                </div>
                            </article>
                        )
                    })}
                </div>
                {!shown.length && <p style={{ color: MUTED }}>Nothing in this category yet.</p>}
            </div>
        </section>
    )
}
Perspectives.defaultProps = { ...DEF, width: 1200, height: 900 }
addPropertyControls(Perspectives, {
    heading: { type: ControlType.String, title: "Heading" },
    intro: { type: ControlType.String, title: "Intro", displayTextArea: true },
    entries: { type: ControlType.String, title: "Entries", displayTextArea: true, description: "Date|type|Title|Note|URL — one per line" },
})
