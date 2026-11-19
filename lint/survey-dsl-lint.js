#!/usr/bin/env node
'use strict';

/*
 * survey-dsl-lint — a standalone, zero-dependency style/structure linter for Survey DSL.
 *
 * It enforces the §0 hard rules and the §0.1 bright-line style list from
 * SURVEY-DSL-AUTHORING.md — the mechanical mistakes that cause the most real-world
 * breakage. It is deliberately a LINT PASS, not a compiler: it reads the .yml text
 * line-by-line (no grammar, no engine, no network) and stays conservative where a
 * rule would need the full grammar to decide (it warns rather than guesses).
 *
 * It does NOT replace the platform's own syntax/logic validation, which runs
 * server-side at import/publish. A clean lint means "no obvious violations," not
 * "provably valid."
 *
 * Usage:   node survey-dsl-lint.js <file.yml> [more.yml ...]
 * Exit:    0 = no errors (warnings allowed), 1 = one or more errors, 2 = bad usage.
 */

const fs = require('fs');

// ── one problem ────────────────────────────────────────────────────────────
function mk(list, line, sev, code, msg) { list.push({ line, sev, code, msg }); }

// leading-space count (tabs handled separately as an error)
function indentOf(s) { const m = s.match(/^( *)/); return m ? m[1].length : 0; }

// strip a trailing "# comment" that is not inside quotes/braces — cheap heuristic,
// only used to reduce false positives on a few text rules.
function codePart(s) {
  const h = s.indexOf(' #');
  return h >= 0 ? s.slice(0, h) : s;
}

