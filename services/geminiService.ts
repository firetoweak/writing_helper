import { PromptsConfig } from "../types"; // 确保导入了类型定义

// ... const BASE_URL = ""; 

// ✅ 补回丢失的 DEFAULT_PROMPTS
export const DEFAULT_PROMPTS: PromptsConfig = {
  outline_gen: `请为一篇关于"{{TOPIC}}"的专业文章/论文创建一个结构化大纲。

### **产品立项书撰写规范与要求**

#### **一、 总体原则**
* **核心逻辑**：立项工作需围绕“市场机会/威胁”驱动，通过严谨的分析论证产品的商业价值 。
* **证据导向**：所有价值设定、痛点分析及市场空间预测，严禁纸上谈兵，必须基于真实的客户求证和广泛的市场调研 。
* **量化描述**：关键客户价值、技术挑战及财务指标需有带约束边界的量化描述，避免模糊定性 。

---

#### **二、 分章节撰写要求**

##### **1. 市场分析：机会与威胁**
本章节需从宏观趋势到微观场景，论证“为什么要做”以及“市场在哪里”。

* **宏观市场全景**：
    * 从行业、区域、竞争三个维度分析市场规模（TAM/SAM）、增长率（CAGR）及主要玩家份额 。
    * 识别宏观层面的普遍客户痛点、市场机会点或潜在威胁 。
* **场景化痛点验证**：
    * **深度还原**：走进客户，还原具体应用场景，确认痛点是否真实存在及其根因 。
    * **普遍性求证**：通过访谈多位客户，推演痛点在行业中的普遍程度，并记录“受访企业-场景-痛点-预期”对应表 。
* **可触达市场空间**：
    * 基于验证后的痛点和场景，重新评估产品理论上能参与竞争的真实市场空间（非单纯销售目标） 。
    * 明确是基于机会切入还是构建防御点 。

##### **2. 产品价值与组合策略**
本章节需界定“不仅解决问题，还要如何赢”的策略。

* **产品组合策略**：
    * 审视产品是否独立解决问题。若不能，需制定多产品或系列化组合策略，并明确当前立项产品在组合中的位置 。
    * 若已有产品战略，需说明是保持不变还是进行刷新 。
* **客户价值设定**：
    * **量化价值**：提出带有约束边界的量化价值描述，直接支撑收入目标的达成 。
    * **关键假设**：明确为实现价值所需的在市场、技术、产品特性上的关键假设（必赢之战） 。
* **价值求证**：
    * 展示与目标客户进行价值求证的结果，确保设定与客户期望一致，并预测成交可能性 。

##### **3. 产品定义与包需求**
本章节需以“成交”为导向，定义具体的产品形态与特性。

* **锁定早期突破客户**：
    * 圈定典型目标客户作为“假想敌”，以能完成早期销售突破为原则定义特性 。
* **全价值链痛点分析**：
    * 不仅关注功能，需覆盖采购、运维、升级、TCO等全价值链条。分析采购决策链中不同角色的关注点及竞品满足度 。
    * 挖掘痛点背后的根本原因与技术挑战 。
* **形态与特性定义**：
    * 基于全价值链痛点进行优先级排序，定义产品形态及关键特性 。
    * 特性描述需量化，并与竞品进行10分制对标 。
* **目标价格与成本**：
    * 根据典型应用场景设定目标价格与目标成本（BOM+制造+服务） 。
* **早期求证**：
    * 携带特性、价格走向早期客户进行“预成交”求证，预测早期及全生命周期的销售目标 。

##### **4. 执行策略**
本章节需阐述“如何做出来”及“如何上市”。

* **技术可行性**：
    * 绘制关键技术点地图，评估行业成熟度与自身掌握度，制定应对策略 。
* **里程碑计划**：
    * 规划Charter、CDCP、PDCP、GA及TR1-6的全周期里程碑 。
    * 明确与其他产品（升级/协同）及平台版本（配套开发）的时间依赖关系图 。
* **团队与风险**：
    * 确立PDT经理、SE、开发、市场等核心骨干（明白人）及其责权利 。
    * 识别商业计划中的重大风险并制定应对措施 。

##### **5. 投资收益分析**
本章节需用财务数据量化“投入产出比”。

* **预算评估**：
    * 呈现新产品研发预算及目标成本达成情况（含BOM、制费、质保） 。
* **损益预测（P&L）**：
    * 预测全生命周期的订单额、收入、成本、毛利（含硬件与配套） 。
    * 输出项目利润表（收入、研发投入、销售费用、贡献利润等），计算ROI、盈亏平衡点及回收期 。
    * 建议提供正常、悲观、乐观三种场景的预测 。

---

#### **三、 写作检查清单**
在提交前，请自查是否满足以下关键点：
1.  **一致性**：宏观机会、微观痛点与产品价值设定是否逻辑闭环？
2.  **真实性**：是否有具体的客户访谈记录和数据支撑，而非主观臆断？
3.  **可执行性**：技术挑战是否有解？里程碑是否合理？
4.  **商业性**：ROI计算是否清晰？能否支撑立项决策？

  项目构想（Concept）：
  {{CONCEPT}}

  参考材料摘要：
  {{MATERIALS}}

  {{CONSTRAINTS}}

  要求：
  1. 生成一级标题（Level 1）作为主要章节。
  2. 为每个一级标题生成 2-3 个二级标题（Level 2）。
  3. **重要**：写作要点（writingPoints）必须挂载在二级标题（Level 2）下，而不是一级标题。
  4. 必须严格只返回JSON数组，不要包含Markdown代码块。

  格式示例：
  [
    {
      "title": "第一章 引言",
      "level": 1,
      "children": [
         { 
           "title": "1.1 研究背景", 
           "level": 2,
           "writingPoints": [{ "text": "...", "subPoints": [] }]
         }
      ]
    }
  ]`,

  content_gen: `请撰写文章的一个小节。
章节标题："{{TITLE}}"。
上下文/前文摘要："{{CONTEXT}}"。
写作风格：{{STYLE}}。

本小节核心写作要点（必须覆盖）：
{{POINTS}}

请直接返回Markdown格式的正文内容，使用中文。`,

  review_gen: `请对以下文章章节进行深度评审。
章节标题："{{TITLE}}"
核心要点（需验证是否达成）：
{{POINTS}}

请返回一个严格的 JSON 对象（不要Markdown标记），包含：
1. "score": (0-100) 评分。
2. "summary": (string) 简短的评审摘要（100字以内）。
3. "todos": (string[]) 一个包含3-5条具体的修改待办事项（To-Do List）的数组。

待评审文本：
{{CONTENT}}`,

  rewrite_gen: `请根据以下要求重写或修改文本。

原文本：
{{CONTENT}}

修改引导/要求：
{{GUIDANCE}}

本章核心写作要点（需保持一致）：
{{POINTS}}

参考补充资料：
{{MATERIALS}}

请直接返回修改后的Markdown文本，不要包含开场白。`
};

