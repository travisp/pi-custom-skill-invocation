# pi-disable-model-skill-invocation

A tiny [Pi](https://github.com/badlogic/pi-mono) package that globally hides skills from the model while preserving manual `/skill:name` use.

## What it does

Pi supports `disable-model-invocation: true` in individual skill frontmatter. This extension applies the same effect globally without editing skill files:

- skills stay loaded
- `/skill:name` still works
- the model no longer sees the `<available_skills>` block in its system prompt

## Why this package exists

Sometimes you want skills to be **manual-only** at the workflow level, but you do not want to add frontmatter to every skill one by one.

This package gives you a global override that behaves like all skills had:

```yaml
disable-model-invocation: true
```

## Install

```bash
pi install git:github.com/robzolkos/pi-disable-model-skill-invocation
```

Then reload Pi:

```text
/reload
```

## Package layout

This is a standard Pi package with one extension under `extensions/`.

## Notes

This matches Pi's native `disable-model-invocation` behavior closely:

- it does **not** unload skills
- it does **not** disable `/skill:name`
- it does **not** block direct file reads of `SKILL.md`

So this is the native-equivalent behavior, not a stricter sandbox.

## License

MIT
