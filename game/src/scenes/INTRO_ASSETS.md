# 开机动画素材槽 · Intro asset slots

画图王的 `art/intro/`（11 键）和声音王的 `audio/intro/` 都已接到游戏里。运行时优先加载缩小后的 web 副本 `game/assets/intro/`（整包约 807 KB：Logo 宽 800，标题背景 960×540 JPEG，开舱序列约 258 KB），避免首屏拉源文件。画图王会按同一键/尺寸/锚点替换源图并重建 web 副本；本地再用 `tools/build_web_intro.py` 也可重做。

## 画图王 `art/intro/`（已到）

同组必须保持相同画布和锚点。`intro_title_bg` 与 `intro_pod_open` 后续还会按**同一键、同一尺寸、同一锚点**替换，所以导入流程是可重复脚本：

```
python3 tools/build_web_intro.py
```

脚本会按 `art/intro/manifest.json` 重新切帧、缩放到手机友好的尺寸（Logo 宽 ≤ 1024，标题背景压成 960×540 JPEG）、打 src_sig，写到 `game/assets/intro/`。

### 重建顺序

画图王侧（见 `art/intro/MANIFEST.md`）：

`stage2_boss_build.py` → `fixes_build.py` → `stage2_verify.py` → `stage2_delivery.py` → `stage2_boss_delivery.py` → `intro_build.py` → `intro_fixes_verify.py` → `intro_fixes_delivery.py` → **`tools/build_web_intro.py`**

如果重新跑了 `art_src/finalize.py`，必须再跑一遍 `art_src/fixes_build.py`，然后再做 intro 的 delivery / web 构建，否则后面的键可能是旧的。

| 逻辑键 | 帧 | 源画布 / 锚点 | fps | 说明 |
| --- | ---:| --- | ---:| --- |
| `intro_logo` | 1 | 1600×640 @(800,320) | — | 「弹壳轮回」+ SHELL REBIRTH |
| `intro_logo_shine` | 16 | 同上 | 24 | 金属反光一次，结束停在 `intro_logo` |
| `intro_pod_blink` | 4 | 640×640 @(320,610) | 4 循环 | 闭舱指示灯（视频首帧+灯带闪），对齐心跳 0 / 0.65 / 1.30 s |
| `intro_pod_open` | 16 | 同上 | 12 一次 | 1.70 s 开舱（视频取帧）；第 04 帧开锁叠 `intro_flash`，第 05 帧起蒸汽；第 15 帧保持 |
| `intro_shell_spin` | 12 | 256×256 @(128,128) | 20 循环 | 3D 翻滚（动画本身绕锚点，代码只做位移）；落地切 `intro_shell_rest` 并叠 `intro_glint` |
| `intro_shell_rest` | 1 | 同上 | — | 落地静帧 |
| `intro_steam_burst` | 14 | 512×512 @(256,480) | 16 一次 | 开舱蒸汽 |
| `intro_steam_loop` | 12 | 同上 | 12 循环 | 爆发后的残留蒸汽 |
| `intro_flash` | 8 | 512×512 @(256,256) | 24 | ADD 混合；开锁 / Logo 重音 |
| `intro_glint` | 8 | 128×128 @(64,64) | 20 | 弹壳落地星芒 |
| `intro_title_bg` | 1 | 1920×1080 @(0,0) | — | 不透明标题关键图（偏满、中央有开舱），5.5 s 淡入；Logo 背后加一层暗阴影保证字可读 |

分镜已改到与 `intro_full` 的 cue 对齐（心跳 0/0.65/1.30，开舱 1.70，弹壳 2.50–3.58，Logo 4.00 / 反光 4.18，结束 5.50）。`art/intro/intro_storyboard.gif` 只是美术示意，不是游戏录屏，未打进仓库。

## 声音王 `audio/intro/`（已到）

