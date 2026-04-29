# pi-custom-skill-invocation

A tiny [Pi](https://github.com/badlogic/pi-mono) package that customizes which skills are visible to the model while preserving manual `/skill:name` use.

## What it does

Pi supports `disable-model-invocation: true` in individual skill frontmatter. This extension lets you apply the same effect globally and per project without editing skill files:

- skills stay loaded
- `/skill:name` still works
- the model only sees skills that you explicitly allow-list

## Allow-list configuration

Allow-list entries are skill names.

Global config:

`~/.pi/agent/extensions/skill-invocation.json`

```json
{
  "allow": ["brave-search"],
  "directories": {
    "~/work/frontend-app": ["ui", "impeccable"],
    "~/work/research": ["brave-search"]
  }
}
```

Project/per-directory config:

`<project>/.pi/skill-invocation.json`

```json
{
  "allow": ["ui", "impeccable"]
}
```

Project config is discovered from the current working directory upward, so nested directories can add their own `.pi/skill-invocation.json`. Parent configs apply first, then nested configs.

If no allow-list entry matches a skill, it is omitted from `<available_skills>` and remains manual-only.

## Why this package exists

Sometimes you want skills to be **manual-only** at the workflow level, but you do not want to add frontmatter to every skill one by one.

This package gives you a global override that behaves like non-allow-listed skills had:

```yaml
disable-model-invocation: true
```

## Install

```bash
pi install git:github.com/travisp/pi-custom-skill-invocation
```

Then reload Pi:

```text
/reload
```

## Migrating from `pi-disable-model-skill-invocation`

```bash
pi remove git:github.com/travisp/pi-disable-model-skill-invocation
pi install git:github.com/travisp/pi-custom-skill-invocation
```

Existing `skill-invocation.json` config files can stay where they are.

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
