from pydantic import BaseModel
from typing import Optional
from typing import List, Any, Optional

# 基础请求模型
class OutlineRequest(BaseModel):
    topic: str
    requirements: str

class ArticleRequest(BaseModel):
    outline: str
    requirements: str

class PolishRequest(BaseModel):
    content: str

# === 新增的模型 (对应新接口) ===

class RewriteRequest(BaseModel):
    content: str
    requirements: str

class ReviewRequest(BaseModel):
    content: str

class ChatRequest(BaseModel):
    query: str
    context: str

class ContinueRequest(BaseModel):
    precedingText: str

class SmartEditRequest(BaseModel):
    selection: str
    instruction: str
    type: str  # 'rewrite' 或 'continue'

class TodoFixRequest(BaseModel):
    todo: str
    content: str

class DetailedInfoRequest(BaseModel):
    topic: str
    context: str

class SuggestionRequest(BaseModel):
    topic: str
    context: str

class ChunkGenerateRequest(BaseModel):
    sectionTitle: str
    context: str
    style: str = "professional"
    writingPoints: List[Any] = [] # 允许接收对象数组或字符串数组
    customPromptTemplate: Optional[str] = None


# app/schemas.py (追加在最后)
from typing import List, Any, Optional
from pydantic import BaseModel

# 通用/基础
class ChatMessageModel(BaseModel):
    role: str
    text: str

# 核心生成
class OutlineFromMaterialsRequest(BaseModel):
    topic: str
    concept: str
    materialsSummary: str
    expertLevel1Titles: List[str] = []
    customPromptTemplate: Optional[str] = None

class ChunkGenerateRequest(BaseModel):
    sectionTitle: str
    context: str
    style: str = "professional"
    writingPoints: List[Any] = []
    customPromptTemplate: Optional[str] = None

class TemplateRequest(BaseModel):
    title: str
    points: List[Any]

# 编辑润色
class RewriteGuidanceRequest(BaseModel):
    currentContent: str
    guidance: str
    materials: str
    writingPoints: List[Any] = []

class ContinueRequest(BaseModel):
    sectionTitle: Optional[str] = ""
    precedingText: str

class MergePolishRequest(BaseModel):
    currentContent: str
    chatMessages: List[ChatMessageModel]

class PartialMergeRequest(BaseModel):
    originalText: str
    chatMessages: List[ChatMessageModel]

class SelectionRefRequest(BaseModel):
    originalText: str
    chatMessages: List[ChatMessageModel]
    instruction: str

# 评审
class ReviewChunkRequest(BaseModel):
    sectionTitle: str
    content: str
    writingPoints: List[Any] = []

class FullReviewRequest(BaseModel):
    outline: List[Any]

class ApplySuggestionsRequest(BaseModel):
    content: str
    suggestions: List[str]

# 指导
class GlobalGuideRequest(BaseModel):
    topic: str
    concept: str
    materials: str
    outline: List[Any]

class ContextualGuidanceRequest(BaseModel):
    title: str
    content: str

# 辅助
class PointsRequest(BaseModel):
    title: str
    materials: str

class MorePointsRequest(BaseModel):
    currentPoints: List[Any]
    content: str

class RelatedQueriesRequest(BaseModel):
    content: str

class ChatWithRefRequest(BaseModel):
    query: str
    context: str
    references: List[Any] = []

# 一键代写前的多轮提问生成
class AutoWriteQuestionsRequest(BaseModel):
    sectionTitle: str
    writingPoints: List[Any] = []
    materials: str = ""


class AutoWriteNextQuestionRequest(BaseModel):
    sectionTitle: str
    writingPoints: List[Any] = []
    materials: str = ""
    history: List[ChatMessageModel] = []
