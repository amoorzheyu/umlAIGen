# UML AI Generator

通过自然语言描述生成 PlantUML 图表。基于 Qwen 模型，支持时序图、类图、活动图、用例图、状态图等多种 UML 类型。

## 功能特性

- **自然语言生成**：输入文字描述，AI 生成可直接渲染的 PlantUML 源码
- **图类型提示**：支持指定时序图、类图、活动图等，或由模型自动判断
- **参考资源**：可上传图片或文档作为参考，模型会抽取要点辅助生成
- **预览与代码**：双 Tab 展示渲染结果与源码，支持放大预览、复制、下载
- **语法错误自动修复**：当 PlantUML 渲染失败（400）时，自动根据报错截图调用 AI 修复，最多尝试 5 次
- **历史记录**：本地 IndexedDB 缓存，可查看、复用以往生成

## 技术栈

- Next.js 15
- React 18
- Tailwind CSS
- Framer Motion
- Phosphor Icons

## 环境要求

- Node.js 18+
- Qwen 兼容的 Chat Completions API（如 OpenAI 格式）。可选用 [共绩算力](https://console.suanli.cn/) 的 Qwen3.5-9B 预制镜像
- PlantUML 图片服务（用于将源码转为 PNG）

## 快速开始

```bash
# 安装依赖
pnpm install

# 复制环境变量示例
cp .env.local.example .env.local

# 编辑 .env.local 填入配置

# 开发模式
pnpm dev
```

浏览器打开 `http://localhost:3000` 即可使用。

## 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| QWEN_API_BASE_URL | Qwen/OpenAI 兼容 API 地址；共绩算力预制镜像部署后填入其提供的接口地址 | `http://localhost:8000/v1` |
| QWEN_MODEL | 模型名称；共绩算力 Qwen3.5-9B 预制镜像对应 `Qwen/Qwen3.5-9B` | `Qwen/Qwen3.5-9B` |
| QWEN_API_KEY | API 密钥（如需要） | `none` 或实际密钥 |
| PLANTUML_PNG_BASE_URL | PlantUML PNG 服务地址 | `https://localhost:8001/plantuml/png` |
| PLANTUML_SVG_BASE_URL | PlantUML SVG 服务地址 | `https://localhost:8001/plantuml/svg` |
| UMLAIGEN_STORE_OUTPUT | 是否将 .wsd 文件写入 output/ | `false` 或 `true` |

## 项目结构

```
app/
  api/
    generate/    # 流式生成 PlantUML
    fix-uml/     # 根据报错截图修复语法
    image-base64 # 将 PlantUML 图片转为 base64 缓存
    history/     # 历史记录（依赖 output/）
components/
  MainApp        # 主应用
  InputPanel     # 输入区、图类型、参考上传
  PreviewPanel   # 预览 Tab、代码 Tab、修复按钮
  ImagePreviewModal
  HistoryList
lib/
  qwen          # Qwen API 调用（生成、修复、参考抽取）
  plantuml      # PlantUML URL 编码
  umlAIGenIdb   # IndexedDB 历史
```

## API 说明

- `POST /api/generate`：接收描述、图类型、参考文件，流式返回 PlantUML 代码
- `POST /api/fix-uml`：接收 umlCode 与报错截图的 dataUrl，返回修复后的代码
- `POST /api/image-base64`：将 PlantUML 远程图片转为 base64；若 PlantUML 返回 400 且响应为有效 PNG，会以 400 状态返回 dataUrl 供前端使用
- `GET /api/history`：读取 output/ 下的 .wsd 文件作为历史（需开启 UMLAIGEN_STORE_OUTPUT）

## 构建与部署

```bash
pnpm build
pnpm start
```

部署时需配置所有环境变量，并确保后端可访问 Qwen API 与 PlantUML 服务。
