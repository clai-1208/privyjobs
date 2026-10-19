#!/usr/bin/env python3
"""PrivyJobs showcase — short CSV invoice schema mapper.

Maps mixed CN/EN invoice headers to a fixed schema.
Unmapped columns land in _unmapped. No network calls.

Usage:
  python3 normalize_invoice_schema.py              # runs built-in sample
  python3 normalize_invoice_schema.py invoices.csv
  cat invoices.csv | python3 normalize_invoice_schema.py -
"""
from __future__ import annotations

import csv
import io
import json
import sys
from typing import Any

SCHEMA = (
    "invoice_date",
    "vendor",
    "amount_incl_tax",
    "currency",
    "invoice_no",
)

SYNONYMS = {
    "invoice_date": ["开票日期", "Invoice Date", "date", "开票日"],
    "vendor": ["供应商", "Vendor", "seller", "销方名称"],
    "amount_incl_tax": ["价税合计", "Amount(税后)", "total_with_tax", "合计"],
    "currency": ["币种", "Currency", "币别"],
    "invoice_no": ["发票号码", "Invoice No", "发票号", "number"],
}

SAMPLE = """开票日期,供应商,价税合计,币种,发票号码,备注
2026-09-01,华科纸业,1280.00,CNY,FP-1001,月结
2026-09-03,North Ink Ltd,420.50,USD,INV-88,
"""


def map_field(raw: str) -> str | None:
    key = raw.strip().lower()
    for canonical, aliases in SYNONYMS.items():
        if key in {a.lower() for a in aliases} or key == canonical:
            return canonical
    return None


def normalize_row(headers: list[str], row: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {k: None for k in SCHEMA}
    unmapped: dict[str, str] = {}
    for h in headers:
        val = (row.get(h) or "").strip()
        canon = map_field(h)
        if canon:
            out[canon] = val or None
        elif val:
            unmapped[h] = val
    out["_unmapped"] = unmapped
    return out


def normalize_csv(text: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []
    headers = list(reader.fieldnames)
    return [normalize_row(headers, row) for row in reader]


def load_text() -> str:
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "-":
            return sys.stdin.read()
        with open(arg, encoding="utf-8") as f:
            return f.read()
    return SAMPLE


def main() -> int:
    rows = normalize_csv(load_text())
    json.dump(rows, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
