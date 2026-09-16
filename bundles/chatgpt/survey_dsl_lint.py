#!/usr/bin/env python3
"""survey_dsl_lint — standalone, zero-dependency style/structure linter for Survey DSL.

A line-for-line Python port of ``survey-dsl-lint.js`` (same rules, severities,
messages, output, and exit codes). Use this where Node isn't available — e.g. a
ChatGPT Code Interpreter sandbox, or a Python CI step.

It enforces the §0 hard rules and the §0.1 bright-line style list from
SURVEY-DSL-AUTHORING.md — the mechanical mistakes that cause the most real-world
breakage. It is deliberately a LINT PASS, not a compiler (no grammar, no engine, no
network) and stays conservative where a rule would need the full grammar to decide
(it warns rather than guesses). It does NOT replace the platform's own syntax/logic
validation at import/publish. A clean lint means "no obvious violations," not
"provably valid."

Usage:   python3 survey_dsl_lint.py <file.yml> [more.yml ...]
Exit:    0 = no errors (warnings allowed), 1 = one or more errors, 2 = bad usage.
"""

import re
import sys

CODE_KEYS = {"script", "validation", "if"}
STRUCT = re.compile(r"^\s*-\s*(qid|loop|page|block|if|elif|else|script|note|custom|lists)\b")


def _indent_of(s):
    return len(s) - len(s.lstrip(" "))


def _code_part(s):
    # strip a trailing " # comment" — cheap heuristic to cut false positives
    h = s.find(" #")
    return s[:h] if h >= 0 else s


