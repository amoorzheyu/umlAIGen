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
4. 每条语句使用换行分隔；每个动作语句必须以分号结尾（包含 :动作; 以及其他语句）
5. 禁止输出多余字符（空白以外），禁止输出 @startuml 之前/@enduml 之后的内容
6. 标点符号必须使用半角 ASCII：分号用 ; 不能用中文全角 ；；括号、逗号等也用英文半角

图类型选择（根据描述自动选择）：
- 流程 / 业务流程 → 活动图（activity diagram）
- 类 / 对象关系 → 类图（class diagram）
- 时序 / 交互 → 时序图（sequence diagram）
- 用例 / 功能 → 用例图（use case diagram）
- 状态转换 → 状态图（state diagram）
- 组件 / 部署 → 组件图 / 部署图

【关键】图表类型语法不可混用（违反将导致渲染失败）：
- PlantUML 根据首次出现的语法推断图表类型；一旦确定，后续语法必须与之匹配
- participant、actor、boundary 等仅用于时序图，且必须出现在顶层；禁止出现在 package { } 内部
- package "..." { } 用于类图/组件图时，内部只能是 class、[Component]、interface 等结构元素，不能是 participant
- 时序图如需分组，使用 box "..." { participant ... } 或 participant 直接罗列，绝不用 package 包裹 participant
- 组件图（package、[Component]、-->）禁止使用任何控制流语法，包括：
  if/then/else/endif（活动图）、alt/opt/loop/else/endif（时序图）、start、stop、:动作;
- 活动图专用的 if/then/else/endif 仅能在活动图中使用
- 时序图专用的 alt/opt/loop/else/endif 仅在 participant 语境下使用时序图中使用
- 结构类语法（package、[Component]）不能在活动图或时序图控制流中混用
- 若需同时展示「结构关系」与「条件分支」，应选用其一：用 note 描述分支逻辑，或拆成两张图分别绘制

活动图（activity diagram）语法硬约束（必须遵循，否则渲染会失败）：
- start/stop 必须作为独立行出现：start, stop
- :动作; 中的分号必须是英文半角 ; 不能是中文全角 ；否则渲染失败
- 条件分支的 if 必须使用 then/else 模式，且 then/else 必须显式存在。
- 正确模板如下（模型必须在 if/else 处完全遵循该结构）：
  if (条件) then (是)
    :动作;
  else (否)
    :动作;
  endif
- 不得把 'yes'/'no' 当作普通动作行放在 if (...) 下面；不得省略 then/else；不得省略 endif
- 嵌套 if 也必须严格使用同样 then/else/endif 结构

组件图 / 部署图（component diagram）语法硬约束：
- 一旦使用 package 或 [Component]，整图只能有 --> 箭头与 note，绝不能出现 if/then/else/endif
- 禁止在组件图中使用 autonumber（autonumber 仅用于时序图，会强制推断为 sequence 导致 package 报错）
- 仅使用 package、[Component] as 别名、--> 箭头、note 等结构语法
- 绝对禁止使用以下控制流语法：if/then/else/endif、alt/opt/loop/else/endif、start、stop、:动作;
- 条件或分支逻辑必须用 note right of X / note left of X 或 note on link 标注，严禁用 if、alt、opt、loop
- note 内容只能是纯文本，绝不能含 if/then/else/endif、:动作; 等活动图语法；条件用自然语言描述，如「有上下文则传文本，否则传文件」
- package 内部只能是 [Component]、class、interface、database 等结构元素，禁止写 participant

时序图（sequence diagram）语法硬约束：
- participant、actor、boundary 等必须出现在顶层（或 box 内部），绝不能写在 package { } 内
- autonumber 仅用于时序图；若使用 package、[Component] 画组件图，严禁写 autonumber
- 若需按模块分组，使用 box "模块名" ... end box 包裹 participant，不得用 package 包裹 participant
- 类图/组件图的 package 与时序图的 participant 属于不同图类型，不可混用

