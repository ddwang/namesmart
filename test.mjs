import "dotenv/config";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";

const { values } = parseArgs({
  options: {
    name: { type: "string", default: "Assistant" },
    n: { type: "string", default: "10" },
    model: { type: "string", default: "claude-haiku-4-5-20251001" },
    verbose: { type: "boolean", default: false },
  },
});

const name = values.name;
const n = parseInt(values.n, 10);
const modelId = values.model;
const verbose = values.verbose;

const anthropic = createAnthropic();
const baseten = createOpenAI({
  apiKey: process.env.BASETEN_API_KEY,
  baseURL: "https://inference.baseten.co/v1",
});

function getModel(id) {
  if (id.includes("/")) {
    return baseten.chat(id);
  }
  return anthropic(id);
}

// Load dictionary words (lowercase, 7-15 chars, no proper nouns)
const dictWords = readFileSync("/usr/share/dict/words", "utf-8")
  .split("\n")
  .filter((w) => /^[a-z]{7,15}$/.test(w));

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

// --- Question generators ---

function multiplyQuestion() {
  const a = randInt(1000, 9999);
  const b = randInt(1000, 9999);
  return {
    prompt: `What is ${a} * ${b}? Reply with just the number, nothing else.`,
    display: `${a} * ${b}`,
    answer: String(a * b),
  };
}

function letterCountQuestion() {
  const word = pick(dictWords);
  const letters = word.split("");
  const target = pick(letters);
  const count = letters.filter((l) => l === target).length;
  return {
    prompt: `How many times does the letter "${target}" appear in the word "${word}"? Reply with just the number, nothing else.`,
    display: `"${target}" in "${word}"`,
    answer: String(count),
  };
}

function reverseQuestion() {
  const word = pick(dictWords);
  const reversed = word.split("").reverse().join("");
  return {
    prompt: `Reverse the word "${word}" character by character. Reply with just the reversed word, nothing else.`,
    display: `reverse("${word}")`,
    answer: reversed,
  };
}

const generators = [multiplyQuestion, letterCountQuestion, reverseQuestion];

function generateQuestion() {
  const gen = generators[randInt(0, generators.length - 1)];
  return gen();
}

function extractAnswer(text, expected) {
  const trimmed = text.trim().toLowerCase();
  // For numeric answers, extract the first number
  if (/^\d+$/.test(expected)) {
    const cleaned = trimmed.replace(/,/g, "");
    const match = cleaned.match(/\d+/);
    return match ? match[0] : trimmed;
  }
  // For string answers (reverse), take first word/line
  return trimmed.split(/[\s\n]/)[0].replace(/[^a-z]/g, "");
}

console.log(
  `Testing name: "${name}" | Model: ${modelId} | Questions: ${n}\n`
);

let correct = 0;
let totalOutputTokens = 0;
const startTime = Date.now();

for (let i = 0; i < n; i++) {
  const q = generateQuestion();

  const { text, usage } = await generateText({
    model: getModel(modelId),
    system: `You are ${name}, a chatbot.`,
    prompt: q.prompt,
  });

  const llmAnswer = extractAnswer(text, q.answer);
  const isCorrect = llmAnswer === q.answer;
  if (isCorrect) correct++;
  if (usage?.outputTokens) totalOutputTokens += usage.outputTokens;

  const mark = isCorrect ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  if (verbose) {
    const num = String(i + 1).padStart(2);
    console.log(
      ` #${num}  ${q.display} = ${q.answer} | LLM: ${llmAnswer} | ${mark}`
    );
  } else {
    process.stdout.write(mark);
    if ((i + 1) % 50 === 0) process.stdout.write("\n");
  }
}

const elapsed = (Date.now() - startTime) / 1000;
const tps = totalOutputTokens / elapsed;
const p = correct / n;
const pct = (p * 100).toFixed(1);

// 95% CI margin of error (Wald interval)
const me = 1.96 * Math.sqrt((p * (1 - p)) / n);
const mePct = (me * 100).toFixed(1);
const ciLo = Math.max(0, (p - me) * 100).toFixed(1);
const ciHi = Math.min(100, (p + me) * 100).toFixed(1);

// Power: min detectable difference at 80% power, alpha=0.05
// n = (Z_a/2 + Z_b)^2 * 2*p*(1-p) / delta^2  =>  delta = sqrt((Z_a/2 + Z_b)^2 * 2*p*(1-p) / n)
const minDelta = Math.sqrt(Math.pow(1.96 + 0.84, 2) * 2 * p * (1 - p) / n);
const minDeltaPct = (minDelta * 100).toFixed(1);

// Samples needed to detect a 5% difference at 80% power
const nFor5pct = Math.ceil(Math.pow(1.96 + 0.84, 2) * 2 * p * (1 - p) / Math.pow(0.05, 2));

if (!verbose) process.stdout.write("\n");

console.log("");
console.log("┌─────────────────────────────────────────────────┐");
console.log("│                    RESULTS                      │");
console.log("├─────────────────────┬───────────────────────────┤");
console.log(`│ Name                │ ${name.padEnd(26)}│`);
console.log(`│ Model               │ ${modelId.padEnd(26)}│`);
console.log(`│ Questions           │ ${String(n).padEnd(26)}│`);
console.log("├─────────────────────┼───────────────────────────┤");
console.log(`│ Correct             │ ${`${correct}/${n} (${pct}%)`.padEnd(26)}│`);
console.log(`│ 95% CI              │ ${`${ciLo}% – ${ciHi}%`.padEnd(26)}│`);
console.log(`│ Margin of error     │ ${`±${mePct}%`.padEnd(26)}│`);
console.log("├─────────────────────┼───────────────────────────┤");
console.log(`│ Min detectable Δ    │ ${`${minDeltaPct}% (80% power)`.padEnd(26)}│`);
console.log(`│ n for 5% Δ          │ ${`${nFor5pct} per name`.padEnd(26)}│`);
console.log("├─────────────────────┼───────────────────────────┤");
console.log(`│ Output tokens       │ ${String(totalOutputTokens).padEnd(26)}│`);
console.log(`│ Wall time           │ ${`${elapsed.toFixed(1)}s`.padEnd(26)}│`);
console.log(`│ Throughput           │ ${`${tps.toFixed(1)} tok/s`.padEnd(26)}│`);
console.log("└─────────────────────┴───────────────────────────┘");
