from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.schemas import *
from app.services.llm_service import call_llm, call_llm_stream
from app.config import CHAT_MODEL, REASONING_MODEL
import json
import re
# 确保安装了 pip install json_repair
from json_repair import repair_json

router = APIRouter(prefix="/api/writing", tags=["Writing"])

import time # 记得在文件头部 import time

AUTO_WRITE_SYSTEM_PROMPT = """# 基于事实锚定的动态访谈与写作专家 
## 1. 核心原则
你是一位严谨的商业分析师。你的工作是基于用户的输入指令进行**启发式访谈**，并依据访谈收集到的**真实信息**撰写文档。
**【最高指令 - 防幻觉机制】：**
*   **严禁捏造数据：** 正文中出现的任何数据（百分比、金额、时间参数等）、具体企业名称、引用语，必须严格来源于用户在 5 轮访谈中的回答。
*   **定性代替定量：** 如果用户只提供了定性描述（如“效率很低”），你在正文中只能写“效率显著低下”，**绝对不能**自动补全为“效率下降了 30%”。
*   **事实一致性：** 你的输出必须是用户回答的忠实映射，加上专业的逻辑润色，而非创造性的虚构。

## 2. 工作流程 

### 阶段一：指令解析与提问规划 (Parsing)
当用户输入一段包含 **[章节标题]**、**[二级要点]** 和 **[行动引导 Action Guide]** 的文本时：
1.  分析“行动引导”中的 Steps，确定需要从用户那里获取哪些**具体素材**（如：场景、痛点细节、具体数据证据、机会点）。
2.  规划 5 个问题，确保问题能覆盖所有 Steps 的要求。

### 阶段二：动态启发式访谈 
开启 5 轮对话。**严禁一次性问完。**

*   **提问策略：**
    *   **Q1-Q5 动态生成：** 根据用户输入的 Action Guide 逐步提问。
    *   **数据索取（关键）：** 如果 Action Guide 中包含“验证”、“数据报告”等要求，你必须在提问中显式询问用户：*“您手头是否有具体的统计数据（如百分比、金额）来支持这一观点？如果没有，我们将使用定性描述。”*
    *   **启发式引导：** 继续使用 A/B 选项或场景例子帮助用户思考，但引导语中涉及的数据必须声明为“例如”。

### 阶段三：正文撰写 
当用户回答完 Q5 后，基于收集到的信息撰写正文。

*   **写作规范：**
    *   **结构：** 使用用户输入的标题。
    *   **内容：** 将用户的回答串联成逻辑严密的商业分析。
    *   **数据处理：**
        *   若用户提供了数据（如“错误率50%”），请引用。
        *   若用户未提供数据，使用“据调研观察”、“行业普遍反馈”、“显著存在”等定性词汇，**严禁**编造“78%”、“TOP 5”等细节。

---

## 3. 示例：

**用户输入指令：**
> 行动引导：Step 3 开展普遍性验证，用户可选渠道：行业数据报告...

**AI 提问 (Q4)：**
> “根据引导，我们需要验证痛点的普遍性。请问您是否有具体的行业数据或调研样本数据来佐证这一点？（例如：具体的错误率数值、成本占比等）。**如果您暂时没有具体数字，请告知我，我将在文档中侧重于描述现象的普遍性而非具体量化指标。**”

**用户回答 (Q4)：**

> “具体数据没有，但是跟几个仓库经理聊，大家都说这个问题很严重，主要是这就导致了很多人离职。”

**AI 错误写法 (禁止)：**
> “调研显示，75% 的仓库面临严重问题，导致离职率上升 20%。” *(错误：编造数据)*

**AI 正确写法 (允许)：**
> “调研访谈显示，这一问题在行业内具有显著的普遍性。多位仓库管理人员反馈，该痛点不仅影响作业效率，更成为一线人员高流失率的关键诱因。” *(正确：忠实反映用户提供的“严重”和“导致离职”)*

---

## 4. 关键约束 
1.  你的知识库仅用于优化语言表达和逻辑连接，**不可用于补充具体的行业数据**（除非用户明确要求你使用你的内部知识库进行估算，并标记为“估算值”）。
2.   用户的回答是正文内容的唯一素材来源。
3. 每次只问一个问题。"""

def create_stream_response(model: str, prompt: str):
    """
    创建一个返回纯文本流的 StreamingResponse
    前端直接读取 raw bytes 即可
    """
    async def generator():
        # 调用你的 llm_service 的 stream 方法
        async for chunk in call_llm_stream(model, [{"role": "user", "content": prompt}]):
            # 直接 yield 文本片段，不加 'data: ' 前缀，方便前端直接展示
            yield chunk

    return StreamingResponse(generator(), media_type="text/plain")