真实文件已接上，键名单即文件名。完整首次播放用预混 `intro_full.mp3`（5.500 s），画面分镜按下面的 cue 对齐。短版回访不用预混，改点播单独 SFX。`bgm_title.mp3` 在开机动画开始之后再懒加载（约 481 KB），不挡首次进场。

| 逻辑键 / 文件名 | 时长 | 音量 | 用法 |
| --- | --- | --- | --- |
| `intro_full.mp3` | 5.500 s（文件约 5.538 s，含编码器填充） | 1.0 | 首次完整播放，只播一遍，可跳过；跳过时 200–300 ms 淡出 |
| `pulse_heartbeat.mp3` | 0.366 s | 0.7–0.9 | 短版；预混里在 0.00 / 0.65 / 1.30 s |
| `hatch_hiss.mp3` | 1.489 s | 0.9 | 短版；预混里在 1.70 s 开舱 |
| `casing_clink_1.mp3` | 0.470 s | 0.85–1.0 | 短版（偏亮）；预混：2.50 / 3.04 / 3.58 s |
| `casing_clink_2.mp3` | 0.418 s | 0.85–1.0 | 短版（偏暗、带回弹）；预混：2.78 / 3.30 s |
| `logo_hit.mp3` | 1.489 s | 1.0 | 短版；预混从 4.00 s 开始，重音约 4.18 s |
| `bgm_title.mp3` | 30.041 s，精确循环 **30.000 s** | 0.5–0.6 | 5.5 s 结束出现「点击开始」时开始循环，进入铁皮屋后继续 |

`manifest.json` 可选；没有的话按文件名直接加载。格式为 44.1 kHz MP3（SFX 单声道约 112 kbps，预混和 BGM 128 kbps joint-stereo）。

### `intro_full` 分镜（t = 0 为第一帧）

| 时间 | 画面 |
| --- | --- |
| 0.00 / 0.65 / 1.30 s | 黑屏，回响舱指示灯闪三次（第三次稍强） |
| 1.70 s | 舱门打开，蒸汽散开 |
| 2.50 / 2.78 / 3.04 / 3.30 / 3.58 s | 五枚弹壳落地 |
| 4.00 s | 弹壳收成 Logo「弹壳轮回」/ SHELL REBIRTH；约 4.18 s 金属反光 |
| 5.50 s | 动画结束，出现「点击开始」，开始 `bgm_title` |

## 行为备忘

- 本地缓存键：`dankelunhui_intro_v1`。第一次完整播放 5.5 秒后停在「点击开始」；之后再进播约 1.25 秒短版并自动进入铁皮屋。点击、触屏、任意键都会跳过（`intro_full` 先淡出约 250 ms）。
- 主游戏素材在动画播放期间加载；进度画在回响舱外圈。跳过时若还没载完，会停在 Logo 等到 `DK.ready` 再进铁皮屋。
- iOS / 自动播放被拦时：画面仍按 cue 走。声音只能在一次用户手势之后开始。第一次点按既会解锁音频，也会按跳过逻辑进入标题（并在解锁后开始 `bgm_title`）。若自动播放成功，则在 0 秒准时播 `intro_full`。
- 测试可调用 `DK.skipBootIntro()`，或预先写入上述 localStorage 键。


## 隐私模式与慢网

- 所有 `localStorage` 读写都走 `DK.storeGet` / `DK.storeSet`（`data.js`）。存储被拦截时视为首次访问，音量等设置用内存里的默认值（音乐 0.8、音效 0.9），`finish()` 在音频实例为空时仍会进入铁皮屋。
- 跳过监听在 `window`/`document` 上还有 `pointerdown` / `touchstart`（passive），点到画布外的黑边也能跳过；`skip()` / `finish()` 只进一次基地。
- 页面一打开就用纯 CSS 显示「弹壳轮回」和细进度环（`#boot-splash`，无大图）。`MainLoad` 场景与 Intro 的开机包并行下载主资源，不再等开机包装完才开始拉主包。