// 如果配置了 Vite Proxy，留空；否则填 
const BASE_URL = ""; 

// 通用请求封装
const postRequest = async (endpoint: string, body: any) => {
  try {
    const res = await fetch(`${BASE_URL}/api/writing${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error(`Call ${endpoint} failed:`, err);
    throw err;
  }
};

const postStream = async (endpoint: string, body: any, onChunk?: (text: string) => void) => {
  try {
    const res = await fetch(`${BASE_URL}/api/writing${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.body) return "";

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      
      // 如果前端传了回调，就实时通知
      if (onChunk) {
        onChunk(fullText); // 注意：这里传的是累积的全文，因为前端 setGeneratedContent 通常是直接设置 value
        // 如果你的前端逻辑是 append，这里就只传 chunk。
        // 根据 WriterInterface 逻辑：setGeneratedContent(chunk) -> <textarea value={generatedContent} />
        // 这意味着 state 保存的是全文。所以我们这里要传 accumulated text (fullText) 或者让 setGeneratedContent 做拼接。
        // 但通常 setGeneratedContent(val) 是直接替换。
        // 修正：WriterInterface 里 setGeneratedContent(chunk) 看起来是直接设置。
        // 实际上，如果后端流式返回 chunks，前端 state 应该是 setContent(prev => prev + chunk)。
        // 但你的 WriterInterface 是 setGeneratedContent(chunk)。
        // 既然无法改前端，那我们这里必须做策略：
        // 策略 A: 传 fullText 给它。这样 setGeneratedContent(fullText) 正确显示进度。
      }
    }
    return fullText;
  } catch (err) {
    console.error(`Stream ${endpoint} failed:`, err);
    if(onChunk) onChunk(`Error: ${(err as Error).message}`);
    return "";
  }
};


// --- 基础配置 (保留空函数以防报错) ---
export const setAIConfig = (baseUrl: string, apiKey: string, model: string) => {
  console.log("Config ignored: Backend handles keys now.");
};

// ================= 核心生成 =================

export const generateOutline = async (topic: string, requirements: string) => {
  return postRequest("/outline", { topic, requirements });
};

export const generateOutlineFromMaterials = async (
  topic: string, concept: string, materialsSummary: string, expertLevel1Titles: string[] = [], customPromptTemplate?: string
) => {
  return postRequest("/outline/from-materials", { topic, concept, materialsSummary, expertLevel1Titles, customPromptTemplate });
};

export const generateArticle = async (outline: string, requirements: string) => {
  return postRequest("/generate", { outline, requirements });
};

export const fetchAutoWriteQuestions = async (
  sectionTitle: string,
  writingPoints: any[] = [],
  materials?: string
) => {
  return postRequest("/auto-write/questions", {
    sectionTitle,
    writingPoints,
    materials: materials || "",
  });
};

