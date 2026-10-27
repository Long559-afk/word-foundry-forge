# 部署 · 拾字工坊 · 熔炉模式

> **已上线：<https://long559-afk.github.io/word-foundry-forge/>**
>
> GitHub 仓库：<https://github.com/Long559-afk/word-foundry-forge>
>
> 纯静态站点，无后端、无构建、无第三方请求；桌面 Chrome / Edge 1280×720 以上。

---

## 当前部署方式：GitHub Pages

- 站点源：本目录的运行文件（`index.html` / `style.css` / `game.js` / `words.js` / `assets/`）。
- 托管：GitHub Pages，分支 `main`，根目录发布。
- 更新：把新文件提交到 `main`，Pages 会自动重新发布（通常 30–90 秒）。

### 更新步骤

```bash
# 在本地像素版目录改完后，同步到部署目录
# 然后：
cd pixel-foundry-site
git add .
git commit -m "update"
git push
```

线上地址不变。刷新时加 `?v=2` 可以绕过浏览器缓存看一眼。

---

## 备选：Netlify Drop（国内访问更稳时可换）

GitHub Pages 的 `*.github.io` 在部分网络环境下会慢或打不开。如果朋友反馈打不开：

1. 打开 <https://app.netlify.com/drop> 并登录（只有部署者需要登录）。
2. 把 **`pixel-foundry.zip`** 或 `pixel-foundry-site/` 文件夹拖进去。
3. 等 10–30 秒，得到 `https://<随机名>.netlify.app`，把这个链接发给朋友。
4. 以后更新：Netlify → Sites → 你的站点 → Deploys → 底部拖放区，拖新文件夹；**不要**重新 Drop 新建站点，否则网址会变。

> 不要只拖 `index.html`；要拖整个文件夹（含 `assets/`、`words.js`）。

---

## 上线后 30 秒自检

- [ ] 标题页：背景、猫、按钮都出现。
- [ ] 点「开始锻造」→ 抽 15 张牌、出现技能牌。
- [ ] 选字母 → 锻造成功；有铁砧音效。
- [ ] 点右上「结束回合」→ 抽 5 张、回合 +1。
- [ ] 技能牌：透视 / 重铸 / 熔毁 / 点石成字 各用一次。
- [ ] 技能满 5 张后结束回合 → 出现「技能牌已满」弹窗。
- [ ] 点 `♫` 有 BGM（浏览器要求先点击一次页面）。
- [ ] 刷新后最高分还在（localStorage）。
- [ ] 控制台没有红色报错。

---

## 已知边界

- 无后端：最高分只存在玩家自己的浏览器。
- 无分析/埋点：页面不向第三方发请求。
- 词库：CC BY-NC-SA 4.0，**仅限非商业**；公开免费试玩可以，商业化前必须换库。
- BGM：原创合成 `assets/audio/forge-loop.wav`，不依赖外部版权音乐。
- 手机端未适配；建议桌面或横屏平板。
