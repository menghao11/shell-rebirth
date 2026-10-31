# 弹壳轮回 · Shell Rebirth — 第一关「废弃前线」Demo

俯视角 Roguelike 射击小游戏的第一关可玩 Demo（Phaser 3，纯静态网页，桌面与 iPhone Safari 均可玩）。

**在线游玩：** https://menghao11.github.io/shell-rebirth/

## 操作
| | 桌面 | iPhone（横屏） |
|---|---|---|
| 移动 | WASD / 方向键 | 左半屏浮动摇杆 |
| 瞄准 + 射击 | 鼠标瞄准，按住左键 | 右半屏摇杆：拖动即瞄准并自动连射 |
| 冲刺 | 空格 / Shift | 「冲刺」 |
| 手雷 | Q（朝鼠标） | 「手雷」 |
| 换弹 / 切枪 | R / 1 2 F | 「换弹」「切枪」 |
| 交谈 / 互动 | E | 「交谈/互动」（靠近时出现） |
| 设置（音乐/音效音量） | 右上「设置」 | 同 |

流程：基地「铁皮屋」→ 5 个房间（战斗、人质、军火商/休息站）→ Boss「铁砧」→ 结算 → 回基地。进度（废铁、死亡次数、装甲）存在浏览器 localStorage。
首次点击/按键后才有声音（iOS 音频解锁）。网址参数：`?touch=1` / `?touch=0` 强制触屏/键鼠。

## 目录
- `game/` 游戏代码（`src/`）、Phaser（`vendor/`）、网页版美术 `assets/art_web/`
- `art/manifest.json` 美术清单（动画帧、锚点、帧率）
- `audio/` 音效与 BGM（mp3）；`story/story.json` 剧情台词
- 各资源目录里的 `index.html` 是文件清单（GitHub Pages 没有目录列表，加载器靠它发现资源）

## 署名与许可
- 引擎：[Phaser 3](https://phaser.io)，© Photon Storm Ltd.，MIT 许可（`game/vendor/phaser.min.js`）
- 音效：全部为本项目程序化合成（numpy/scipy/sox），未使用第三方采样
- 音乐：本项目原创，使用 FluidR3_GM SoundFont（MIT 许可）经 FluidSynth 渲染。详见 `audio/MANIFEST.md`
- 美术：本项目生成制作的角色/场景素材（网页版为缩小后的 256 色版本）