【禁止的错误示例】以下写法会导致 "Assumed diagram type: class/component/sequence" 语法错误，严禁生成：
  错误1：package "Frontend" { participant MainApp }
  错误2：autonumber 后接 package 或 [Component]（autonumber 仅用于时序图，会令 package 报错）
  错误3：在 package、[Component] 定义的组件图后使用 if/then/else/endif 或 note 后接 if/:动作;
  错误示例：note right of InputPanel : Logic\n  if (Has Context?) then (Yes)\n    : Upload Text;\n  else (No)\n    : Upload File;\n  endif
  正确（组件图+条件说明）：note 内仅用纯文本，例如：
    note right of InputPanel : 有参考上下文则仅传文本，否则上传文件
  正确（组件图）：package "Frontend" { [MainApp] as MainApp }
  正确（时序图）：box "Frontend"
    participant MainApp
    participant InputPanel
  end box

标注语言：
- 标注语言与用户描述语言保持一致（中文描述则用中文标注）

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
  // PlantUML 要求半角分号，将中文全角 ； 替换为英文半角 ;
  content = content.replace(/；/g, ";");

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

const EXTRACT_IMAGE_SYSTEM_PROMPT = `你是 UML 参考资料分析助手。

任务：从用户上传的“参考图片”中抽取与 UML 生成最相关的信息（尽量包含：实体/角色、对象关系、流程步骤、状态/条件、关键名词）。

输出规则（必须遵守）：
1. 只输出“结构化要点文本”，不要输出解释、不要输出 markdown 标题。
2. 使用中文，并以固定字段开头，字段之间用换行分隔：
   - 实体/角色：
   - 关系/流程：
   - 状态/条件（如有）：
3. 内容尽量简洁，长度建议 <= 1000 个汉字。`;

const EXTRACT_FILE_SYSTEM_PROMPT = `你是 UML 参考资料分析助手。

任务：从用户上传的“参考文档文本”中抽取与 UML 生成最相关的信息（尽量包含：实体/角色、对象关系、流程步骤、状态/条件、关键名词、约束）。

输出规则（必须遵守）：
1. 只输出“结构化要点文本”，不要输出解释、不要输出 markdown 标题。
2. 使用中文，并以固定字段开头，字段之间用换行分隔：
   - 实体/角色：
   - 关系/流程：
   - 状态/条件（如有）：
   - 关键约束/术语：
3. 内容尽量简洁，长度建议 <= 1200 个汉字。`;

function sanitizeExtractionText(text: string): string {
  // 避免模型输出多余 code fence
  return text
    .replace(/```(?:text|md|markdown)?/gi, "")
    .replace(/```/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

async function callChatCompletion(params: {
  messages: Array<{ role: string; content: any }>;
  max_tokens?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const url = getChatUrl();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: params.messages,
      temperature: 0.2,
      max_tokens: params.max_tokens ?? 1024,
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Qwen API ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  return sanitizeExtractionText(content);
}

export async function extractContextFromImage(params: {
  dataUrl: string;
  hint: string;
  description: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { dataUrl, hint, description, signal } = params;

  const userText = `图类型提示（可用于更准确抽取）：${hint}\n用户描述：${description}\n\n请从图片中抽取 UML 相关要点，按固定字段输出。`;

  return await callChatCompletion({
    signal,
    messages: [
      { role: "system", content: EXTRACT_IMAGE_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 1024,
  });
}

export async function extractContextFromFileText(params: {
  fileText: string;
  filename: string;
  hint: string;
  description: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { fileText, filename, hint, description, signal } = params;

  const userText = `文件名：${filename}\n图类型提示（可用于更准确抽取）：${hint}\n用户描述：${description}\n\n以下是参考文档内容，请抽取 UML 相关要点（按固定字段输出）：\n\n${fileText}`;

  return await callChatCompletion({
    signal,
    messages: [
      { role: "system", content: EXTRACT_FILE_SYSTEM_PROMPT },
      { role: "user", content: userText },
    ],
    max_tokens: 1024,
  });
}
