const BASE_URL = process.env.QWEN_API_BASE_URL ?? "http://localhost:8000/v1";
const MODEL_NAME = process.env.QWEN_MODEL ?? "Qwen/Qwen3.5-9B";
const API_KEY = process.env.QWEN_API_KEY ?? "none";

function getChatUrl(): string {
  const base = BASE_URL.replace(/\/$/, "");
  return base.endsWith("/v1")
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`;
}

const SYSTEM_PROMPT = `你是一个专业的 UML 图表设计专家，精通 PlantUML 语法。

任务：根据用户的自然语言描述，生成“可直接渲染”的 PlantUML 源码。

强制输出规则（必须全部满足）：
1. 只输出纯 PlantUML 代码；禁止任何解释文字、标题、Markdown、代码块标记（不要使用 \`\`\` 包裹）
2. 代码必须严格以“单独一行”的 @startuml 开始，以“单独一行”的 @enduml 结束
3. 不允许出现关键字粘连：例如不得生成类似 “title...start”“end...@enduml” 这种同一行拼接
4. 每条语句使用换行分隔；每个动作语句必须以分号 ';' 结尾（包含 :动作; 以及其他语句）
5. 禁止输出多余字符（空白以外），禁止输出 @startuml 之前/@enduml 之后的内容

图类型选择（根据描述自动选择）：
- 流程 / 业务流程 → 活动图（activity diagram）
- 类 / 对象关系 → 类图（class diagram）
- 时序 / 交互 → 时序图（sequence diagram）
- 用例 / 功能 → 用例图（use case diagram）
- 状态转换 → 状态图（state diagram）
- 组件 / 部署 → 组件图 / 部署图

活动图（activity diagram）语法硬约束（必须遵循，否则渲染会失败）：
- start/stop 必须作为独立行出现：start, stop
- 条件分支的 if 必须使用 then/else 模式，且 then/else 必须显式存在。
- 正确模板如下（模型必须在 if/else 处完全遵循该结构）：
  if (条件) then (是)
    :动作;
  else (否)
    :动作;
  endif
- 不得把 'yes'/'no' 当作普通动作行放在 if (...) 下面；不得省略 then/else；不得省略 endif
- 嵌套 if 也必须严格使用同样 then/else/endif 结构

标注语言：
4. 标注语言与用户描述语言保持一致（中文描述则用中文标注）

可选：添加必要注释，但不得破坏语法；注释必须独立成行（以单独行语法书写）。`;

export function stripMarkdownFences(text: string): string {
  return text
    .replace(/```(?:plantuml|uml|puml)?\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

export function extractPlantUMLBlock(text: string): string {
  const match = text.match(/@startuml[\s\S]*?@enduml/i);
  return match ? match[0] : text;
}

export function normalizePlantUMLFromModelOutput(raw: string): string {
  let content = stripMarkdownFences(raw);
  content = extractPlantUMLBlock(content);

  if (!content.toLowerCase().startsWith("@startuml")) {
    throw new Error(
      "模型返回的内容不是有效的 PlantUML 代码，请重试或调整描述"
    );
  }

  return content;
}

export async function generateUMLCode(description: string): Promise<string> {
  const url = getChatUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qwen API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  return normalizePlantUMLFromModelOutput(content);
}

export async function generateUMLCodeStream(
  description: string,
  onToken: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const url = getChatUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      chat_template_kwargs: { enable_thinking: false },
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qwen API ${response.status}: ${text.slice(0, 200)}`);
  }

  if (!response.body) {
    throw new Error("Qwen API 返回空 body，无法流式读取");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  let rawContent = "";
  let finished = false;

  const flushEvents = (eventText: string) => {
    // Expected OpenAI-compatible SSE:
    // data: {...}\n
    // data: {...}\n\n
    const lines = eventText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();

      if (dataStr === "[DONE]") {
        finished = true;
        return;
      }

      const json = JSON.parse(dataStr);
      const delta: string =
        json?.choices?.[0]?.delta?.content ?? "";

      if (delta) {
        rawContent += delta;
        onToken(delta);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    // SSE events are separated by a blank line.
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const eventText = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (!eventText.trim()) continue;

      flushEvents(eventText);
      if (finished) break;
    }

    if (finished) break;
  }

  return normalizePlantUMLFromModelOutput(rawContent);
}