def lint_text(text):
    """Return a list of {line, sev, code, msg} dicts for the given DSL text."""
    problems = []

    def mk(line, sev, code, msg):
        problems.append({"line": line, "sev": sev, "code": code, "msg": msg})

    lines = re.split(r"\r?\n", text)

    qids = {}        # qid -> first line
    loop_ids = {}    # loop id -> first line
    list_names = {}  # list name -> first line

    cur_type = None
    in_qid = False

    loop_indent = -1
    expect_loop_id = False
    lists_indent = -1

    scalar_indent = -1
    scalar_kind = None  # 'code' | 'prose'

    for i, raw in enumerate(lines):
        ln = i + 1
        if raw.strip() == "":
            continue

        ind = _indent_of(raw)
        code = _code_part(raw)

        # close an open block scalar on dedent
        if scalar_indent >= 0 and ind <= scalar_indent and raw.strip() != "":
            scalar_indent = -1
            scalar_kind = None
        in_scalar = scalar_indent >= 0 and ind > scalar_indent
        in_code = (not in_scalar) or scalar_kind == "code"

        # R: tabs in indentation (hard rule #1) — always
        if raw.startswith("\t") or " \t" in raw:
            mk(ln, "error", "tab-indent", "indentation uses a tab — use 4 spaces")

        # R: indentation must be a multiple of 4 (warn; skip scalar bodies)
        if not in_scalar and ind % 4 != 0:
            mk(ln, "warn", "indent-4",
               "indentation is %d spaces — DSL indents in multiples of 4" % ind)

        # open a block scalar? (key ending in | or >) — classify code vs prose
        if re.search(r":\s*[|>][+-]?\s*$", code):
            km = re.search(r"([A-Za-z0-9_.]+)\s*:\s*[|>][+-]?\s*$", code)
            key = km.group(1).split(".")[0] if km else ""
            scalar_indent = ind
            scalar_kind = "code" if key in CODE_KEYS else "prose"

        # code-logic rules: run outside scalars and inside `code` scalars
        if in_code:
            if re.search(r"\.any\(", code) and not re.search(r"\.selected\.any\(", code) \
                    and not re.search(r"\bquota\(", code):
                mk(ln, "warn", "any-without-selected",
                   "membership test should be Q.selected.any([...]) — there is no Q.any(...) form")
            if re.search(r"=\s*.+\sif\s.+\selse\s", code) and "{{" not in code:
                mk(ln, "warn", "ternary-in-logic",
                   "inline ternary (a if c else b) is not allowed in script/validation/if: — use an if/else block")
            if re.match(r"\s+(continue|break)\s*$", raw):
                mk(ln, "error", "continue-break",
                   "continue/break are blocked in the Python subset — invert the predicate instead")

        # everything below is STRUCTURAL — skip inside any scalar body
        if in_scalar:
            continue

        # structural context bookkeeping
        struct = STRUCT.match(raw)
        if struct:
            kind = struct.group(1)
            in_qid = kind == "qid"
            if in_qid:
                cur_type = None
            if kind == "loop":
                loop_indent = ind
                expect_loop_id = True
            elif ind <= loop_indent:
                loop_indent = -1
            if kind == "lists":
                lists_indent = ind
            elif ind <= lists_indent:
                lists_indent = -1

        # R: duplicate / underscored qid
        m = re.match(r"^\s*-\s*qid:\s*(.+?)\s*$", raw)
        if m:
            name = m.group(1)
            if "_" in name:
                mk(ln, "error", "qid-underscore",
                   'qid "%s" has an underscore — use camelCase or x-between-digits (Q1x1)' % name)
            if name in qids:
                mk(ln, "error", "qid-duplicate",
                   'duplicate qid "%s" (first at line %d)' % (name, qids[name]))
            else:
                qids[name] = ln

        # R: type capture (for the gridSingle/style rule)
        if in_qid and cur_type is None:
            t = re.match(r"^\s*type:\s*(\S+)", raw)
            if t:
                cur_type = t.group(1)

        # R: loop id (underscore + duplicate)
        idm = re.match(r"^\s*id:\s*(\S+)", raw)
        if idm and expect_loop_id:
            expect_loop_id = False
            lid = idm.group(1)
            if "_" in lid:
                mk(ln, "error", "loopid-underscore",
                   'loop id "%s" has an underscore — use camelCase' % lid)
            if lid in loop_ids:
                mk(ln, "error", "loopid-duplicate",
                   'duplicate loop id "%s" (first at line %d) — iterations key by id and data merges'
                   % (lid, loop_ids[lid]))
            else:
                loop_ids[lid] = ln

        # R: list name underscore + duplicate (direct children of `- lists:`)
        if lists_indent >= 0 and ind == lists_indent + 4:
            lm = re.match(r"^\s*([A-Za-z0-9_]+):\s*$", raw)
            if lm:
                nm = lm.group(1)
                if "_" in nm:
                    mk(ln, "error", "list-underscore",
                       'list name "%s" has an underscore — use camelCase' % nm)
                if nm in list_names:
                    mk(ln, "error", "list-duplicate",
                       'duplicate list name "%s" (first at line %d)' % (nm, list_names[nm]))
                else:
                    list_names[nm] = ln

        # R: inline {k: v} options/group/scale
        if re.search(r"\b(options|group|scale)\s*:\s*\{", code):
            mk(ln, "error", "inline-options",
               "inline {k: v} form — use a multi-line block, one code per line")

        # R: multi-line options.from
        if re.search(r"options\.from:\s*[|>]", code):
            mk(ln, "error", "optionsfrom-multiline",
               "options.from must be a one-liner (direct accessor or a named helper call)")

        # R: negative option code
        if re.match(r"^\s+-\d+\s*:", raw):
            mk(ln, "error", "negative-code",
               "negative option code — renumber to a positive int; put the delta in the label")

        # R: lowercase / uppercase booleans
        if re.search(r":\s*(true|false|TRUE|FALSE)\b", code):
            mk(ln, "error", "boolean-case", "booleans must be True / False (capitalized)")

        # R: default.errors must be True/False (a custom string silently parses to True)
        de = re.match(r"^\s*default\.errors\s*:\s*(.+?)\s*$", code)
        if de and de.group(1) not in ("True", "False"):
            mk(ln, "warn", "default-errors-boolean",
               'default.errors takes only True/False — for custom wording set it False and use fail("...") in validation')

        # R: style rules
        sm = re.search(r"\bstyle:\s*([A-Za-z0-9_]+)", code)
        if sm:
            val = sm.group(1)
            if cur_type == "gridSingle" and val == "dropdown":
                mk(ln, "error", "gridsingle-dropdown",
                   "style: dropdown is not canonical on gridSingle — drop the property")
            if "_" in val and cur_type != "mixGrid":
                mk(ln, "error", "style-snakecase",
                   'style "%s" is snake_case — style names are camelCase (e.g. imageCards)' % val)

        # R: `questions:` on a loop (direct child of `- loop:`)
        if loop_indent >= 0 and ind == loop_indent + 4 and re.match(r"^\s*questions:\s*$", raw):
            mk(ln, "error", "loop-questions",
               "a `- loop:` takes DIRECT children, not a `questions:` wrapper (loop-questions-not-allowed)")

        # R: label.prefix / label.suffix (context-dependent → warn)
        if re.search(r"label\.(prefix|suffix)\s*:", code):
            mk(ln, "warn", "label-affix",
               "label.prefix/suffix — invalid on `single` and on `openList` option entries; verify the type")

    return problems


def main(argv):
    files = argv[1:]
    if not files:
        sys.stderr.write("usage: python3 survey_dsl_lint.py <file.yml> [more.yml ...]\n")
        return 2
    total_err = 0
    total_warn = 0
    for f in files:
        try:
            with open(f, "r", encoding="utf-8") as fh:
                text = fh.read()
        except OSError as e:
            sys.stderr.write("%s: cannot read (%s)\n" % (f, e.strerror or e))
            total_err += 1
            continue
        problems = sorted(lint_text(text), key=lambda p: p["line"])
        errs = sum(1 for p in problems if p["sev"] == "error")
        warns = len(problems) - errs
        total_err += errs
        total_warn += warns
        if not problems:
            print("%s: 0 problems" % f)
            continue
        for p in problems:
            print("%s:%d: [%s] %s — %s" % (f, p["line"], p["sev"], p["code"], p["msg"]))
        print("%s: %d error(s), %d warning(s)" % (f, errs, warns))
    if len(files) > 1:
        print("\nTOTAL: %d error(s), %d warning(s) across %d files" % (total_err, total_warn, len(files)))
    return 1 if total_err > 0 else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
