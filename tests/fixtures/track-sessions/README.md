# Track session record fixtures

The three `*-ip.md` records carry the lap splits of real races. Those splits are public race results
and are already quoted in this repo — they are here so the derivation can be regression-locked
against the figures `docs/personal/track-context.md` §4 and `season.md` arrived at by hand, before
this service existed.

Their **prose is deliberately trimmed to the measurement basis**. The athlete's records in
`docs/personal/track/` carry coaching commentary, and `docs/personal/` is gitignored from this
repository on purpose; copying those files whole would move that commentary into a public repo as a
side effect of writing a test. Anything a test needs to assert is in the frontmatter and the splits.

`bad-*.md` are synthetic, and exist to prove the failure modes are loud.