// quoted text blanked out, so an operator inside text is not read as code
function withoutStrings(s) { return s.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""'); }

// one-line properties and flow headers whose value is survey code
const LOGIC_LINE = /^\s*(-\s+(if|elif)\b|(if|validation|options\.from|scale\.from|order|scale\.order)\s*:)/;
const END_OUTCOMES = new Set(['complete', 'terminate', 'quotafull']);

function lintText(text) {
  const problems = [];
  const lines = text.split(/\r?\n/);

  const qids = new Map();       // qid -> first line (dup detection)
  const loopIds = new Map();    // loop id -> first line
  const listNames = new Map();  // list name -> first line

  let curType = null;           // type of the question block we're currently inside
  let inQid = false;

  // loop-context: most recent `- loop:` marker (for the questions: rule + loop id)
  let loopIndent = -1;          // indent of the current `- loop:` line, or -1
  let expectLoopId = false;     // next `id:` belongs to the just-opened loop

  // lists-context: indent of the current `- lists:` block, or -1
  let listsIndent = -1;

  // block-scalar tracking. `code` scalars (script/validation/if) run the logic rules;
  // `prose` scalars (note/text/instruction/title/label/custom) are skipped by content
  // rules so documentation prose can't trip them (e.g. a note that lists the rules).
  let scalarIndent = -1;        // key indent of an open `: |` / `: >` scalar, or -1
  let scalarKind = null;        // 'code' | 'prose'
  const CODE_KEYS = new Set(['script', 'validation', 'if']);

  const STRUCT = /^\s*-\s*(qid|loop|page|block|if|elif|else|script|note|custom|lists)\b/;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const ln = i + 1;
    if (raw.trim() === '') continue;

    const ind = indentOf(raw);
    const code = codePart(raw);

    // ── close an open block scalar on dedent ──
    if (scalarIndent >= 0 && ind <= scalarIndent && raw.trim() !== '') { scalarIndent = -1; scalarKind = null; }
    const inScalar = scalarIndent >= 0 && ind > scalarIndent;
    const inCode = !inScalar || scalarKind === 'code';   // where logic rules apply

    // ── R: tabs in indentation (hard rule #1) — always ──
    if (/^\t| \t/.test(raw)) mk(problems, ln, 'error', 'tab-indent',
      'indentation uses a tab — use 4 spaces');

    // ── R: block comments were removed in engine v3.44.0 — always ──
    if (/^\s*#(\[\[|\]\])/.test(raw)) mk(problems, ln, 'error', 'block-comment-removed',
      '`#[[ ... #]]` block comments were removed — put # on each line, or use a `- note: |` block');

    // ── R: indentation must be a multiple of 4 (warn; skip scalar bodies) ──
    if (!inScalar && ind % 4 !== 0)
      mk(problems, ln, 'warn', 'indent-4', `indentation is ${ind} spaces — DSL indents in multiples of 4`);

    // ── open a block scalar? (key ending in | or >) — classify code vs prose ──
    if (/:\s*[|>][+-]?\s*$/.test(code)) {
      const km = code.match(/([A-Za-z0-9_.]+)\s*:\s*[|>][+-]?\s*$/);
      const key = km ? km[1].split('.')[0] : '';
      scalarIndent = ind;
      scalarKind = CODE_KEYS.has(key) ? 'code' : 'prose';
    }

    // ── text formatting with % or .format() — in logic lines and inside {{ }} pipes anywhere ──
    if (((inScalar && scalarKind === 'code') || LOGIC_LINE.test(code) || code.includes('{{'))
        && /["']\s*(%\s*[A-Za-z_("']|\.format\()/.test(code))
      mk(problems, ln, 'error', 'text-format',
        '`"..." % x` and `.format()` are not part of the survey language — join text with + and str(...), round with round(x, n)');

    // ── code-logic rules: run outside scalars and inside `code` scalars ──
    if (inCode) {
      // Q.any(...) without .selected (context varies → warn)
      if (/\.any\(/.test(code) && !/\.selected\.any\(/.test(code) && !/\bquota\(/.test(code))
        mk(problems, ln, 'warn', 'any-without-selected',
          'membership test should be Q.selected.any([...]) — there is no Q.any(...) form');
      // ── script-language removals of engine v3.44.0 (strict language, §10) ──
      // Only on lines that hold logic: a code scalar, or a one-line logic property.
      const isLogic = (inScalar && scalarKind === 'code') || LOGIC_LINE.test(code);
      const bare = withoutStrings(code);   // operators inside quoted text are not code
      if (isLogic) {
        if (/\/\//.test(bare)) mk(problems, ln, 'error', 'floor-division',
          '`//` is not part of the survey language — use int(a / b)');
        if (/(^|[^A-Za-z0-9_])f["']/.test(code)) mk(problems, ln, 'error', 'f-string',
          'f-strings are not part of the survey language — join text with + and str(...)');
        if (/\\\s*$/.test(raw)) mk(problems, ln, 'error', 'line-continuation',
          'a line cannot be continued with a backslash — keep the condition on one line, or name its parts first');
        if (/\.(answered|notAnswered|matched)\s*(==|!=)\s*[01]\b/.test(bare)) mk(problems, ln, 'error', 'answered-compared',
          '.answered / .notAnswered / .matched are True or False — write `Q.answered` or `not Q.answered`, never == 0 / == 1');
        if (/\.(selected|values|all|selectedLabels)\s+is\s+(not\s+)?None\b/.test(bare)) mk(problems, ln, 'error', 'collection-is-none',
          'a selection or list is never None — test `.size == 0` or `.answered`');
        if (/\bdatetime\.timedelta\b/.test(bare)) mk(problems, ln, 'error', 'datetime-form',
          'there is no datetime.timedelta — work with the parts of a date (.year / .month / .day)');
        const outcome = /\bendSurvey\(\s*["']([^"']*)["']/.exec(code);
        if (outcome && !END_OUTCOMES.has(outcome[1].toLowerCase())) mk(problems, ln, 'error', 'endsurvey-outcome',
          `endSurvey("${outcome[1]}") — the outcome is "complete", "terminate" or "quotafull" only`);
        // An ending needs a way out (engine v3.45.0): an end page named in the call, or a
        // redirectUrl(...) as the next statement. `endSurvey("terminate")` alone is refused.
        if (/\bendSurvey\(\s*(["'][^"']*["'])?\s*\)/.test(code)) {
          let next = '';
          for (let j = i + 1; j < lines.length && !next; j++) next = codePart(lines[j]).trim();
          if (!/^redirectUrl\s*\(/.test(next)) mk(problems, ln, 'error', 'end-without-page',
            'endSurvey(...) needs an end page — endSurvey("terminate", TermPage) — or redirectUrl(...) on the next line');
        }
      }
      // quota().fill() was removed from the engine (double-counted with the auto-fill path)
      if (/\.fill\s*\(/.test(code) && /\bquota\s*\(/.test(code)) mk(problems, ln, 'error', 'quota-fill-removed',
        'quota().fill() has been removed — the engine auto-fills cells on endSurvey("complete"). Read-only from scripts: .isOpen / .count / .target / .remaining; terminate via endSurvey("quotafull") when full');
    }

    // ── everything below is STRUCTURAL — skip inside any scalar body ──
    if (inScalar) continue;

    // ── structural context bookkeeping ──
    const struct = STRUCT.exec(raw);
    if (struct) {
      const kind = struct[1];
      inQid = (kind === 'qid');
      if (inQid) curType = null;
      // any structural item other than a deeper child closes the loop's direct-child scope
      if (kind === 'loop') { loopIndent = ind; expectLoopId = true; }
      else if (ind <= loopIndent) { loopIndent = -1; }
      if (kind === 'lists') listsIndent = ind; else if (ind <= listsIndent) listsIndent = -1;
    }

    // ── R: duplicate / underscored qid ──
    let m = raw.match(/^\s*-\s*qid:\s*(.+?)\s*$/);
    if (m) {
      const name = m[1];
      if (name.includes('_')) mk(problems, ln, 'error', 'qid-underscore',
        `qid "${name}" has an underscore — use camelCase or x-between-digits (Q1x1)`);
      if (qids.has(name)) mk(problems, ln, 'error', 'qid-duplicate',
        `duplicate qid "${name}" (first at line ${qids.get(name)})`);
      else qids.set(name, ln);
    }

    // ── R: type capture (for the gridSingle/style rule) ──
    if (inQid && curType === null) {
      const t = raw.match(/^\s*type:\s*(\S+)/);
      if (t) curType = t[1];
    }

    // ── R: loop id (underscore + duplicate) ──
    const idm = raw.match(/^\s*id:\s*(\S+)/);
    if (idm && expectLoopId) {
      expectLoopId = false;
      const id = idm[1];
      if (id.includes('_')) mk(problems, ln, 'error', 'loopid-underscore',
        `loop id "${id}" has an underscore — use camelCase`);
      if (loopIds.has(id)) mk(problems, ln, 'error', 'loopid-duplicate',
        `duplicate loop id "${id}" (first at line ${loopIds.get(id)}) — iterations key by id and data merges`);
      else loopIds.set(id, ln);
    }

    // ── R: list name underscore + duplicate (direct children of `- lists:`) ──
    if (listsIndent >= 0 && ind === listsIndent + 4) {
      const lm = raw.match(/^\s*([A-Za-z0-9_]+):\s*$/);
      if (lm) {
        const nm = lm[1];
        if (nm.includes('_')) mk(problems, ln, 'error', 'list-underscore',
          `list name "${nm}" has an underscore — use camelCase`);
        if (listNames.has(nm)) mk(problems, ln, 'error', 'list-duplicate',
          `duplicate list name "${nm}" (first at line ${listNames.get(nm)})`);
        else listNames.set(nm, ln);
      }
    }

    // ── R: inline {k: v} options/group/scale ──
    if (/\b(options|group|scale)\s*:\s*\{/.test(code)) mk(problems, ln, 'error', 'inline-options',
      'inline {k: v} form — use a multi-line block, one code per line');

    // ── R: multi-line options.from ──
    if (/options\.from:\s*[|>]/.test(code)) mk(problems, ln, 'error', 'optionsfrom-multiline',
      'options.from must be a one-liner (direct accessor or a named helper call)');

    // ── R: negative option code ──
    if (/^\s+-\d+\s*:/.test(raw)) mk(problems, ln, 'error', 'negative-code',
      'negative option code — renumber to a positive int; put the delta in the label');

    // ── R: lowercase / uppercase booleans ──
    if (/:\s*(true|false|TRUE|FALSE)\b/.test(code)) mk(problems, ln, 'error', 'boolean-case',
      'booleans must be True / False (capitalized)');

    // ── R: default.errors must be True/False (a custom string silently parses to True) ──
    const de = code.match(/^\s*default\.errors\s*:\s*(.+?)\s*$/);
    if (de && de[1] !== 'True' && de[1] !== 'False') mk(problems, ln, 'warn', 'default-errors-boolean',
      'default.errors takes only True/False — for custom wording set it False and use fail("...") in validation');

    // ── R: style rules ──
    const sm = code.match(/\bstyle:\s*([A-Za-z0-9_]+)/);
    if (sm) {
      const val = sm[1];
      if (curType === 'gridSingle' && val === 'dropdown') mk(problems, ln, 'error', 'gridsingle-dropdown',
        'style: dropdown is not canonical on gridSingle — drop the property');
      if (val.includes('_') && curType !== 'mixGrid') mk(problems, ln, 'error', 'style-snakecase',
        `style "${val}" is snake_case — style names are camelCase (e.g. imageCards)`);
    }

    // ── R: `questions:` on a loop (direct child of `- loop:`) ──
    if (loopIndent >= 0 && ind === loopIndent + 4 && /^\s*questions:\s*$/.test(raw))
      mk(problems, ln, 'error', 'loop-questions',
        'a `- loop:` takes DIRECT children, not a `questions:` wrapper (loop-questions-not-allowed)');

    // ── R: label.prefix / label.suffix (context-dependent → warn) ──
    if (/label\.(prefix|suffix)\s*:/.test(code)) mk(problems, ln, 'warn', 'label-affix',
      'label.prefix/suffix — invalid on `single` and on `openList` option entries; verify the type');
  }

  return problems;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function main(argv) {
  const files = argv.slice(2);
  if (files.length === 0) {
    console.error('usage: node survey-dsl-lint.js <file.yml> [more.yml ...]');
    return 2;
  }
  let totalErr = 0, totalWarn = 0;
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); }
    catch (e) { console.error(`${f}: cannot read (${e.code || e.message})`); totalErr++; continue; }
    const problems = lintText(text).sort((a, b) => a.line - b.line);
    const errs = problems.filter(p => p.sev === 'error').length;
    const warns = problems.length - errs;
    totalErr += errs; totalWarn += warns;
    if (problems.length === 0) { console.log(`${f}: 0 problems`); continue; }
    for (const p of problems) console.log(`${f}:${p.line}: [${p.sev}] ${p.code} — ${p.msg}`);
    console.log(`${f}: ${errs} error(s), ${warns} warning(s)`);
  }
  if (files.length > 1) console.log(`\nTOTAL: ${totalErr} error(s), ${totalWarn} warning(s) across ${files.length} files`);
  return totalErr > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv));
module.exports = { lintText };
