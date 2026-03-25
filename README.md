# namesmart

Test whether LLMs perform differently based on the "name" in their system prompt.

The system prompt is simply: `You are {name}, a chatbot.`

Each run fires N questions (multiplication, letter counting, string reversal) and scores accuracy. Outputs 95% confidence intervals, power analysis, and throughput stats.

## Setup

```bash
npm install
```

Create a `.env` file:

```
ANTHROPIC_API_KEY=sk-ant-...
BASETEN_API_KEY=...          # optional, for Baseten-hosted models
```

## Usage

```bash
node test.mjs --name "Claude" --n 100
node test.mjs --name "Claude" --n 100 --verbose
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--name` | `Assistant` | Name injected into the system prompt |
| `--n` | `10` | Number of questions |
| `--model` | `claude-haiku-4-5-20251001` | Model ID |
| `--verbose` | `false` | Show per-question details |

## Models

### Anthropic (direct API)

```bash
# Haiku 4.5 (default)
node test.mjs --name "Ari" --n 100

# Sonnet 4.6
node test.mjs --name "Ari" --n 100 --model claude-sonnet-4-6

# Sonnet 4.5
node test.mjs --name "Ari" --n 100 --model claude-sonnet-4-5-20250929
```

### Baseten (OpenAI-compatible)

Any model with a `/` in the ID routes to Baseten. Requires `BASETEN_API_KEY`.

```bash
# Nemotron 120B
node test.mjs --name "Ari" --n 100 --model "nvidia/Nemotron-120B-A12B"

# MiniMax M2.5
node test.mjs --name "Ari" --n 100 --model "MiniMaxAI/MiniMax-M2.5"
```

## Example output

```
Testing name: "Ari" | Model: claude-haiku-4-5-20251001 | Questions: 100

✗✗✓✗✗✓✓✗✓✓✗✓✓✓✗✓✓✗✓✓✓✗✓✓✗✓✗✓✓✗✓✓✗✓✗✓✓✓✓✗✓✗✓✓✗✓✓✓✓✓
✓✗✓✗✓✗✓✓✗✗✓✗✓✗✓✓✓✗✓✓✗✓✓✓✗✓✓✗✓✗✓✓✗✓✗✓✓✓✓✗✓✗✓✓✗✓✓✓✓✓

┌─────────────────────────────────────────────────┐
│                    RESULTS                      │
├─────────────────────┬───────────────────────────┤
│ Name                │ Ari                       │
│ Model               │ claude-haiku-4-5-20251001 │
│ Questions           │ 100                       │
├─────────────────────┼───────────────────────────┤
│ Correct             │ 42/100 (42.0%)            │
│ 95% CI              │ 32.3% – 51.7%             │
│ Margin of error     │ ±9.7%                     │
├─────────────────────┼───────────────────────────┤
│ Min detectable Δ    │ 19.5% (80% power)         │
│ n for 5% Δ          │ 1529 per name             │
├─────────────────────┼───────────────────────────┤
│ Output tokens       │ 312                       │
│ Wall time           │ 45.2s                     │
│ Throughput           │ 6.9 tok/s                 │
└─────────────────────┴───────────────────────────┘
```

## Question types

| Type | Example | Difficulty |
|------|---------|-----------|
| Multiplication | `4561 * 3119 = ?` | 4-digit x 4-digit |
| Letter counting | `How many "s" in "mississippi"?` | From system dictionary (~175k words) |
| String reversal | `Reverse "algorithm"` | From system dictionary (~175k words) |

## Statistical notes

- **Margin of error** at n=100 is ~±9.6% (at p=0.4), so most differences between names are noise
- To reliably detect a 5% difference between two names, you need ~1,500 questions per name
- Each question is independent (no conversation history accumulates)
