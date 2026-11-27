#!/usr/bin/env python3
"""
PatchPulse Isolated Python 3.12 Verification Runner.
Executes strictly inside an ephemeral Docker container or Seatbelt sandbox.
Never accepts shell commands from repository files.
"""
import ast
import importlib.util
import io
import json
import os
import py_compile
import resource
import sys
import time
import traceback
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

WORKSPACE = Path(os.getcwd()).resolve()
RESULT_PREFIX = "__NECRO_SANDBOX_RESULT__:"


def apply_resource_limits():
    """Apply defense-in-depth POSIX resource limits inside the child process."""
    limits = [
        (resource.RLIMIT_CPU, (8, 10)),
        (resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024)),  # 1 MB max file write
        (resource.RLIMIT_NOFILE, (64, 64)),
    ]
    # Memory limit: 256 MB address space (advisory on macOS ARM64, enforced on Linux)
    if hasattr(resource, "RLIMIT_AS"):
        limits.append((resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024)))
    for res, val in limits:
        try:
            soft_cur, hard_cur = resource.getrlimit(res)
            target_hard = val[1] if hard_cur == resource.RLIM_INFINITY else min(val[1], hard_cur)
            target_soft = min(val[0], target_hard)
            resource.setrlimit(res, (target_soft, target_hard))
        except Exception:
            pass


def discover_py_files():
    files = []
    for p in sorted(WORKSPACE.rglob("*.py")):
        if p.is_symlink():
            raise RuntimeError(f"Unsafe symlink encountered in workspace: {p.name}")
        rel = p.relative_to(WORKSPACE).as_posix()
        files.append((rel, p))
    return files


def is_test_file(rel_path: str) -> bool:
    name = Path(rel_path).name.lower()
    parts = [s.lower() for s in Path(rel_path).parts]
    return name.startswith("test_") or name.endswith("_test.py") or "tests" in parts or "test" in parts


def compile_all_python(py_files):
    syntax_errors = []
    for rel, path in py_files:
        try:
            py_compile.compile(str(path), doraise=True)
        except py_compile.PyCompileError as exc:
            syntax_errors.append({
                "file": rel,
                "message": str(exc.msg),
            })
        except Exception as exc:
            syntax_errors.append({
                "file": rel,
                "message": f"{type(exc).__name__}: {exc}",
            })
    return syntax_errors


def discover_test_symbols(py_files):
    unittest_files = []
    pytest_style_files = []
    discovered = []

    for rel, path in py_files:
        if not is_test_file(rel):
            continue
        src = path.read_text(encoding="utf-8", errors="replace")
        has_unittest_case = False
        plain_test_funcs = []
        try:
            tree = ast.parse(src)
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    for base in node.bases:
                        base_src = ast.unparse(base) if hasattr(ast, "unparse") else ""
                        if "TestCase" in base_src:
                            has_unittest_case = True
                elif isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                    # Top-level test function check
                    if node in getattr(tree, "body", []):
                        plain_test_funcs.append(node.name)
                        discovered.append(f"{rel}::{node.name}")
        except SyntaxError:
            continue

        if has_unittest_case:
            unittest_files.append(rel)
        if plain_test_funcs and not has_unittest_case:
            pytest_style_files.append((rel, path, plain_test_funcs))

    return unittest_files, pytest_style_files, discovered


def run_unittest_suite():
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=str(WORKSPACE), pattern="test*.py", top_level_dir=str(WORKSPACE))
    # Also load *_test.py files
    for p in sorted(WORKSPACE.rglob("*_test.py")):
        if not p.is_symlink():
            rel_mod = p.relative_to(WORKSPACE).with_suffix("").as_posix().replace("/", ".")
            try:
                suite.addTests(loader.loadTestsFromName(rel_mod))
            except Exception:
                pass

    stream = io.StringIO()
    runner = unittest.TextTestRunner(stream=stream, verbosity=2)
    result = runner.run(suite)

    failures = []
    for test, trace in result.failures + result.errors:
        failures.append({
            "test": str(test),
            "trace": trace[-1500:],
        })

    return {
        "total": result.testsRun,
        "failed": len(result.failures) + len(result.errors),
        "skipped": len(result.skipped),
        "passed": max(0, result.testsRun - len(result.failures) - len(result.errors) - len(result.skipped)),
        "failures": failures,
        "output": stream.getvalue(),
    }


