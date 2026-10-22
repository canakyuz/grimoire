"""The bounded YAML loader used for pasted, uploaded and downloaded YAML."""
import io
import json

import pytest
import yaml

from backend.services import untrusted_yaml
from backend.services.characters import documents
from backend.services.characters.documents import DocumentError, parse_document


class TestSafeLoad:
    def test_reads_ordinary_yaml(self):
        text = "name: Sheet\nfields:\n  hp: {type: number, default: 3}\nlist: [1, two]\n"
        assert untrusted_yaml.safe_load(text) == {
            "name": "Sheet",
            "fields": {"hp": {"type": "number", "default": 3}},
            "list": [1, "two"],
        }

    def test_reads_a_stream(self):
        assert untrusted_yaml.safe_load(io.StringIO("a: 1\n")) == {"a": 1}

    def test_an_anchor_without_an_alias_is_fine(self):
        assert untrusted_yaml.safe_load("a: &x 1\nb: 2\n") == {"a": 1, "b": 2}

    def test_refuses_an_alias(self):
        with pytest.raises(untrusted_yaml.UntrustedYAMLError, match="aliases"):
            untrusted_yaml.safe_load("a: &x [1, 2]\nb: *x\n")

    def test_refuses_a_merge_key_alias(self):
        with pytest.raises(yaml.YAMLError):
            untrusted_yaml.safe_load("base: &b {x: 1}\nchild:\n  <<: *b\n")

    def test_refuses_runaway_nesting_without_exhausting_the_stack(self):
        with pytest.raises(untrusted_yaml.UntrustedYAMLError, match="nested"):
            untrusted_yaml.safe_load("[" * 30000 + "]" * 30000)

    def test_nesting_up_to_the_limit_is_fine(self):
        depth = untrusted_yaml.MAX_DEPTH - 1
        parsed = untrusted_yaml.safe_load("[" * depth + "]" * depth)
        assert untrusted_yaml.too_deep(parsed) is False

    def test_errors_are_yaml_errors(self):
        assert issubclass(untrusted_yaml.UntrustedYAMLError, yaml.YAMLError)


class TestTooDeep:
    def test_scalars_and_shallow_values(self):
        assert untrusted_yaml.too_deep(5) is False
        assert untrusted_yaml.too_deep({"a": [{"b": 1}]}, limit=3) is False

    def test_deep_values(self):
        assert untrusted_yaml.too_deep({"a": [{"b": []}]}, limit=3) is True
        assert untrusted_yaml.too_deep(json.loads("[" * 500 + "]" * 500)) is True


class TestParseDocument:
    def test_deep_json_within_the_recursion_limit_is_refused(self):
        with pytest.raises(DocumentError, match="nested"):
            parse_document('{"a": ' + "[" * 500 + "]" * 500 + "}")

    def test_json_too_deep_to_parse_is_refused(self):
        with pytest.raises(DocumentError, match="nested"):
            parse_document("[" * 30000)

    def test_a_yaml_parser_recursion_error_is_refused(self, monkeypatch):
        def boom(_text):
            raise RecursionError

        monkeypatch.setattr(untrusted_yaml, "safe_load", boom)
        with pytest.raises(DocumentError, match="nested"):
            parse_document("a: [unclosed")

    def test_a_parsed_document_over_the_stored_cap_is_refused(self, monkeypatch):
        assert documents.MAX_PARSED_BYTES == 4 * documents.MAX_DOCUMENT_BYTES
        monkeypatch.setattr(documents, "MAX_PARSED_BYTES", 20)
        with pytest.raises(DocumentError, match="too large"):
            parse_document("name: a fairly long sheet name\n")
