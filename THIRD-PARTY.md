# THIRD-PARTY / 许可

## 词库（重要）

`words.js` 来自 `word-demo/words.js`，原始数据：

- 来源：exam-data/CETVocabulary（四六级大纲词频库，5,278 条）
- 许可：**CC BY-NC-SA 4.0**
- 允许：非商业使用、署名、相同方式共享
- **禁止：商业使用**（收费、广告、商业发行、商业课程等）

如果这个原型要商业化，必须：
1. 换成可商用的词库（自建、购买授权、或使用许可兼容的开源词典）；
2. 或者向原始数据方取得商业授权。

本项目只做玩法/美术验证，不构成法律意见。

## 字体

| 字体 | 文件 | 许可 | 来源 |
|---|---|---|---|
| Press Start 2P | `assets/fonts/PressStart2P.ttf` | SIL Open Font License 1.1 | Google Fonts / The Press Start 2P Project Authors |
| Ark Pixel 12px Prop zh-Hans | `assets/fonts/ArkPixel12.woff2` | SIL Open Font License 1.1 | TakWolf/ark-pixel-font |

OFL 全文见 `assets/fonts/OFL-PressStart2P.txt` 与 `assets/fonts/OFL-ArkPixel.txt`。
OFL 允许网页嵌入与商业使用；保留版权声明即可。

## 美术

`assets/forge-bg.png`、`cat-*.png`、`ic-anvil.png`、`ic-skill-*.png` 由 `dev/make_assets.py` 与 `dev/make_skill_icons.py` 程序化绘制，为本原型原创占位资产。

- 没有使用任何外部游戏截图、商业素材包、Pinterest/Google 图片。
- `art/refs/` 里的 Steam 截图只用于内部分析，**不在本游戏目录内，也不随游戏发布**。
- 如果后续用 AI 生成替换图，请保留工具订阅凭证、提示词记录和生成日期。

## 音频

- `assets/audio/forge-loop.wav`：**原创合成 BGM**，由 `dev/make_bgm.py` 用 numpy 生成。
  - 90 BPM、D 小调、21.33 秒无缝循环；铁砧/锤击/低音 drone/蒸汽。
  - 不包含任何第三方采样、循环包或版权音乐。
  - 许可：随本原型自由使用/修改。
- 音效：全部由 `game.js` 的 Web Audio 振荡器/噪声实时合成，无音频文件。
- 后续替换为 CC0 / 已授权音频时，请在本文件登记来源、作者、许可、下载日期。

## 参考游戏（仅美术方向，未使用其素材）

- Balatro（LocalThunk / Playstack）
- Luck be a Landlord（TrampolineTales）
- Dungeon Clawler（Stray Fawn Studio）
- Backpack Hero（Jaspel）
- Baba Is You（Hempuli）
- Stacklands（Sokpop Collective）
- Alphabetron（thirtysmooth）

只参考了像素密度、配色比例、卡牌层级和反馈节奏，没有复制具体角色、卡面、图标或 UI 图形。


