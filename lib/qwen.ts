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

任务：根据用户的自然语言描述，生成符合规范的 PlantUML 代码。

输出规则：
1. 只输出纯 PlantUML 代码，禁止包含任何解释文字或 Markdown 格式（不要用代码块包裹）
2. 代码必须以 @startuml 开始，以 @enduml 结束
3. 根据描述自动选择最合适的图类型：
   - 流程 / 业务流程 → 活动图（activity diagram）
   - 类 / 对象关系 → 类图（class diagram）
   - 时序 / 交互 → 时序图（sequence diagram）
   - 用例 / 功能 → 用例图（use case diagram）
   - 状态转换 → 状态图（state diagram）
   - 组件 / 部署 → 组件图 / 部署图
4. 标注语言与用户描述语言保持一致（中文描述则用中文标注）
5. 确保语法正确，结构清晰，添加必要的注释`;

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
  let content: string =
    data.choices?.[0]?.message?.content ?? "";

  // Strip accidental markdown fences
  content = content
    .replace(/```(?:plantuml|uml|puml)?\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // If model wrapped content in extra text, extract the @startuml...@enduml block
  const match = content.match(/@startuml[\s\S]*?@enduml/i);
  if (match) {
    content = match[0];
  }

  if (!content.toLowerCase().startsWith("@startuml")) {
    throw new Error(
      "模型返回的内容不是有效的 PlantUML 代码，请重试或调整描述"
    );
  }

  return content;
}
