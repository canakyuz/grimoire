"""Structural guard over the GitHub Actions workflows: a job that can read a
repository secret must not also check out another repository's moving branch.

Code from such a checkout runs (the community add-on contract tests execute
the add-ons' scripts), so it would run alongside the secret. A job that needs
both pins the checkout to a full commit SHA, which is a reviewed snapshot.
"""
import pathlib
import re
from typing import Any

import pytest
import yaml

WORKFLOWS = pathlib.Path(__file__).resolve().parents[2] / ".github" / "workflows"

_SHA = re.compile(r"^[0-9a-f]{40}$")
_SECRET = re.compile(r"\bsecrets\s*\.")
_SAME_REPO = {"${{ github.repository }}"}


def _workflows() -> list[pathlib.Path]:
    return sorted([*WORKFLOWS.glob("*.yml"), *WORKFLOWS.glob("*.yaml")])


def _external_checkouts(job: dict[str, Any]) -> list[dict[str, Any]]:
    """The `with:` blocks of the job's actions/checkout steps that name another repo."""
    found = []
    for step in job.get("steps") or []:
        if not str(step.get("uses", "")).startswith("actions/checkout@"):
            continue
        with_ = step.get("with") or {}
        repo = with_.get("repository")
        if repo and str(repo).strip() not in _SAME_REPO:
            found.append(with_)
    return found


def _violations(workflow: dict[str, Any]) -> list[str]:
    """Jobs that reference a secret and check out an external repo without a pinned SHA."""
    bad = []
    for name, job in (workflow.get("jobs") or {}).items():
        if not _SECRET.search(yaml.safe_dump(job)):
            continue
        for checkout in _external_checkouts(job):
            if not _SHA.match(str(checkout.get("ref", ""))):
                bad.append(f"{name}: {checkout.get('repository')} @ {checkout.get('ref')!r}")
    return bad


def _load(path: pathlib.Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def test_workflows_found():
    assert _workflows(), f"no workflows under {WORKFLOWS}"


@pytest.mark.parametrize("path", _workflows(), ids=lambda p: p.name)
def test_no_secret_job_checks_out_an_unpinned_external_repo(path):
    assert _violations(_load(path)) == []


def test_community_addons_checkout_is_pinned():
    """The add-on contract tests run third-party scripts: their checkout is pinned
    whatever the job holds, and the jobs that run them see no secret."""
    ci = _load(WORKFLOWS / "ci.yml")
    pinned = 0
    for name, job in ci["jobs"].items():
        for checkout in _external_checkouts(job):
            assert _SHA.match(str(checkout.get("ref", ""))), name
            assert not _SECRET.search(yaml.safe_dump(job)), name
            pinned += 1
    assert pinned >= 1


def test_only_the_badge_job_holds_a_secret():
    ci = _load(WORKFLOWS / "ci.yml")
    holders = {n for n, job in ci["jobs"].items() if _SECRET.search(yaml.safe_dump(job))}
    assert holders == {"coverage-badges"}
    badges = ci["jobs"]["coverage-badges"]
    assert badges["permissions"] == {}
    assert not any(
        str(step.get("uses", "")).startswith("actions/checkout@") for step in badges["steps"]
    )


@pytest.mark.parametrize(
    "ref, ok",
    [
        (None, False),
        ("main", False),
        ("v1.2.3", False),
        ("0c97dc5d", False),
        ("0c97dc5d6eab7317f29f99ae40bdd21b2494a1ba", True),
    ],
)
def test_the_check_catches_an_unpinned_checkout(ref, ok):
    with_: dict[str, Any] = {"repository": "someone/else"}
    if ref is not None:
        with_["ref"] = ref
    workflow = {
        "jobs": {
            "j": {
                "steps": [
                    {"uses": "actions/checkout@abc", "with": with_},
                    {"run": "echo", "env": {"T": "${{ secrets.TOKEN }}"}},
                ]
            }
        }
    }
    assert (_violations(workflow) == []) is ok


def test_same_repo_checkout_and_secretless_jobs_pass():
    workflow = {
        "jobs": {
            "same": {
                "steps": [
                    {"uses": "actions/checkout@abc", "with": {"repository": "${{ github.repository }}"}},
                    {"run": "echo ${{ secrets.T }}"},
                ]
            },
            "nosecret": {
                "steps": [{"uses": "actions/checkout@abc", "with": {"repository": "a/b"}}],
            },
        }
    }
    assert _violations(workflow) == []
