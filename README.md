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

## 买方 AI API（mock）

- `docs/agent-api.html` — 买方 AI 接口草案（OpenAPI 风格）
- `docs/mock/*.json` — 静态 mock 响应，页面内可 fetch「试一下」
- `docs/mock/sellers.json` — 卖方目录（workflow / channel / data）；`js/main.js` fetch 加载，失败时回退内联目录

## 展廊可下载样例

- `showcase/files/normalize_invoice_schema.py` — 发票 CSV schema 映射短脚本
- `showcase/files/invoice-schema-memo.md` — 对应备忘


## 撮合（静态 demo）

下单后的卖方匹配在**浏览器端**完成：对照演示卖方技能域词 + 本机 `localStorage` 登记做 token 重叠打分；0 分则「待匹配」，不伪造卖方。真 API / 服务端撮合尚未上线。卖方页提供「试匹配」自测。

## License

MIT