export const fetchAutoWriteNextQuestion = async (
  sectionTitle: string,
  writingPoints: any[] = [],
  materials: string = "",
  history: { role: string; text: string }[] = [],
) => {
  return postRequest("/auto-write/next-question", {
    sectionTitle,
    writingPoints,
    materials,
    history,
  });
};

// 流式生成
export const generateArticleStream = async (outline: string, requirements: string, onChunk: (text: string) => void) => {
  try {
    const res = await fetch(`${BASE_URL}/api/writing/generate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outline, requirements }),
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // 适配 data: 前缀 (如果后端返回 SSE) 或直接文本
      const lines = chunk.split('\n');
      for (const line of lines) {
         if (line.startsWith('data: ')) onChunk(line.slice(6));
         else if (line.trim()) onChunk(line); // 兼容纯文本流
      }
    }
  } catch (err) { console.error(err); onChunk("Error stream"); }
};

export const generateChunkContent = async (sectionTitle: string, context: string, style: string, writingPoints: any[] = [], customPromptTemplate?: string, onUpdate?: (chunk: string) => void) => {
  return postStream("/generate/chunk", { sectionTitle, context, style, writingPoints, customPromptTemplate }, onUpdate);
};

export const generateSubSectionTemplate = async (title: string, points: any[], onUpdate?: (chunk: string) => void) => {
  return postStream("/generate/template", { title, points });
};

// ================= 编辑与润色 =================

export const polishContent = async (content: string, onUpdate?: (chunk: string) => void) => {
  return postStream("/polish", { content }, onUpdate);
};

export const rewriteWithRequirements = async (content: string, requirements: string, onUpdate?: (chunk: string) => void) => {
  return postStream("/rewrite", { content, requirements }, onUpdate);
};

export const rewriteWithGuidance = async (currentContent: string, guidance: string, materials: string, writingPoints: any[] = []) => {
  return postRequest("/rewrite/guidance", { currentContent, guidance, materials, writingPoints });
};

export const generateSmartEdit = async (selection: string, instruction: string, type: 'rewrite' | 'continue', onUpdate?: (chunk: string) => void) => {
  return postStream("/smart-edit", { selection, instruction, type }, onUpdate);
};

export const generateContinuation = async (sectionTitle: string, precedingText: string, onUpdate?: (chunk: string) => void) => {
  return postStream("/continue", { sectionTitle, precedingText }, onUpdate);
};

export const generateMergePolish = async (currentContent: string, chatMessages: any[], onUpdate?: (chunk: string) => void) => {
  return postStream("/merge-polish", { currentContent, chatMessages }, onUpdate);
};

export const generatePartialMerge = async (originalText: string, chatMessages: any[], onUpdate?: (chunk: string) => void) => {
  return postStream("/partial-merge", { originalText, chatMessages }, onUpdate);
};

export const generateSelectionWithReferences = async (originalText: string, chatMessages: any[], instruction: string, onUpdate?: (chunk: string) => void) => {
  return postStream("/selection-ref", { originalText, chatMessages, instruction }, onUpdate);
};

// ================= 评审与指导 =================

export const reviewArticle = async (content: string) => {
  return postRequest("/review", { content });
};

export const reviewChunk = async (sectionTitle: string, content: string, writingPoints: any[] = []) => {
  return postRequest("/review/chunk", { sectionTitle, content, writingPoints });
};

export const generateFullReview = async (outline: any[]) => {
  return postRequest("/review/full", { outline });
};

export const applyReviewSuggestions = async (content: string, suggestions: string[]) => {
  return postRequest("/review/apply", { content, suggestions });
};

export const generateToDoFix = async (todo: string, content: string, onUpdate?: (chunk: string) => void) => {
  return postStream("/fix-todo", { todo, content }, onUpdate);
};

export const generateGlobalWritingGuide = async (topic: string, concept: string, materials: string, outline: any[]) => {
  return postRequest("/guide/global", { topic, concept, materials, outline });
};

export const generateContextualGuidance = async (title: string, content: string) => {
  return postRequest("/guide/contextual", { title, content });
};

// ================= 助手与辅助 =================

export const queryAssistant = async (query: string, currentContent: string, references: any[] = [], onUpdate?: (chunk: string) => void) => {
  return postStream("/chat", { query, context: currentContent, references }, onUpdate); // 注意参数映射
};

export const generateDetailedInfo = async (topic: string, context: string, onUpdate?: (chunk: string) => void) => {
  return postStream("/detailed-info", { topic, context }, onUpdate);
};

export const generateFollowUpSuggestions = async (context: string, topic: string) => {
  return postRequest("/suggestions", { context, topic });
};

export const generateWritingPoints = async (title: string, materials: string) => {
  return postRequest("/points", { title, materials });
};

export const generateMoreWritingPoints = async (currentPoints: any[], content: string) => {
  return postRequest("/points/more", { currentPoints, content });
};

export const generateRelatedQueries = async (content: string) => {
  return postRequest("/related-queries", { content });
};