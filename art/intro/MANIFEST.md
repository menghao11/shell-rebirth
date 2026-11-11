# 《弹壳轮回》开机动画美术 / Boot intro art

11 keys / 93 frames. Strict verify (`art_src/intro_fixes_verify.py`): pass=True, errors=[].

## MANIFEST

| key | frames | canvas | anchor | fps | loop | file |
|---|---:|---|---|---:|---|---|
| intro_logo | 1 | [1600, 640] | [800, 320] | - | False | `intro/logo/intro_logo.png` |
| intro_logo_shine | 16 | [1600, 640] | [800, 320] | 24 | False | `intro/logo/intro_logo_shine_sheet.png` |
| intro_shell_spin | 12 | [256, 256] | [128, 128] | 20 | True | `intro/shell/intro_shell_spin_sheet.png` |
| intro_shell_rest | 1 | [256, 256] | [128, 128] | - | False | `intro/shell/intro_shell_rest.png` |
| intro_flash | 8 | [512, 512] | [256, 256] | 24 | False | `intro/fx/intro_flash_sheet.png` |
| intro_glint | 8 | [128, 128] | [64, 64] | 20 | False | `intro/fx/intro_glint_sheet.png` |
| intro_steam_burst | 14 | [512, 512] | [256, 480] | 16 | False | `intro/fx/intro_steam_burst_sheet.png` |
| intro_steam_loop | 12 | [512, 512] | [256, 480] | 12 | True | `intro/fx/intro_steam_loop_sheet.png` |
| intro_pod_blink | 4 | [640, 640] | [320, 610] | 4 | True | `intro/pod/intro_pod_blink_sheet.png` |
| intro_pod_open | 16 | [640, 640] | [320, 610] | 12 | False | `intro/pod/intro_pod_open_sheet.png` |
| intro_title_bg | 1 | [1920, 1080] | [0, 0] | - | False | `intro/bg/intro_title_bg.png` |

## 分镜对应 / storyboard hookup (4–6 s)

1. 0.0–1.0 s 黑屏：`intro_pod_blink` 循环（指示灯闪烁，配心跳/电子音）。
2. 1.0–2.4 s `intro_pod_open`（12 fps 一次，末帧保持）：第 04 帧开锁 → 叠 `intro_flash`；第 05 帧起 `intro_steam_burst`，之后可接 `intro_steam_loop`。弹壳由代码生成：`intro_shell_spin` 播放 + 代码做下落/弹跳位移，落地叠 `intro_glint`（叮当声）。
3. 2.4–4.0 s 弹壳飞向 Logo 位置后淡出，`intro_logo` 出现（可缩放弹入），接 `intro_logo_shine`（24 fps 一次，金属反光），结束停在 `intro_logo`。
4. 「点击开始」是 UI 文本（游戏代码绘制），背景 `intro_title_bg`。

预览：`art/intro/intro_storyboard.gif` 只是美术合成示意，不是游戏场景录屏。

## 规格 / contracts

- 同组同画布同锚点：pod_blink + pod_open 640×640 @(320,610)（底座贴地）；shell_spin + shell_rest 256×256 @(128,128)（弹壳面积中心=锚点，可直接绕锚点旋转）；logo + logo_shine 1600×640 @(800,320)；steam_burst + steam_loop 512×512 @(256,480)（喷口）；flash 512×512 中心；glint 128×128 中心；title_bg 1920×1080 不透明（逻辑 960×540 × DPR2）。
- 实测：舱体接地最大偏移 1.0 px、跨帧范围 0.0 px（≤2）；弹壳旋转中心偏差 0.59 px；logo_shine 全程 alpha 轮廓与 intro_logo 完全一致。
- 透明：主体精灵无品红/紫边、无远处半透明雾；特效、蒸汽和 Logo 投影是有意的柔和 alpha（manifest 标记 intentional_soft_alpha）。flash 建议 ADD 混合。
- 中文字形：Logo 用 NotoSansCJK SC Bold 排版 + 程序化黄铜/枪铁倒角、深色描边和投影，副标题 Black Ops One；不是模型生成字，「弹壳轮回」「SHELL REBIRTH」已目视核对。

## 制作方式 / provenance

- 2026-11-11 Grok 恢复后升级（同 key、同画布、同锚点，游戏无需改动）：
  - intro_title_bg：专属关键图，`intro_fixes_generate.py intro/raw/title_bg`（grok-imagine-image）生成 2816×1584 → 1920×1080，Logo 区（上中部）压暗 + 轻暗角，不透明。
  - intro_pod_open / intro_pod_blink：先生成专属闭门回响舱 `intro/raw/echo_pod_closed.png`（品红抠像），再用 `art_src/intro_pod_video.py`（sprite-gen video-set，grok-imagine-video-1.5 图生视频，once-hold）拍摄双开装甲门开启，73 帧抠像中取 16 帧（源帧 0,8,16,22,26,29,32,35,38,41,44,47,50,54,58,72），统一缩放 0.66 + 单一刚性偏移；视频底座逐帧像素级稳定。pod_blink = 视频首帧 + 舱体自身青色灯带逐帧压暗/提亮（1/0.15/1.3/0.05），open 00–03 沿用同样灯光节奏，04 帧 1px 横向开锁抖动。
  - intro_shell_spin / intro_shell_rest：改为 3D 翻滚（`intro_shell3d.py` 正交光线步进旋转体弹壳，绕倾斜轴每帧 30°，可见底火端面与开口内腔），三阶卡通明暗、固定左上光源，逐帧按 alpha 质心对齐锚点。
  - 其余（logo/shine、flash/glint/steam）保持确定性制作：Logo 为字体排版，特效为程序化卡通。
- 旧版代码制作版本保留为后备：`INTRO_FALLBACK=1 python art_src/intro_build.py` 重建（舱门逐列旋转 rig、基地背景合成、平面旋转弹壳）。


## 弱点

- 舱门视频的两扇门板在开启过程中略有形变（视频模型插值），末帧门板外开后舱体总宽 ≈455px（仍在 640 画布内，不贴边）。
- 门内人形剪影由视频模型生成，是剪影而非角色本体；如需与主角形象一致，可在游戏内叠角色出场。
- 标题背景是生成图：地面弹壳和道具为模型绘制，非精确与基地场景一一对应；Logo 区已压暗但背景细节较多，Logo 投影需保留。
- 3D 弹壳是程序渲染，风格比手绘略“CG”，但与平面版同色同描边。
- 未在游戏/手机上测试；首帧加载体积：logo/shine 帧 1600×640 共 17 张、pod 20 张 640²，建议游戏王用 tools/build_web_art.py 一类流程生成缩小版本。

## 构建顺序

`… stage2_boss_build.py → fixes_build.py → stage2_verify.py → stage2_delivery.py → stage2_boss_delivery.py → intro_build.py → intro_fixes_verify.py → intro_fixes_delivery.py`。游戏代码未改动；未发布。
