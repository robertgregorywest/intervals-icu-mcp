# Intensity anchoring

**MAP is the primary anchor.** FTP is derived/contextual — a top-heavy pursuiter profile, and
**raising the FTP:MAP ratio is the durability lever for the 2 km IP**.

All training intensities are reasoned in **%MAP**, with **absolute watts** emitted to Intervals.icu
(the parser doesn't understand `%MAP`; convert first). Anaerobic/start work is judged on **RPE and
on-track speed** — there's no power meter on the fixed gear.

Live MAP/FTP values and the _current_ FTP:MAP ratio are athlete state — read them from
`get_coaching_context`, don't hard-code them here. Season-specific ratio targets live in
`docs/personal/season.md`.
