# 发票字段映射备忘（展廊可下载样例）

- 目标 schema：`invoice_date` / `vendor` / `amount_incl_tax` / `currency` / `invoice_no`
- 未识别列写入 `_unmapped`，不静默丢弃
- 脚本：`normalize_invoice_schema.py`（无网络依赖）

```bash
python3 normalize_invoice_schema.py your.csv
```