def run_plain_test_functions(pytest_style_files):
    total = 0
    passed = 0
    failed = 0
    skipped = 0
    failures = []
    logs = []

    if str(WORKSPACE) not in sys.path:
        sys.path.insert(0, str(WORKSPACE))

    for rel, path, func_names in pytest_style_files:
        spec = importlib.util.spec_from_file_location(f"necro_test_{total}", str(path))
        if spec is None or spec.loader is None:
            continue
        mod = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(mod)
        except Exception:
            for fn in func_names:
                total += 1
                failed += 1
                failures.append({"test": f"{rel}::{fn}", "trace": traceback.format_exc()[-1500:]})
            continue

        for fn in func_names:
            total += 1
            callable_fn = getattr(mod, fn, None)
            if not callable(callable_fn):
                failed += 1
                failures.append({"test": f"{rel}::{fn}", "trace": "Test symbol is not callable."})
                continue
            buf_out, buf_err = io.StringIO(), io.StringIO()
            try:
                with redirect_stdout(buf_out), redirect_stderr(buf_err):
                    callable_fn()
                passed += 1
                logs.append(f"PASS {rel}::{fn}")
            except Exception:
                failed += 1
                failures.append({
                    "test": f"{rel}::{fn}",
                    "trace": traceback.format_exc()[-1500:],
                })
                logs.append(f"FAIL {rel}::{fn}")

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "failures": failures,
        "output": "\n".join(logs),
    }


def main():
    t0 = time.monotonic()
    apply_resource_limits()

    try:
        py_files = discover_py_files()
    except Exception as exc:
        payload = {
            "status": "FAILED",
            "syntaxValid": False,
            "syntaxErrors": [{"file": "(workspace)", "message": str(exc)}],
            "totalTests": 0,
            "passedTests": 0,
            "failedTests": 0,
            "skippedTests": 0,
            "failures": [],
            "durationMs": int((time.monotonic() - t0) * 1000),
            "exitCode": 2,
            "runner": "py_compile+unittest",
            "logs": str(exc),
        }
        print(RESULT_PREFIX + json.dumps(payload))
        sys.exit(2)

    syntax_errors = compile_all_python(py_files)
    if syntax_errors:
        payload = {
            "status": "FAILED",
            "syntaxValid": False,
            "syntaxErrors": syntax_errors,
            "totalTests": 0,
            "passedTests": 0,
            "failedTests": 0,
            "skippedTests": 0,
            "failures": [],
            "durationMs": int((time.monotonic() - t0) * 1000),
            "exitCode": 1,
            "runner": "py_compile",
            "logs": "Python compilation failed.",
        }
        print(RESULT_PREFIX + json.dumps(payload))
        sys.exit(1)

    unittest_files, pytest_style_files, discovered = discover_test_symbols(py_files)

    if not unittest_files and not pytest_style_files:
        payload = {
            "status": "NO_TESTS_FOUND",
            "syntaxValid": True,
            "syntaxErrors": [],
            "totalTests": 0,
            "passedTests": 0,
            "failedTests": 0,
            "skippedTests": 0,
            "failures": [],
            "durationMs": int((time.monotonic() - t0) * 1000),
            "exitCode": 0,
            "runner": "py_compile",
            "logs": "Compilation succeeded. No runnable unittest or pytest test functions found.",
        }
        print(RESULT_PREFIX + json.dumps(payload))
        sys.exit(0)

    total = 0
    passed = 0
    failed = 0
    skipped = 0
    failures = []
    combined_logs = []

    if unittest_files or Path(WORKSPACE / "tests").exists():
        ut_res = run_unittest_suite()
        total += ut_res["total"]
        passed += ut_res["passed"]
        failed += ut_res["failed"]
        skipped += ut_res["skipped"]
        failures.extend(ut_res["failures"])
        if ut_res["output"]:
            combined_logs.append(ut_res["output"])

    if pytest_style_files:
        pt_res = run_plain_test_functions(pytest_style_files)
        total += pt_res["total"]
        passed += pt_res["passed"]
        failed += pt_res["failed"]
        skipped += pt_res["skipped"]
        failures.extend(pt_res["failures"])
        if pt_res["output"]:
            combined_logs.append(pt_res["output"])

    if total == 0:
        status = "NO_TESTS_FOUND"
        exit_code = 0
    elif failed == 0 and passed > 0:
        status = "PASSED"
        exit_code = 0
    elif passed > 0 and failed > 0:
        status = "PARTIAL"
        exit_code = 1
    else:
        status = "FAILED"
        exit_code = 1

    payload = {
        "status": status,
        "syntaxValid": True,
        "syntaxErrors": [],
        "totalTests": total,
        "passedTests": passed,
        "failedTests": failed,
        "skippedTests": skipped,
        "failures": failures,
        "durationMs": int((time.monotonic() - t0) * 1000),
        "exitCode": exit_code,
        "runner": "python3.12 (py_compile+unittest+function_harness)",
        "logs": "\n".join(combined_logs)[-8000:],
    }
    print(RESULT_PREFIX + json.dumps(payload))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