@router.post("/auto-write/questions")
async def generate_auto_write_questions(req: AutoWriteQuestionsRequest):
    fallback_questions = [
        "请先说说这一小节你想呈现的核心论点或故事线？如果有具体场景，请一起描述。",
        "你的目标读者是谁？他们最关心的痛点或收益点是什么？",
        "为支撑这一节，你希望强调的关键论据、事实或步骤有哪些？",
        "是否有案例、数据或外部资料能支撑上述论据？如果没有，也请说明当前掌握的定性证据。",
        "最终希望呈现的语气和风格是什么？（如专业、鼓励、客观等）",
    ]

    points_str = "\n".join(
        [
            f"- {p.get('text', p) if isinstance(p, dict) else str(p)}"
            for p in req.writingPoints
        ]
    )

    context_parts = [f"章节标题：{req.sectionTitle}"]
    if points_str:
        context_parts.append(f"写作要点：\n{points_str}")
    if req.materials.strip():
        context_parts.append(f"参考资料：{req.materials[:800]}")

    prompt = (
        "你正在为一键代写收集素材，需要规划 5 条按顺序展开的访谈提问。"
        "严格遵循系统提示中的访谈规范，确保每个问题都围绕行动引导逐步索取关键信息。"
        "输出 JSON 数组：元素是按顺序的中文问题字符串，可附带 1-2 行引导示例（使用“例如：”或项目符号），不要编号或额外解释。"
        f"\n\n上下文信息：\n{chr(10).join(context_parts)}"
    )

    raw_result = await call_llm(
        REASONING_MODEL,
        [
            {"role": "system", "content": AUTO_WRITE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )
    questions = clean_and_parse_json(raw_result, default_value=[])

    normalized = []
    if isinstance(questions, list):
        for q in questions:
            if isinstance(q, str):
                text = q
            elif isinstance(q, dict):
                text = q.get("question") or q.get("q") or q.get("text") or str(q)
            else:
                text = str(q)
            if text and text.strip():
                normalized.append(text.strip())

    if not normalized:
        normalized = fallback_questions

    return {"result": normalized[:5]}


@router.post("/auto-write/next-question")
async def generate_auto_write_next_question(req: AutoWriteNextQuestionRequest):
    fallback_questions = [
        "请先说说这一小节你想呈现的核心论点或故事线？如果有具体场景，请一起描述。",
        "你的目标读者是谁？他们最关心的痛点或收益点是什么？",
        "为支撑这一节，你希望强调的关键论据、事实或步骤有哪些？",
        "是否有案例、数据或外部资料能支撑上述论据？如果没有，也请说明当前掌握的定性证据。",
        "最终希望呈现的语气和风格是什么？（如专业、鼓励、客观等）",
    ]

    points_str = "\n".join(
        [
            f"- {p.get('text', p) if isinstance(p, dict) else str(p)}"
            for p in req.writingPoints
        ]
    )

    context_parts = [f"章节标题：{req.sectionTitle}"]
    if points_str:
        context_parts.append(f"写作要点：\n{points_str}")
    if req.materials.strip():
        context_parts.append(f"参考资料：{req.materials[:800]}")

    dialog_lines = []
    question_index = 0
    for msg in req.history:
        if msg.role == "assistant":
            question_index += 1
            dialog_lines.append(f"Q{question_index}: {msg.text}")
        else:
            dialog_lines.append(f"A{question_index}: {msg.text}")

    dialog_block = "\n".join(dialog_lines) if dialog_lines else "(暂无历史)"
    user_turns = [m for m in req.history if m.role == "user"]
    current_round = len(user_turns) + 1
    fallback_idx = max(0, min(len(fallback_questions) - 1, len(user_turns)))
    fallback_question = fallback_questions[fallback_idx]

    prompt = (
        "请按照访谈专家的工作流程继续进行 5 轮启发式对话，每次只提出 1 个核心追问。"
        f"当前轮次：第 {current_round} 轮 / 5。"
        "结合上下文与已收集的问答，生成下一条能推进素材收集的追问，避免重复或宽泛。"
        "如果行动引导或历史回答提示需要数据验证，请显式询问用户是否有百分比/金额等具体数据，若没有则说明将以定性描述。"
        "输出格式：直接给出中文问题文本，如需引导可在后续追加 1-3 行示例/选项（使用“例如：”或项目符号），不要编号或其它解释。"
        f"\n\n上下文：\n{chr(10).join(context_parts)}"
        f"\n当前对话：\n{dialog_block}"
    )

    raw_question = await call_llm(
        REASONING_MODEL,
        [
            {"role": "system", "content": AUTO_WRITE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )
    question = raw_question.strip().split("\n")[0] if isinstance(raw_question, str) else ""

    if not question:
        question = fallback_question

    return {"result": question}

# 添加到文件顶部的 process 函数附近
def process_writing_points(raw_data):
    """
    给写作要点添加 ID 和默认状态
    """
    if not isinstance(raw_data, list):
        return []
    
    processed = []
    base_id = int(time.time() * 1000)
    
    for i, p in enumerate(raw_data):
        # 兼容 LLM 返回纯字符串的情况
        text = p if isinstance(p, str) else p.get("text", "未命名要点")
        sub_points = []
        if isinstance(p, dict):
             sub_points = p.get("subPoints", [])
        
        processed.append({
            "id": f"wp-gen-{base_id}-{i}",  # ✅ 关键：生成唯一 ID
            "text": text,
            "subPoints": sub_points,
            "isCompleted": False,
            "tags": []
        })
    return processed

# 添加到文件顶部
def normalize_review_data(data):
    """
    清洗评审数据，确保 score 是数字，todos 是数组
    """
    if not isinstance(data, dict):
        return {"score": 0, "summary": "生成失败", "todos": []}
    
    # 1. 强制转换分数
    raw_score = data.get("score", 0)
    try:
        # 处理 "85分" 或 "Score: 85" 这种脏数据
        if isinstance(raw_score, str):
            import re
            nums = re.findall(r"\d+", raw_score)
            score = int(nums[0]) if nums else 0
        else:
            score = int(raw_score)
    except:
        score = 0
        
    # 2. 强制转换 Todos
    todos = data.get("todos", [])
    if isinstance(todos, str): # 如果 LLM 发疯只返回了一条字符串
        todos = [todos]
    
    return {
        "score": score,  # ✅ 确保是 Int
        "summary": data.get("summary", "无综述"),
        "todos": todos
    }


def process_llm_outline_to_frontend_structure(raw_data):
    """
    将 LLM 生成的嵌套 JSON 转换为前端需要的扁平化 OutlineNode 列表。
    自动生成 ID，处理 parentId，补充 status 等字段。
    """
    if not isinstance(raw_data, list):
        return []
    
    flat_nodes = []
    # 使用当前时间戳作为基础 ID，模拟前端 Date.now()
    base_id = int(time.time() * 1000)

    for i1, l1 in enumerate(raw_data):
        # 1. 处理一级标题 (章节)
        l1_id = f"{base_id}-{i1}"
        l1_points = []
        raw_l1_points = l1.get("writingPoints", [])
        if isinstance(raw_l1_points, list):
            for k, p in enumerate(raw_l1_points):
                p_text = p.get("text", "") if isinstance(p, dict) else str(p)
                p_sub = p.get("subPoints", []) if isinstance(p, dict) else []
                l1_points.append({
                    "id": f"wp-{l1_id}-{k}",
                    "text": p_text,
                    "subPoints": p_sub,
                    "isCompleted": False,
                    "tags": []
                })
        
        node_l1 = {
            "id": l1_id,
            "title": l1.get("title", f"第{i1+1}章"),
            "level": 1,
            "parentId": None,
            "content": "",
            "status": "draft",
            "isLocked": False,
            "writingPoints": l1_points,
            "chapterGuide": l1.get("chapterGuide", "本章概述...")
        }
        flat_nodes.append(node_l1)

        # 2. 处理二级标题 (小节)
        children = l1.get("children", [])
        if isinstance(children, list):
            for i2, l2 in enumerate(children):
                l2_id = f"{l1_id}-{i2}"
                
                # 处理写作要点 (Writing Points) 及其 ID
                raw_points = l2.get("writingPoints", [])
                processed_points = []
                if isinstance(raw_points, list):
                    for k, p in enumerate(raw_points):
                        # 兼容字符串或对象格式
                        p_text = p.get("text", "") if isinstance(p, dict) else str(p)
                        p_sub = p.get("subPoints", []) if isinstance(p, dict) else []
                        processed_points.append({
                            "id": f"wp-{l2_id}-{k}",
                            "text": p_text,
                            "subPoints": p_sub,
                            "isCompleted": False,
                            "tags": []
                        })

                node_l2 = {
                    "id": l2_id,
                    "title": l2.get("title", f"{i1+1}.{i2+1} 小节"),
                    "level": 2,
                    "parentId": l1_id,
                    "content": "",
                    "status": "draft",
                    "isLocked": False,
                    "writingPoints": processed_points
                }
                flat_nodes.append(node_l2)
    
    return flat_nodes

def clean_and_parse_json(answer_LLM: str, default_value=None):
    """
    通用 JSON 清洗与解析函数
    """
    if default_value is None:
        default_value = {}
        
    try:
        # 使用 json_repair 修复并解析 (return_objects=True 直接返回 dict/list)
        parsed_json = repair_json(answer_LLM, return_objects=True)
        
        # 如果解析出来是字符串(说明没修好)，或者为空，返回默认值
        if isinstance(parsed_json, str) or parsed_json is None:
            print(f"[JSON Parse Warn] 解析结果仍为字符串或空: {str(parsed_json)[:50]}")
            # 尝试二次兜底：有时候 repair_json 对 markdown 代码块处理不完美，手动去皮
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", answer_LLM)
            if match:
                return repair_json(match.group(1), return_objects=True)
            return default_value
            
        return parsed_json
    except Exception as e:
        print(f"[JSON Parse Error] 解析彻底失败: {e}")
        return default_value

# ================= 核心生成功能 =================

@router.post("/outline")
async def generate_outline(req: OutlineRequest):
    prompt = f"""
    请为以下主题生成一个详细写作大纲（JSON数组，包含嵌套children）。
    主题：{req.topic}
    写作要求：{req.requirements}
    """
    raw_result = await call_llm(
        REASONING_MODEL,
        [{"role": "user", "content": prompt}],
    )
    
    cleaned_data = clean_and_parse_json(raw_result, default_value=[])
    # 同样应用结构转换
    final_structure = process_llm_outline_to_frontend_structure(cleaned_data)
    
    return {"result": final_structure}

@router.post("/generate")
async def generate_article(req: ArticleRequest):
    prompt = f"""
    根据以下大纲撰写完整文章：
    大纲：
    {req.outline}
    要求：
    {req.requirements}
    """
    result = await call_llm(
        CHAT_MODEL,
        [{"role": "user", "content": prompt}],
    )
    return {"result": result}

@router.post("/generate/stream")
async def generate_article_stream(req: ArticleRequest):
    async def event_generator():
        prompt = f"""
        根据以下大纲撰写完整文章：
        大纲：{req.outline}
        要求：{req.requirements}
        """
        async for chunk in call_llm_stream(
            CHAT_MODEL,
            [{"role": "user", "content": prompt}],
        ):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )

# ================= 编辑与润色 =================

@router.post("/polish")
async def polish(req: PolishRequest):
    prompt = f"""
    请对以下内容进行全文润色，使语言更专业流畅，保持原意不变：
    {req.content}
    """
    return create_stream_response(REASONING_MODEL, prompt)

@router.post("/rewrite")
async def rewrite(req: RewriteRequest):
    prompt = f"""
    请根据以下特定要求重写这段文本：
    【原文】：{req.content}
    【重写要求】：{req.requirements}
    """

    return create_stream_response(REASONING_MODEL, prompt)

@router.post("/smart-edit")
async def smart_edit(req: SmartEditRequest):
    action = "重写" if req.type == 'rewrite' else "续写"
    prompt = f"""
    你是一个智能写作助手。请根据用户指令对选中的文本进行{action}。
    【选中文本】：{req.selection}
    【用户指令】：{req.instruction}
    请直接输出{action}后的结果。
    """
    return create_stream_response(CHAT_MODEL, prompt)

@router.post("/continue")
async def continue_writing(req: ContinueRequest):
    prompt = f"""
    请根据上文内容，自然地续写接下来的2-3个句子。
    【上文】：{req.precedingText[-1000:]} 
    """
    return create_stream_response(CHAT_MODEL, prompt)

# ================= 评审与助手 =================

@router.post("/review")
async def review(req: ReviewRequest):
    # ✅ [已修复] 增加 JSON 解析
    prompt = f"""
    请作为专业编辑对以下文章进行评审。
    【文章内容】：{req.content}
    
    请严格返回合法的 JSON 格式，包含以下字段：
    1. score (0-100的整数评分)
    2. summary (简短的评审摘要)
    3. todos (包含3-5条具体的修改建议数组，字符串列表)
    """
    raw_result = await call_llm(
        REASONING_MODEL,
        [{"role": "user", "content": prompt}],
    )
    # 默认返回安全结构
    default = {"score": 0, "summary": "解析失败", "todos": []}
    return {"result": clean_and_parse_json(raw_result, default_value=default)}

@router.post("/chat")
async def chat_assistant(req: ChatRequest):

    prompt = f"""
    请根据提供的上下文回答用户的问题。
    【上下文】：{req.context[-2000:]}
    【用户问题】：{req.query}
    """

    return create_stream_response(CHAT_MODEL, prompt)

@router.post("/fix-todo")
async def fix_todo(req: TodoFixRequest):
    prompt = f"""
    文章中有一处需要修改。
    【原段落上下文】：{req.content[-500:]}
    【修改意见】：{req.todo}
    请根据意见重写该段落。
    """
    return create_stream_response(CHAT_MODEL, prompt)

@router.post("/detailed-info")
async def generate_detailed_info(req: DetailedInfoRequest):
    prompt = f"""
    请针对主题 "{req.topic}" 提供详细的背景信息和解释。
    【相关上下文】：{req.context[-1000:]}
    请输出一段详细、专业的说明文字。
    """
    return create_stream_response(CHAT_MODEL, prompt)

@router.post("/suggestions")
async def generate_suggestions(req: SuggestionRequest):
    prompt = f"猜测用户想问的3个问题及2个关键信息点。主题：{req.topic}。返回JSON：{{userQuestions:[], aiInfo:[]}}"
    raw_result = await call_llm(CHAT_MODEL, [{"role": "user", "content": prompt}])
    
    parsed = clean_and_parse_json(raw_result, default_value={})
    
    # ✅ 字段映射兜底
    final_data = {
        "userQuestions": parsed.get("userQuestions") or parsed.get("user_questions") or parsed.get("questions") or [],
        "aiInfo": parsed.get("aiInfo") or parsed.get("ai_info") or parsed.get("info") or []
    }
    
    return {"result": final_data}


@router.post("/generate/chunk")
async def generate_chunk_content(req: ChunkGenerateRequest):
    points_str = "无特定要点"
    if req.writingPoints:
        lines = []
        for i, p in enumerate(req.writingPoints):
            text = p.get('text', '') if isinstance(p, dict) else str(p)
            lines.append(f"{i+1}. {text}")
        points_str = "\n".join(lines)

    prompt = f"""
    请撰写文章的一个小节。
    【章节标题】：{req.sectionTitle}
    【上下文/前文摘要】：{req.context[-500:]}
    【写作风格】：{req.style}
    【本小节核心写作要点】：{points_str}
    请直接返回 Markdown 格式的正文内容。
    """
    return create_stream_response(CHAT_MODEL, prompt)


@router.post("/outline/from-materials")
async def outline_from_materials(req: OutlineFromMaterialsRequest):
    """写作大纲"""
    prompt = f"""
    基于以下材料生成详细的写作大纲（JSON数组格式）。
    
    主题：{req.topic}
    核心构想：{req.concept}
    参考材料摘要：{req.materialsSummary[:2000]}
    {f"必须包含一级标题：{req.expertLevel1Titles}" if req.expertLevel1Titles else ""}
    
    要求格式示例（不要包含Markdown标记）：
    [
      {{
        "title": "第一章...",
        "writingPoints": [ {{ "text": "本章核心目标：阐述..." }} ], 
        "children": [
           {{ "title": "1.1...", "writingPoints": [{{ "text": "要点1" }}] }}
        ]
      }}
    ]
    """
    
    # 2. 调用 LLM
    raw_result = await call_llm(REASONING_MODEL, [{"role": "user", "content": prompt}])
    
    # 3. 清洗 JSON (得到嵌套的 list/dict)
    cleaned_data = clean_and_parse_json(raw_result, default_value=[])
    
    # 4. 【关键步骤】转换为前端结构 (扁平化 + 生成 ID)
    final_structure = process_llm_outline_to_frontend_structure(cleaned_data)
    
    # 5. 返回
    print(f"[DEBUG] Generated {len(final_structure)} nodes") # Debug日志
    return {"result": final_structure}

@router.post("/generate/template")
async def generate_template(req: TemplateRequest):
    prompt = f"为章节'{req.title}'生成写作模板，要点：{str(req.points)}"
    result = await call_llm(CHAT_MODEL, [{"role": "user", "content": prompt}])
    return {"result": result}

@router.post("/rewrite/guidance")
async def rewrite_guidance(req: RewriteGuidanceRequest):
    prompt = f"根据指导重写：\n内容：{req.currentContent}\n指导：{req.guidance}"
    result = await call_llm(REASONING_MODEL, [{"role": "user", "content": prompt}])
    return {"result": result}

@router.post("/partial-merge")
async def partial_merge(req: PartialMergeRequest):
    chat_txt = "\n".join([f"{m.role}:{m.text}" for m in req.chatMessages])
    prompt = f"根据对话融合片段：\n对话：{chat_txt}\n片段：{req.originalText}"
   
    return create_stream_response(REASONING_MODEL, prompt)

@router.post("/selection-ref")
async def selection_ref(req: SelectionRefRequest):
    chat_txt = "\n".join([f"{m.role}:{m.text}" for m in req.chatMessages])
    prompt = f"指令：{req.instruction}\n对话：{chat_txt}\n原文：{req.originalText}"
  
    return create_stream_response(REASONING_MODEL, prompt)


@router.post("/review/chunk")
async def review_chunk(req: ReviewChunkRequest):
    prompt = f"评审章节'{req.sectionTitle}'：\n{req.content}\n请返回JSON：{{score, summary, todos}}"
    raw_result = await call_llm(REASONING_MODEL, [{"role": "user", "content": prompt}])
    
    parsed = clean_and_parse_json(raw_result, default_value={})
    
    # ✅ 应用清洗
    final_data = normalize_review_data(parsed)
    
    return {"result": final_data}

@router.post("/review/full")
async def review_full(req: FullReviewRequest):
    prompt = "全文评审..." 
    result = await call_llm(REASONING_MODEL, [{"role": "user", "content": prompt}])
    return {"result": result}

@router.post("/review/apply")
async def apply_suggestions(req: ApplySuggestionsRequest):
    prompt = f"根据建议修改：\n建议：{req.suggestions}\n原文：{req.content}"
    result = await call_llm(REASONING_MODEL, [{"role": "user", "content": prompt}])
    return {"result": result}

@router.post("/guide/global")
async def global_guide(req: GlobalGuideRequest):
    """全文写作引导"""
    prompt = f"""
    请生成《全文写作指导》和《分章节指导》。
    主题：{req.topic}
    概念：{req.concept}
    大纲结构：{str(req.outline)[:1000]}
    
    请返回 JSON 对象：
    {{
      "globalOverview": "...",
      "chapterGuides": {{ "章节名": "..." }}
    }}
    """
    raw_result = await call_llm(CHAT_MODEL, [{"role": "user", "content": prompt}])
    default = {"globalOverview": "AI未能生成指导", "chapterGuides": {}}
    print(raw_result)
    return {"result": clean_and_parse_json(raw_result, default_value=default)}

@router.post("/guide/contextual")
async def contextual_guide(req: ContextualGuidanceRequest):
    # ✅ [已修复] 更新 Prompt 要求 JSON 并增加解析
    prompt = f"""
    为章节'{req.title}'生成简短改写引导和推荐资料。
    请返回 JSON 格式：
    {{ "guidance": "...", "materials": "..." }}
    """
    raw_result = await call_llm(CHAT_MODEL, [{"role": "user", "content": prompt}])
    default = {"guidance": "无建议", "materials": ""}
    return {"result": clean_and_parse_json(raw_result, default_value=default)}

@router.post("/points")
async def generate_points(req: PointsRequest):
    prompt = f"为'{req.title}'生成3个写作要点，返回JSON数组。"
    raw_result = await call_llm(CHAT_MODEL, [{"role": "user", "content": prompt}])
    
    cleaned_data = clean_and_parse_json(raw_result, default_value=[])
    
    # ✅ 应用 ID 生成逻辑
    final_data = process_writing_points(cleaned_data)
    
    return {"result": final_data}

@router.post("/points/more")
async def more_points(req: MorePointsRequest):
    prompt = "建议下一个写作要点。"
    result = await call_llm(CHAT_MODEL, [{"role": "user", "content": prompt}])
    return {"result": result}

@router.post("/related-queries")
async def related_queries(req: RelatedQueriesRequest):
    # ✅ [已存在，保持]
    prompt = "生成3个搜索关键词，JSON数组。"
    raw_result = await call_llm(CHAT_MODEL, [{"role": "user", "content": prompt}])
    return {"result": clean_and_parse_json(raw_result, default_value=[])}