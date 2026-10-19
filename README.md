# PrivyJobs

买工作流、私有通道与专有数据——**不是**又一个模型或 LLM 壳。

**买方（要租用的人）**贴出任务 → 平台按**卖方（有工作流的人）**声明的工作流 / 数据域匹配 → 私下澄清并交付 → 积分托管结算。

静态演示站（GitHub Pages）。顶栏可切换买方 / 卖方身份；首页「演示走一遍」引导 下单 → 澄清 → 交付 → 验收。

演示规则：锁定后 7 日未交付可退回；验收失败一次可要求返工，二次失败退回。

## 本地预览

```bash
python3 -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

## 展廊可下载样例

- `showcase/files/normalize_invoice_schema.py` — 发票 CSV schema 映射短脚本
- `showcase/files/invoice-schema-memo.md` — 对应备忘

## License

MIT
