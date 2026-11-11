# 晴空卡丁车 · Sunshine Kart

一款复古卡通风格的 3D 网页卡丁车游戏。沿着 685 米的海湾环道跑计时赛，漂移蓄氮，挑战最佳单圈。游戏在浏览器里保存成绩，内置的原创配乐由 Web Audio 合成。

[打开网页版试玩](https://shaeler.github.io/sunshine-kart/)

## 本地试玩

在仓库根目录运行下面的命令，然后打开 [http://localhost:8000](http://localhost:8000)。需要支持 WebGL 2 的浏览器。游戏文件和 Three.js 都随仓库提供，无需安装 npm 依赖。

```sh
python3 -m http.server 8000
```

| 操作 | 按键 |
| --- | --- |
| 发车 | Enter |
| 油门、刹车、转向 | 方向键或 WASD |
| 漂移 | 转向时按住 Shift |
| 氮气加速 | 氮气蓄满后按 Space |
| 暂停 | Esc |
| 开关声音 | M |

触屏设备可以用屏幕下方的按键驾驶。倒数结束后开始播放配乐。

## 源码

- `game.js` 处理输入、比赛流程、仪表盘和最佳圈记录。
- `physics.js` 定义赛道、车辆操控、漂移、氮气和圈数判定。
- `world.js` 绘制 3D 场景、卡丁车、跟车镜头和小地图。
- `music.js` 合成配乐、引擎声和比赛音效。

## 许可证

游戏源码使用 [MIT 许可证](LICENSE)。随附的 [Three.js](https://threejs.org/) 使用其 [MIT 许可证](vendor/three-LICENSE.txt)。
