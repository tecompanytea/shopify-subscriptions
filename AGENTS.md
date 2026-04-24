# AGENTS.md

## Engineering approach
- Default to slow, root-cause-driven changes over fast speculative fixes.
- Do not ship trial fixes just to see if they work when the issue can be investigated first.
- Before editing code, identify the likely cause and explain the reasoning in concrete terms.
- Prefer minimal, correct fixes over broad changes.
- When debugging UI issues, gather evidence first: DOM, state transitions, computed layout, network behavior, and framework or library behavior.
- Treat temporary instrumentation as separate from the real fix, and remove it before finishing.
