# Stop Slop

A Claude Code skill that strips AI writing patterns from prose. Based on [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) (MIT).

## What it does

Scores text on 5 dimensions (directness, rhythm, trust, authenticity, density), identifies violations of 8 core rules, rewrites with all violations fixed, and re-scores.

## Install

Copy `SKILL.md` into a skill directory in your Claude Code project:

```
mkdir -p .claude/commands
cp SKILL.md .claude/commands/stop-slop.md
```

Or as a standalone skill directory:

```
mkdir -p skills/stop-slop
cp SKILL.md feedback.log skills/stop-slop/
```

## Usage

```
/stop-slop Here's the email I need cleaned up: ...
/stop-slop rewrite this paragraph to sound human: ...
/stop-slop score this draft and fix anything that reads like AI
```

## The 8 Rules

1. Cut filler phrases
2. Break formulaic structures
3. Use active voice
4. Be specific
5. Put the reader in the room
6. Vary rhythm
7. Trust readers
8. Cut quotables

## Scoring

Rated 1-10 on each dimension. Below 35/50 triggers a rewrite.

| Dimension | Question |
|-----------|----------|
| Directness | Statements or announcements? |
| Rhythm | Varied or metronomic? |
| Trust | Respects reader intelligence? |
| Authenticity | Sounds human? |
| Density | Anything cuttable? |

## Feedback Log

The skill reads `feedback.log` before every execution and applies corrections from prior sessions. New corrections get appended during use. The skill improves over time.

## License

MIT
