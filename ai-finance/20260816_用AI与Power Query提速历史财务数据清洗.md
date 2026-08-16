---
title: 用 AI + Power Query 把历史财务数据清洗提速 10 倍
date: 2026-08-16
category: IPO实务
tags: [Power Query, DAX, 数据治理, AI提效, IPO]
---

# 用 AI + Power Query 把历史财务数据清洗提速 10 倍

> 这是「AI + 财务纪实」的第一篇。不堆概念，只记录一个 ==真实发生过== 的小闭环：IPO 申报要梳理三年一期历史财务数据，科目口径乱、手工对账慢，我用 AI 辅助写 Power Query(M) 和 DAX，把最枯燥的一段清洗自动化了。文中金额为 ==示例数据==，替换成真实数即可复用。

## 背景：IPO 申报的"历史数据债"

申报材料要求收入、成本、费用按 ==统一科目口径== 重述三年一期。问题很具体：

- 旧账套科目名称不统一（"主营业务收入" vs "营业收入" vs "销售收入"）；
- 部分明细挂在错的总账科目下；
- 币种、单位（元/万元）混用。

手工改 Excel 容易错，且 ==不可复算==。我决定用 Power Query 做一次性映射管道，AI 负责把"人话需求"翻成 M 代码。

## AI 帮我写 Power Query(M) 做科目映射

我把需求用自然语言告诉 AI："把 source 里 name 含'收入'且不含'其他'的行，统一归到'营业收入'；币种为 USD 的乘以当月汇率。" 它给出的 M 片段，我改了字段名后直接用：

```m
let
    Source = Excel.CurrentWorkbook(){[Name="Raw"]}[Content],
    // 统一科目口径：含"收入"且不含"其他" → 营业收入
    MapSubject = Table.AddColumn(
        Source,
        "科目",
        each if Text.Contains([明细], "收入") and not Text.Contains([明细], "其他")
             then "营业收入"
             else [原科目]
    ),
    // 币种折算：USD → 本位币（示例汇率 7.2）
    ToLocal = Table.AddColumn(
        MapSubject,
        "本位币金额",
        each if [币种] = "USD" then [金额] * 7.2 else [金额]
    )
in
    ToLocal
```

注意 `each` / `if … then … else` 是 M 的关键字，高亮后一眼能看出结构。 ==关键点==：映射规则要写成可复算的管道，而不是覆盖原单元格。

## 用 DAX 算"营收同比"——一个会被反复用到的度量值

清洗完进入数据模型，第一步就是同比。营收同比增长率的数学定义（用 $R_t$ 表示本期营收、$R_{t-1}$ 表示上年同期营收）：

$$
\text{Revenue YoY} = \frac{R_t - R_{t-1}}{R_{t-1}} \times 100\%
$$

毛利率同理（记营业收入为 $R$、营业成本为 $C$）：

$$
\text{Gross Margin} = \frac{R - C}{R} \times 100\%
$$

对应的 DAX 度量值（代码块，便于复制）：

```text
营收同比 % =
DIVIDE (
    [本期营收] - [上年同期营收],
    [上年同期营收]
)
```

`DIVIDE` 自带除零保护，比直接写 `/` 稳。这个公式会被月度、季度、年度报告反复引用， ==沉淀成模型里的标准度量== 最划算。

## 顺手用 Python 做了一致性校验

Power Query 跑完，我用一段 Python 校验借贷是否平衡、各期合计是否对得上，避免"看着干净其实漏行"：

```python
import pandas as pd

df = pd.read_excel("cleaned.xlsx")
# 借贷平衡校验
assert abs(df["借方"].sum() - df["贷方"].sum()) < 1e-6, "借贷不平衡"

# 各期营收合计，肉眼核对申报数
pivot = df.pivot_table(index="会计期间", values="本位币金额", aggfunc="sum")
print(pivot)
```

跑通即代表管道可复算——下次数据更新，==重跑一遍就行==，不重复劳动。

## 反思：AI 是杠杆，判断还是人

AI 写得快，但 ==映射口径必须由我定==：哪些"收入"算主营业务、汇率取哪天、单位怎么统一，这些判断权不能外包。AI 把"写代码"的时间压缩了，省下的时间我用来想"口径对不对"。

慢即是快。工具越强，越要把 ==判断留在自己手里==。

---

*下一篇预告：用影刀 RPA 自动抓取银行流水并落库，接金蝶云星空。*
