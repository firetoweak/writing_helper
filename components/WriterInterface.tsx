
import React, { useState, useEffect, useRef } from 'react';
import { OutlineNode, User, ReviewComment, PromptsConfig, ChatSession, Reference, WritingPoint, Version, ChatMessage, VersionType, GlobalGuide, ChapterReviewData } from '../types';
import {
    generateChunkContent,
    reviewChunk,
    generateSmartEdit,
    generateFollowUpSuggestions,
    generateMergePolish,
    generatePartialMerge,
    generateSelectionWithReferences,
    generateSubSectionTemplate,
    polishContent,
    generateToDoFix,
    fetchAutoWriteNextQuestion,
} from '../services/geminiService';
import { 
    Wand2, Sparkles, MessageSquare, Quote, ArrowUp, 
    Keyboard, History, RotateCcw, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripVertical, Check, CheckSquare, Layers, Save, FileDiff, ChevronDown, ChevronRight, Book, Info, Play, Lightbulb, List, CircleDashed, ClipboardCheck, ArrowRight, X
} from 'lucide-react';
import ChatAssistant from './ChatAssistant';
import ReactMarkdown from 'react-markdown';

type AutoWriteMessage = { role: 'assistant' | 'user'; text: string };

const AUTO_WRITE_TURNS = 5;
const DEFAULT_AUTO_WRITE_QUESTIONS = [
    "这一小节你想呈现的核心论点或故事线是什么？有没有具体场景可以分享？",
    "目标读者是谁？他们最关注的痛点或收益点是什么？",
    "为了支撑论点，你希望强调的关键事实、论据或行动步骤有哪些？",
    "有没有案例、数据或外部资料支撑上述论据？如果暂时没有，也请说明你手头的定性证据。",
    "你希望最终呈现的语气和风格是什么？（如专业、鼓励、客观等）"
];

interface Props {
  activeNode: OutlineNode;
  outline: OutlineNode[];
  setOutline: (outline: OutlineNode[]) => void;
  currentUser: User;
  users: User[];
  onUpdateContent: (id: string, content: string) => void;
  onUpdateStatus: (id: string, status: 'draft' | 'reviewing' | 'done') => void;
  onAddReview: (id: string, reviews: ReviewComment[]) => void;
  onSaveVersion: (id: string, content: string, note?: string, type?: VersionType) => void;
  customPrompts?: PromptsConfig;
  chatSessions: ChatSession[];
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  materials?: string;
  globalGuide?: GlobalGuide;
}

const HelperDiffRenderer = ({ currentContent, previousContent }: { currentContent: string, previousContent: string }) => {
    if (!previousContent) return <div className="text-slate-600">{currentContent}</div>;
    const oldLines = previousContent.split('\n');
    const newLines = currentContent.split('\n');
    return (
        <div className="font-mono text-xs leading-relaxed">
            {newLines.map((line, i) => {
                if (oldLines.includes(line)) return <div key={i} className="text-slate-400 truncate">{line}</div>;
                return <div key={i} className="bg-green-100 text-green-800 px-1 rounded decoration-clone"><span className="text-green-600 select-none">+ </span>{line}</div>;
            })}
             {oldLines.filter(l => !newLines.includes(l) && l.trim()).map((line, i) => (
                <div key={`del-${i}`} className="bg-red-50 text-red-400 line-through decoration-red-400 px-1 rounded decoration-clone"><span className="select-none">- </span>{line}</div>
            ))}
        </div>
    )
}

const DiffModal = ({ oldText, newText, onClose }: { oldText: string, newText: string, onClose: () => void }) => {
    const [mode, setMode] = useState<'side-by-side' | 'inline'>('inline');
    return (
        <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center backdrop-blur-sm p-10">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-lg">版本对比</h3>
                        <div className="flex bg-slate-100 rounded p-0.5">
                            <button onClick={() => setMode('inline')} className={`px-3 py-1 text-xs rounded ${mode === 'inline' ? 'bg-white shadow text-primary font-bold' : 'text-slate-500'}`}>修订模式</button>
                            <button onClick={() => setMode('side-by-side')} className={`px-3 py-1 text-xs rounded ${mode === 'side-by-side' ? 'bg-white shadow text-primary font-bold' : 'text-slate-500'}`}>双栏对比</button>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-4 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-600">关闭</button>
                </div>
                {mode === 'side-by-side' ? (
                    <div className="flex-1 grid grid-cols-2 overflow-hidden">
                        <div className="border-r flex flex-col h-full bg-red-50/30">
                            <div className="p-2 bg-red-100/50 text-red-800 text-xs font-bold border-b border-red-200 sticky top-0">历史版本 (Old)</div>
                            <div className="flex-1 overflow-y-auto p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">{oldText}</div>
                        </div>
                        <div className="flex flex-col h-full bg-green-50/30">
                            <div className="p-2 bg-green-100/50 text-green-800 text-xs font-bold border-b border-green-200 sticky top-0">当前版本 (Current)</div>
                            <div className="flex-1 overflow-y-auto p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">{newText}</div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                        <div className="max-w-3xl mx-auto bg-white p-8 shadow-sm rounded-lg min-h-full">
                           <HelperDiffRenderer currentContent={newText} previousContent={oldText} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const WriterInterface: React.FC<Props> = ({ 
    activeNode, outline, setOutline, currentUser, onUpdateContent, onUpdateStatus, onAddReview, onSaveVersion, customPrompts, chatSessions, setChatSessions, materials: globalMaterials, globalGuide
}) => {
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(384);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);

  // Sub-section State (Level 2)
  const [activeSubNodeId, setActiveSubNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'split_generation'>('editor');
  const [generationContext, setGenerationContext] = useState<'section' | 'chapter'>('section');
  const [generatedContent, setGeneratedContent] = useState("");

  const [isReviewing, setIsReviewing] = useState(false);
  const [isPolishingChapter, setIsPolishingChapter] = useState(false);
  const [localContent, setLocalContent] = useState("");
  
  const [sidebarTab, setSidebarTab] = useState<'directory' | 'reviews'>('directory');
  
  // Writing points are now derived from the ACTIVE SUB-NODE
  const [writingPoints, setWritingPoints] = useState<WritingPoint[]>([]);

  const [rightTab, setRightTab] = useState<'chat' | 'history'>('chat');
  const [viewingDiff, setViewingDiff] = useState<{old: string, new: string} | null>(null);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());

  const [ghostText, setGhostText] = useState<string | null>(null);
  const [isGhostEditable, setIsGhostEditable] = useState(false);
  const [pendingRewriteBackup, setPendingRewriteBackup] = useState<{content: string, cursor: number} | null>(null);
  const [pendingSaveType, setPendingSaveType] = useState<VersionType>('ai_gen');
  const [saveMergeToHistory, setSaveMergeToHistory] = useState(false);

  // Review State
  const [activeToDo, setActiveToDo] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generatedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const ghostViewRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [caretPos, setCaretPos] = useState<{top: number, left: number} | null>(null);
  const [selectionIndex, setSelectionIndex] = useState<number>(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiInputValue, setAiInputValue] = useState("");
  const [selectionRange, setSelectionRange] = useState<{start: number, end: number} | null>(null);
  const [isEditorSelection, setIsEditorSelection] = useState(false);
  const [globalSelectionText, setGlobalSelectionText] = useState("");

  const [activeReferences, setActiveReferences] = useState<Reference[]>([]);

  // Guide UI states
  const [showGlobalDrawer, setShowGlobalDrawer] = useState(false);
  const [showChapterGuidePopup, setShowChapterGuidePopup] = useState(false);

  // Auto-write conversation state
  const [showAutoWriteDialog, setShowAutoWriteDialog] = useState(false);
  const [autoWriteMessages, setAutoWriteMessages] = useState<AutoWriteMessage[]>([]);
  const [autoWriteInput, setAutoWriteInput] = useState("");
  const [autoWriteStep, setAutoWriteStep] = useState(0);

  const autoWriteTotal = AUTO_WRITE_TURNS;

  // Derive hasSelection for passing to child components
  const hasSelection = selectionRange && selectionRange.start !== selectionRange.end && isEditorSelection;

  // Derive Sub Nodes (Level 2)
  const subNodes = outline.filter(n => n.parentId === activeNode.id);
  const activeSubNode = subNodes.find(n => n.id === activeSubNodeId) || subNodes[0];

  // Initialize active sub node on chapter change
  useEffect(() => {
      if (subNodes.length > 0) {
          setActiveSubNodeId(subNodes[0].id);
      } else {
          setActiveSubNodeId(null);
      }
      setViewMode('editor');
  }, [activeNode.id]);
  
  // Auto-switch away from To-Do context when switching sidebar tabs
  useEffect(() => {
      if (sidebarTab === 'directory') {
          setActiveToDo(null);
      }
  }, [sidebarTab]);

  // Sync content and points when active SUB node changes
  useEffect(() => {
      if (activeSubNode) {
          setLocalContent(activeSubNode.content);
          setWritingPoints(activeSubNode.writingPoints || []);
          
          if (!activeToDo) { // Only switch section chat if not in Review mode
              const sessionKey = `chat-${activeSubNode.id}`;
              const existingSession = chatSessions.find(s => s.linkedSectionId === activeSubNode.id);
              
              if (existingSession) {
                  setChatSessions(prev => prev.map(s => ({...s, isActive: s.id === existingSession.id})));
              } else {
                  // Create new session for this sub-section
                  const newSession: ChatSession = {
                      id: sessionKey,
                      linkedSectionId: activeSubNode.id,
                      title: `助手: ${activeSubNode.title}`,
                      isActive: true,
                      createdAt: Date.now(),
                      messages: [{
                          id: 'welcome',
                          role: 'model',
                          text: `你好！我是 **${activeSubNode.title}** 的专属写作助手。我可以帮你生成内容、检查逻辑或回答相关问题。`,
                          timestamp: Date.now()
                      }]
                  };
                  setChatSessions(prev => prev.map(s => ({...s, isActive: false})).concat(newSession));
              }
          }
          
          // Auto-generate template if empty
          if (!activeSubNode.content || activeSubNode.content.length < 10) {
               generateSubSectionTemplate(activeSubNode.title, activeSubNode.writingPoints || [], (chunk) => setGhostText(chunk))
                  .then(() => {
                      setPendingSaveType('ai_gen');
                      setIsGhostEditable(false);
                  });
          } else {
              setGhostText(null);
          }

      } else {
          setLocalContent("");
          setWritingPoints([]);
      }
      setMenuVisible(false);
      setActiveReferences([]);
      setIsGhostEditable(false);
      setViewMode('editor');
  }, [activeSubNodeId]);


  // Resize logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      if (isResizing === 'left') {
        const newWidth = e.clientX - containerRect.left;
        if (newWidth > 200 && newWidth < 600) setLeftWidth(newWidth);
      } else if (isResizing === 'right') {
        const newWidth = containerRect.right - e.clientX;
        if (newWidth > 300 && newWidth < 800) setRightWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(null);
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const getEditorCaretCoords = (): {top: number, left: number} | null => {
      const textarea = textareaRef.current;
      const mirror = mirrorRef.current;
      if (!textarea || !mirror) return null;
      const computed = window.getComputedStyle(textarea);
      mirror.style.width = computed.width;
      mirror.style.font = computed.font;
      mirror.style.padding = computed.padding;
      mirror.style.lineHeight = computed.lineHeight;
      mirror.style.whiteSpace = computed.whiteSpace;
      mirror.style.wordWrap = computed.wordWrap;
      const { selectionEnd } = textarea;
      mirror.textContent = textarea.value.substring(0, selectionEnd);
      const span = document.createElement('span');
      span.textContent = '|';
      mirror.appendChild(span);
      const rect = textarea.getBoundingClientRect(); 
      const top = rect.top + span.offsetTop - textarea.scrollTop + 28;
      const left = rect.left + span.offsetLeft - textarea.scrollLeft;
      return { top, left };
  };

  useEffect(() => {
      const handleGlobalMouseUp = (e: MouseEvent) => {
          if (isResizing) return;
          if ((e.target as HTMLElement).closest('.floating-menu')) return;

          // Editor Check
          if (textareaRef.current && textareaRef.current.contains(e.target as Node)) {
              const ta = textareaRef.current;
              if (ta.selectionStart !== ta.selectionEnd) {
                  const text = ta.value.substring(ta.selectionStart, ta.selectionEnd);
                  setGlobalSelectionText(text);
                  setIsEditorSelection(true);
                  updateEditorInternalState();
                  const coords = getEditorCaretCoords();
                  if (coords) {
                      setCaretPos(coords);
                      setMenuVisible(true);
                      setAiInputMode(false);
                  }
                  return;
              }
          }
          // Global Check (Outside editor)
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed) return;
          const text = selection.toString().trim();
          if (!text) return;

          setGlobalSelectionText(text);
          setIsEditorSelection(false); 
          const range = selection.getRangeAt(0);
          const rects = range.getClientRects();
          let top = 0; let left = 0;
          if (rects.length > 0) {
              const lastRect = rects[rects.length - 1];
              top = lastRect.bottom + 8; left = lastRect.right;
          } else {
              const rect = range.getBoundingClientRect();
              top = rect.bottom + 8; left = rect.right;
          }
          if (top > 0) {
              setCaretPos({ top, left });
              setMenuVisible(true);
              setAiInputMode(false);
          }
      };
      const handleGlobalContextMenu = (e: MouseEvent) => {
          if (menuVisible) setMenuVisible(false);
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('contextmenu', handleGlobalContextMenu);
      return () => {
          window.removeEventListener('mouseup', handleGlobalMouseUp);
          window.removeEventListener('contextmenu', handleGlobalContextMenu);
      };
  }, [isResizing, menuVisible]);

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (activeSubNode) {
        onUpdateContent(activeSubNode.id, val);
    }
    setGhostText(null);
    if(menuVisible) setMenuVisible(false);
    updateEditorInternalState();
  };
  
  const handlePointChange = (id: string, newText: string) => {
      const updated = writingPoints.map(wp => wp.id === id ? { ...wp, text: newText } : wp);
      setWritingPoints(updated);
  };

  const handleSubPointChange = (wpId: string, index: number, newText: string) => {
      const updated = writingPoints.map(wp => {
          if (wp.id === wpId) {
              const newSubs = [...wp.subPoints];
              newSubs[index] = newText;
              return { ...wp, subPoints: newSubs };
          }
          return wp;
      });
      setWritingPoints(updated);
  };

  const updateEditorInternalState = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setSelectionIndex(end);
    setSelectionRange({ start, end });
    if (start !== end) setIsEditorSelection(true);
    else setIsEditorSelection(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
     if (textareaRef.current?.contains(e.target as Node)) {
         const coords = getEditorCaretCoords();
         if (coords) {
             setCaretPos(coords);
             setMenuVisible(true);
             setAiInputMode(false);
             setIsEditorSelection(true);
             setGlobalSelectionText("");
         }
     }
  };

  const preventBlur = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleQuoteSelection = () => {
      const text = globalSelectionText;
      if (!text) return;
      const newRef: Reference = { id: Date.now().toString(), text, source: isEditorSelection ? 'editor' : 'chat', preview: text.substring(0, 50) + (text.length > 50 ? '...' : '') };
      setActiveReferences(prev => [...prev, newRef]);
      setMenuVisible(false);
      if (isLeftCollapsed && isRightCollapsed) setIsRightCollapsed(false);
      setRightTab('chat');
  };

  const handleChatSelection = () => {
      const text = globalSelectionText;
      const newSession: ChatSession = { id: Date.now().toString(), title: text ? `关于: ${text.substring(0, 10)}...` : `关于上下文`, isActive: true, createdAt: Date.now(), messages: [{ id: '1', role: 'user', text: text ? `针对这段内容："${text}"，我想...` : "帮我构思一下...", timestamp: Date.now() }] };
      setChatSessions(prev => prev.map(s => ({...s, isActive: false})).concat(newSession));
      setMenuVisible(false);
      setIsRightCollapsed(false);
      setRightTab('chat');
  };

  const handleSmartSubmit = async () => {
      if (!aiInputValue.trim()) return;
      const hasSelection = selectionRange && selectionRange.start !== selectionRange.end && isEditorSelection;
      const selectionText = hasSelection ? localContent.substring(selectionRange!.start, selectionRange!.end) : localContent.substring(0, selectionIndex);
      setMenuVisible(false);
      const currentScrollTop = textareaRef.current?.scrollTop || 0;
      setPendingRewriteBackup({ content: localContent, cursor: selectionIndex });
      
      let contentForGhost = localContent;
      if (hasSelection) {
          contentForGhost = localContent.substring(0, selectionRange!.start) + localContent.substring(selectionRange!.end);
          setSelectionIndex(selectionRange!.start);
      }
      setLocalContent(contentForGhost);
      
      setGhostText(""); 
      setIsGhostEditable(false);
      setPendingSaveType('smart_edit');
      setSaveMergeToHistory(false);
      
      setTimeout(() => { if (ghostViewRef.current) ghostViewRef.current.scrollTop = currentScrollTop; }, 50);

      await generateSmartEdit(selectionText, aiInputValue, hasSelection ? 'rewrite' : 'continue', (chunk) => setGhostText(chunk));
      setAiInputValue("");
  };

  const getNextAutoWriteQuestion = async (history: AutoWriteMessage[], step: number) => {
      if (!activeSubNode) return DEFAULT_AUTO_WRITE_QUESTIONS[step] || DEFAULT_AUTO_WRITE_QUESTIONS[0];
      const fallback = DEFAULT_AUTO_WRITE_QUESTIONS[Math.min(step, DEFAULT_AUTO_WRITE_QUESTIONS.length - 1)] || DEFAULT_AUTO_WRITE_QUESTIONS[0];

      try {
          const question = await fetchAutoWriteNextQuestion(
              activeSubNode.title,
              activeSubNode.writingPoints || [],
              globalMaterials || "",
              history
          );

          if (typeof question === 'string' && question.trim()) {
              return question.trim();
          }
      } catch (error) {
          console.error('获取下一条代写提问失败', error);
      }

      return fallback;
  };

  const handleFullWrite = async () => {
      if (!activeSubNode) return;
      setMenuVisible(false);
      const firstQuestion = await getNextAutoWriteQuestion([], 0);

      setAutoWriteMessages([{ role: 'assistant', text: firstQuestion }]);
      setAutoWriteInput("");
      setAutoWriteStep(0);
      setShowAutoWriteDialog(true);
  };

  const runAutoWriteGeneration = async (messages: AutoWriteMessage[]) => {
      if (!activeSubNode) return;

      let questionIndex = 0;
      const dialogSummary = messages.map((msg) => {
          if (msg.role === 'assistant') {
              questionIndex += 1;
              return `Q${questionIndex}: ${msg.text}`;
          }
          return `A${questionIndex}: ${msg.text}`;
      }).join('\n');

      const userNotes = messages
          .filter((m) => m.role === 'user')
          .map((m, idx) => `${idx + 1}. ${m.text}`)
          .join('\n');

      const context = `基于用户的多轮输入，请为《${activeSubNode.title}》生成内容。\n对话摘要：\n${dialogSummary}\n\n用户需求汇总：\n${userNotes}`;

      setGenerationContext('section');
      setViewMode('split_generation');
      setGeneratedContent("");
      setShowAutoWriteDialog(false);

      await generateChunkContent(activeSubNode.title, context, "professional", writingPoints, customPrompts?.content_gen, (chunk) => setGeneratedContent(chunk));
  };

  const handleAutoWriteSubmit = async () => {
      if (!autoWriteInput.trim()) return;
      const userMessage: AutoWriteMessage = { role: 'user', text: autoWriteInput.trim() };
      const updatedMessages = [...autoWriteMessages, userMessage];
      const nextStep = autoWriteStep + 1;
      setAutoWriteMessages(updatedMessages);
      setAutoWriteInput("");
      setAutoWriteStep(nextStep);

      if (nextStep >= autoWriteTotal) {
          await runAutoWriteGeneration(updatedMessages);
      } else {
          const nextQuestion = await getNextAutoWriteQuestion(updatedMessages, nextStep);
          setAutoWriteMessages([...updatedMessages, { role: 'assistant', text: nextQuestion }]);
      }
  };

  const renderAutoWriteMessages = () => {
      let questionCounter = 0;
      return autoWriteMessages.map((msg, idx) => {
          const isAssistant = msg.role === 'assistant';
          if (isAssistant) {
              questionCounter += 1;
          }
          const label = isAssistant ? `Q${questionCounter}` : `A${questionCounter}`;

          return (
              <div key={idx} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                  <div
                      className={`${isAssistant ? 'bg-white text-slate-800 border border-slate-200' : 'bg-primary text-white'} px-4 py-3 rounded-2xl shadow-sm max-w-[90%] whitespace-pre-wrap`}
                  >
                      <div className={`text-[11px] font-semibold mb-1 ${isAssistant ? 'text-slate-500' : 'text-white/80'}`}>{label}</div>
                      {isAssistant ? (
                          <ReactMarkdown className="prose prose-sm max-w-none text-slate-800 leading-relaxed">{msg.text}</ReactMarkdown>
                      ) : (
                          <div className="text-sm leading-relaxed">{msg.text}</div>
                      )}
                  </div>
              </div>
          );
      });
  };

  const handleAcceptGeneration = () => {
      if (generationContext === 'chapter') {
          // Chapter Merge / Polish -> Save to L1 History
          onSaveVersion(activeNode.id, generatedContent, "全章润色/整合", 'full_polish');
          alert("全章版本已保存至历史版本。");
      } else {
          // Section Write -> Overwrite Content
          onSaveVersion(activeSubNode.id, localContent, "覆盖前备份", "manual");
          setLocalContent(generatedContent);
          onUpdateContent(activeSubNode.id, generatedContent);
          onSaveVersion(activeSubNode.id, generatedContent, "AI 一键代写", "ai_gen");
      }
      setViewMode('editor');
  };

  const handleMergeMessages = async (messages: ChatMessage[]) => {
      // Determine Merge Context
      const isChapterMerge = activeToDo !== null;

      if (isChapterMerge) {
           // Chapter Merge Logic -> Split View
           setGenerationContext('chapter');
           setViewMode('split_generation');
           setGeneratedContent("");
           // Load full chapter content into Left Pane for comparison
           const fullChapter = subNodes.map(n => `## ${n.title}\n\n${n.content || ''}`).join('\n\n');
           setLocalContent(fullChapter); 
           
           await generateMergePolish(fullChapter, messages, (chunk) => setGeneratedContent(chunk));
           return;
      }

      // Section Merge Logic (Existing)
      const hasSelection = selectionRange && selectionRange.start !== selectionRange.end && isEditorSelection;
      if (hasSelection) {
          const selectionText = localContent.substring(selectionRange!.start, selectionRange!.end);
          const currentScrollTop = textareaRef.current?.scrollTop || 0;
          setPendingRewriteBackup({ content: localContent, cursor: selectionRange!.start });
          const contentForGhost = localContent.substring(0, selectionRange!.start) + localContent.substring(selectionRange!.end);
          setLocalContent(contentForGhost);
          setSelectionIndex(selectionRange!.start);
          setGhostText("");
          setIsGhostEditable(true);
          setPendingSaveType('partial_merge');
          setSaveMergeToHistory(false);
          setTimeout(() => { if (ghostViewRef.current) ghostViewRef.current.scrollTop = currentScrollTop; }, 50);
          
          await generatePartialMerge(selectionText, messages, (chunk) => setGhostText(chunk));

      } else {
          setPendingRewriteBackup({ content: localContent, cursor: 0 });
          setGhostText("");
          setIsGhostEditable(false);
          setPendingSaveType('full_polish');
          setSaveMergeToHistory(false);
          setLocalContent(""); 
          await generateMergePolish(localContent, messages, (chunk) => setGhostText(chunk));
      }
  };

  const handleMergeWithInstruction = async (messages: ChatMessage[], instruction: string) => {
      if (!selectionRange || selectionRange.start === selectionRange.end) return;
      const selectionText = localContent.substring(selectionRange.start, selectionRange.end);
      const currentScrollTop = textareaRef.current?.scrollTop || 0;
      setPendingRewriteBackup({ content: localContent, cursor: selectionRange.start });
      const contentForGhost = localContent.substring(0, selectionRange.start) + localContent.substring(selectionRange.end);
      setLocalContent(contentForGhost);
      setSelectionIndex(selectionRange.start);
      setGhostText("");
      setIsGhostEditable(true);
      setPendingSaveType('partial_merge'); 
      setSaveMergeToHistory(false);
      setTimeout(() => { if (ghostViewRef.current) ghostViewRef.current.scrollTop = currentScrollTop; }, 50);
      await generateSelectionWithReferences(selectionText, messages, instruction, (chunk) => setGhostText(chunk));
  };

  const handleAcceptGhost = () => {
      if (!ghostText || !activeSubNode) return;
      const insertPos = selectionIndex;
      const before = localContent.substring(0, insertPos);
      const after = localContent.substring(insertPos);
      const newContent = before + ghostText + after;
      setLocalContent(newContent);
      onUpdateContent(activeSubNode.id, newContent);
      
      if (pendingSaveType === 'partial_merge') {
          if (saveMergeToHistory) onSaveVersion(activeSubNode.id, newContent, "局部整合", pendingSaveType);
      } else {
         onSaveVersion(activeSubNode.id, newContent, "AI 生成/润色", pendingSaveType);
      }
      setGhostText(null); setIsGhostEditable(false); setPendingRewriteBackup(null);
      setTimeout(() => { if (textareaRef.current) { textareaRef.current.focus(); textareaRef.current.selectionStart = insertPos + ghostText.length; textareaRef.current.selectionEnd = insertPos + ghostText.length; } }, 0);
  };
  
  const handleDiscardGhost = () => {
       if (pendingRewriteBackup) { 
           setLocalContent(pendingRewriteBackup.content); 
           if (activeSubNode) onUpdateContent(activeSubNode.id, pendingRewriteBackup.content); 
           setTimeout(() => { if (textareaRef.current) { textareaRef.current.focus(); textareaRef.current.selectionStart = pendingRewriteBackup.cursor; textareaRef.current.selectionEnd = pendingRewriteBackup.cursor; } }, 0); 
       } else { 
           setGhostText(null); 
       }
      setPendingRewriteBackup(null); setIsGhostEditable(false);
  };
  
  const handleRestoreVersion = (version: Version) => {
      if (window.confirm("确定要恢复到此版本吗？")) handleContentChange(version.content);
  }

  const handleManualSave = () => {
      if (activeSubNode) onSaveVersion(activeSubNode.id, localContent, "手动保存", "manual");
  };

  const toggleHistoryExpand = (id: string) => {
      const next = new Set(expandedHistoryIds);
      if(next.has(id)) next.delete(id); else next.add(id);
      setExpandedHistoryIds(next);
  }

  // Chapter Level Actions
  const allSubNodesHaveContent = subNodes.length > 0 && subNodes.every(n => n.content && n.content.length > 20);
  const chapterContent = subNodes.map(n => `## ${n.title}\n\n${n.content || '(未完成)'}`).join('\n\n');
  const hasChanged = chapterContent !== (activeNode.lastReviewedContent || "");
  const canChapterAction = allSubNodesHaveContent;
  const canReview = canChapterAction && (hasChanged || !activeNode.chapterReview);

  const handleChapterReview = async () => {
      if (!allSubNodesHaveContent) return;
      setIsReviewing(true);
      try {
        const reviewData = await reviewChunk(activeNode.title, chapterContent, [], customPrompts?.review_gen);
        const newOutline = outline.map(n => n.id === activeNode.id ? { ...n, chapterReview: reviewData, lastReviewedContent: chapterContent } : n);
        setOutline(newOutline);
        setSidebarTab('reviews');
        setIsLeftCollapsed(false);
      } finally { setIsReviewing(false); }
  };

  const handleChapterPolish = async () => {
      if (!allSubNodesHaveContent) return;
      // UPDATED: Use Split View for Chapter Polish
      setGenerationContext('chapter');
      setViewMode('split_generation');
      setGeneratedContent("");
      // Load aggregated chapter content
      setLocalContent(chapterContent);
      
      await polishContent(chapterContent, (chunk) => setGeneratedContent(chunk));
  };
  
  const handleToDoClick = (todo: string) => {
      setActiveToDo(todo);
      setRightTab('chat');
      setIsRightCollapsed(false);
      
      const sessionKey = `review-fix-${activeNode.id}`;
      // Find shared session or create
      let existingSession = chatSessions.find(s => s.id === sessionKey);
      
      if (existingSession) {
          setChatSessions(prev => prev.map(s => ({...s, isActive: s.id === sessionKey})));
      } else {
          const newSession: ChatSession = { 
              id: sessionKey, 
              linkedSectionId: activeNode.id, // Linked to Chapter
              title: `本章评审修复`, 
              isActive: true, 
              createdAt: Date.now(), 
              messages: [{ id: 'init', role: 'model', text: `针对本章评审的修复工作已准备就绪。请点击左侧 To-Do 项开始。`, timestamp: Date.now() }] 
          };
          setChatSessions(prev => prev.map(s => ({...s, isActive: false})).concat(newSession));
      }
  };
  
  const handleAutoFixToDo = async (todo: string) => {
     // Use handleToDoClick logic first to ensure session is active
     handleToDoClick(todo);
     // Then inject fix
     const fix = await generateToDoFix(todo, chapterContent);
     const sessionKey = `review-fix-${activeNode.id}`;
     setChatSessions(prev => prev.map(s => {
         if (s.id === sessionKey) {
             return {
                 ...s,
                 messages: [...s.messages, { id: Date.now().toString(), role: 'model', text: `针对待办事项 **"${todo}"**，建议如下：\n\n${fix}`, timestamp: Date.now() }]
             }
         }
         return s;
     }));
  };

  const handleChatAboutText = async (text: string, contextLabel: string) => {
      setActiveToDo(null); // Clear Review Context
      const suggestionData = await generateFollowUpSuggestions(localContent, text);
      const newSession: ChatSession = { 
          id: Date.now().toString(), 
          linkedSectionId: activeSubNode?.id,
          title: `讨论: ${text.substring(0, 8)}`, 
          isActive: true, 
          createdAt: Date.now(), 
          messages: [{ id: '1', role: 'model', text: `关于${contextLabel} **"${text}"**，我们可以从以下角度展开讨论：`, timestamp: Date.now(), suggestionData }] 
      };
      setChatSessions(prev => prev.map(s => ({...s, isActive: false})).concat(newSession));
      setRightTab('chat'); setIsRightCollapsed(false);
  };

  const handleChatAboutReview = async (review: ReviewComment) => handleChatAboutText(review.text, "评审意见");

  const currentChapterGuide = activeNode.chapterGuide || (globalGuide && globalGuide.chapterGuides[activeNode.title]) || "本章写作指引...";
  const chapterReview = activeNode.chapterReview;
  const mergeContext = activeToDo ? 'chapter' : 'section';

  return (
    <div ref={containerRef} className="flex flex-row h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden w-full relative select-text">
        {viewingDiff && <DiffModal oldText={viewingDiff.old} newText={viewingDiff.new} onClose={() => setViewingDiff(null)} />}

        {showAutoWriteDialog && (
            <div className="fixed inset-0 bg-black/40 z-[12000] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-slate-900">一键代写 - 多轮收集需求</div>
                            <div className="text-xs text-slate-500">已收集 {Math.min(autoWriteStep, autoWriteTotal)}/{autoWriteTotal} 次用户输入</div>
                        </div>
                        <button onClick={() => setShowAutoWriteDialog(false)} className="text-slate-400 hover:text-slate-600 text-sm">关闭</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
                        {renderAutoWriteMessages()}
                    </div>
                    <div className="p-4 border-t bg-white">
                        <div className="text-[10px] text-slate-500 mb-2">请逐轮回答，共 {autoWriteTotal} 轮，每轮仅需回答 1 个问题，系统会在收集满后自动生成本节内容。</div>
                        <div className="flex gap-2">
                            <input
                                value={autoWriteInput}
                                onChange={(e) => setAutoWriteInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAutoWriteSubmit()}
                                placeholder="请输入你的想法或补充..."
                                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <button
                                onClick={handleAutoWriteSubmit}
                                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50"
                                disabled={!autoWriteInput.trim()}
                            >
                                {autoWriteStep + 1 >= autoWriteTotal ? '完成并生成' : '提交'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* GLOBAL GUIDE SIDE DRAWER */}
        {globalGuide && (
            <div
                className={`fixed left-0 top-20 z-[50] flex transition-all duration-300 ${showGlobalDrawer ? 'translate-x-0' : '-translate-x-[320px]'}`}
                onMouseEnter={() => setShowGlobalDrawer(true)}
                onMouseLeave={() => setShowGlobalDrawer(false)}
            >
                <div className="w-[320px] bg-white border border-slate-200 shadow-2xl rounded-r-xl h-[60vh] flex flex-col p-6 overflow-hidden">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Book size={20} className="text-purple-600"/> 全文写作指引</h3>
                    <div className="flex-1 overflow-y-auto prose prose-sm prose-slate">
                        <ReactMarkdown>{globalGuide.globalOverview}</ReactMarkdown>
                    </div>
                </div>
                <div className="flex items-center">
                    <button className="bg-white border border-l-0 border-slate-200 p-2 rounded-r-lg shadow-md hover:text-primary">
                        <Book size={20} />
                    </button>
                </div>
            </div>
        )}

        {/* LEFT SIDEBAR (Level 2 Navigation) */}
        {!isLeftCollapsed && (
            <div style={{ width: leftWidth }} className="bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0">
                {/* Tools Tabs */}
                <div className="flex border-b bg-white text-xs font-bold">
                    <button onClick={() => setSidebarTab('directory')} className={`flex-1 py-3 text-center ${sidebarTab === 'directory' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}><List size={14} className="inline mr-1"/> 本章目录</button>
                    <button onClick={() => setSidebarTab('reviews')} className={`flex-1 py-3 text-center ${sidebarTab === 'reviews' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}><CheckSquare size={14} className="inline mr-1"/> 本章评审</button>
                </div>

                {sidebarTab === 'directory' ? (
                     <div className="flex-1 overflow-y-auto">
                        {subNodes.length === 0 ? (
                            <div className="p-4 text-xs text-slate-400 text-center">无子章节</div>
                        ) : (
                            <div className="space-y-1 p-2">
                                {subNodes.map((child, idx) => {
                                    const isActive = child.id === activeSubNodeId;
                                    const isLocked = idx > 0 && (!subNodes[idx-1].content || subNodes[idx-1].content.length < 50);
                                    
                                    return (
                                        <div key={child.id} className="flex flex-col">
                                            <button
                                                onClick={() => !isLocked && setActiveSubNodeId(child.id)}
                                                disabled={isLocked}
                                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-all ${
                                                    isActive ? 'bg-white shadow text-primary font-bold border border-slate-100' : 
                                                    isLocked ? 'opacity-50 cursor-not-allowed text-slate-400' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                                }`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-primary' : isLocked ? 'bg-slate-300' : 'bg-slate-400'}`} />
                                                <span className="truncate flex-1">{child.title}</span>
                                                {(child.status === 'done' || (child.content && child.content.length>50)) && <Check size={14} className="text-green-500"/>}
                                            </button>
                                            
                                            {/* Inline Writing Points for Active Sub-Node */}
                                            {isActive && (
                                                <div className="ml-4 mt-1 mb-2 pl-3 border-l-2 border-slate-200 animate-in slide-in-from-left-2 duration-300">
                                                    <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">本节要点</div>
                                                    {writingPoints.length === 0 ? <div className="text-xs text-slate-300 italic">暂无要点</div> : 
                                                        writingPoints.map(wp => (
                                                            <div key={wp.id} className="mb-2 group">
                                                                <div className="flex gap-2 items-start">
                                                                    <button onClick={() => handleChatAboutText(wp.text, "核心要点")} className="mt-1 text-slate-300 hover:text-primary transition-colors shrink-0"><MessageSquare size={12} /></button>
                                                                    <textarea className="flex-1 bg-transparent border-b border-transparent focus:border-primary focus:outline-none resize-none overflow-hidden h-auto py-0 text-xs text-slate-700" rows={1} value={wp.text} onChange={(e) => handlePointChange(wp.id, e.target.value)} />
                                                                </div>
                                                                {wp.subPoints.map((sub, i) => (
                                                                     <div key={i} className="flex gap-2 items-start ml-5 mt-1">
                                                                         <button onClick={() => handleChatAboutText(sub, "细分要点")} className="mt-0.5 text-slate-300 hover:text-primary transition-colors shrink-0"><MessageSquare size={10} /></button>
                                                                         <textarea className="flex-1 bg-transparent border-b border-transparent focus:border-primary focus:outline-none resize-none overflow-hidden h-auto py-0 text-[10px] text-slate-500" rows={1} value={sub} onChange={(e) => handleSubPointChange(wp.id, i, e.target.value)} />
                                                                     </div>
                                                                ))}
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                     </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 bg-white space-y-4">
                        {!chapterReview ? (
                            <div className="text-center text-xs text-slate-400 py-10 flex flex-col items-center gap-2">
                                <ClipboardCheck size={24} className="opacity-50"/>
                                <p>本章暂无评审数据</p>
                                <p>请点击底部“评审本章”生成报告</p>
                            </div>
                        ) : (
                            <>
                                {/* Score */}
                                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                                    <div className="text-xs text-slate-500 uppercase tracking-wide font-bold mb-1">本章得分</div>
                                    <div className={`text-4xl font-black ${chapterReview.score >= 80 ? 'text-green-500' : chapterReview.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{chapterReview.score}</div>
                                </div>

                                {/* Summary */}
                                <div>
                                    <div className="text-xs font-bold text-slate-700 mb-2">评审综述</div>
                                    <div className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-100 p-3 rounded">{chapterReview.summary}</div>
                                </div>

                                {/* To-Do List */}
                                <div>
                                    <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                                        待办清单 (To-Do)
                                        <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-[10px]">{chapterReview.todos.length}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {chapterReview.todos.map((todo, i) => (
                                            <div 
                                                key={i} 
                                                onClick={() => handleToDoClick(todo)}
                                                className={`p-3 rounded border text-xs cursor-pointer transition-all ${activeToDo === todo ? 'bg-blue-50 border-primary ring-1 ring-primary' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <div className="flex gap-2">
                                                    <div className={`mt-0.5 w-3 h-3 rounded border flex items-center justify-center shrink-0 ${activeToDo === todo ? 'border-primary' : 'border-slate-300'}`}>
                                                        {activeToDo === todo && <div className="w-1.5 h-1.5 bg-primary rounded-full"/>}
                                                    </div>
                                                    <span className="text-slate-700 leading-snug">{todo}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        )}
        
        {/* Left Resizer & Trigger ... */}
        {!isLeftCollapsed && <div className="w-1 cursor-col-resize hover:bg-blue-400 bg-slate-200 transition-colors z-20 flex flex-col justify-center items-center group" onMouseDown={() => setIsResizing('left')}><GripVertical size={12} className="text-slate-400 opacity-0 group-hover:opacity-100"/></div>}
        {isLeftCollapsed && <div className="w-8 border-r bg-slate-50 flex flex-col items-center py-2 gap-2"><button onClick={() => setIsLeftCollapsed(false)} className="p-1 hover:bg-slate-200 rounded text-slate-500"><PanelLeftOpen size={16}/></button></div>}

        {/* CENTER EDITOR */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative h-full">
            
            {viewMode === 'split_generation' ? (
                // SPLIT GENERATION VIEW
                <div className="flex-1 flex h-full overflow-hidden">
                    {/* Left: Original / Full Chapter View (Editable) */}
                    <div className="flex-1 flex flex-col border-r border-slate-200 bg-white">
                        <div className="h-10 border-b flex items-center px-4 bg-slate-50 text-xs font-bold text-slate-500">
                             {generationContext === 'chapter' ? '全章预览 (合并视图)' : '原始版本 (可编辑)'}
                        </div>
                        <textarea 
                            value={localContent} 
                            onChange={e => setLocalContent(e.target.value)} 
                            className="flex-1 p-8 text-lg font-serif leading-relaxed outline-none resize-none"
                            readOnly={generationContext === 'chapter'} // Make chapter view readonly for safety in prototype
                        />
                    </div>
                    {/* Right: Generated (Editable) */}
                    <div className="flex-1 flex flex-col bg-purple-50/30">
                        <div className="h-10 border-b flex items-center justify-between px-4 bg-purple-50">
                             <span className="text-xs font-bold text-purple-700 flex items-center gap-2"><Sparkles size={14}/> {generationContext === 'chapter' ? 'AI 整合中...' : 'AI 生成中...'}</span>
                             <button onClick={handleAcceptGeneration} className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-purple-700 shadow-sm">
                                 <Check size={12}/> {generationContext === 'chapter' ? '保存为历史版本' : '接受并覆盖'}
                             </button>
                        </div>
                        <textarea 
                            value={generatedContent}
                            onChange={e => setGeneratedContent(e.target.value)}
                            className="flex-1 p-8 text-lg font-serif leading-relaxed outline-none resize-none bg-transparent"
                            placeholder="AI 正在生成..."
                        />
                    </div>
                </div>
            ) : (
                // NORMAL EDITOR VIEW
                <>
                {/* Chapter Guide Ticker */}
                <div 
                    className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 cursor-pointer relative overflow-hidden group"
                    onClick={() => setShowChapterGuidePopup(!showChapterGuidePopup)}
                >
                    <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
                        <Info size={14} className="shrink-0 animate-pulse"/>
                        <span className="whitespace-nowrap font-bold">本章指引：</span>
                        <div className="flex-1 overflow-hidden relative h-5">
                            <span className="absolute animate-[marquee_15s_linear_infinite] whitespace-nowrap group-hover:animate-none">
                                {currentChapterGuide}
                            </span>
                        </div>
                        <ChevronDown size={14} className="shrink-0 text-amber-500"/>
                    </div>
                    
                    {/* Chapter Guide Popup */}
                    {showChapterGuidePopup && (
                        <div className="absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-lg p-4 z-50 animate-in slide-in-from-top-2">
                             <h4 className="font-bold text-sm mb-2 text-slate-800">章节写作深度指引</h4>
                             <p className="text-sm text-slate-600 leading-relaxed">{currentChapterGuide}</p>
                        </div>
                    )}
                </div>

                {/* Header with Save Button */}
                <div className="absolute top-10 right-4 z-10 flex gap-2">
                    <button onClick={handleManualSave} className="flex items-center gap-1 bg-white/80 backdrop-blur border border-slate-200 shadow-sm px-3 py-1.5 rounded-full text-xs text-slate-600 hover:text-primary hover:bg-white transition-all">
                        <Save size={14} /> 保存当前版本
                    </button>
                </div>

                {/* Sub-Section Title in Editor Area */}
                <div className="px-8 pt-8 pb-2">
                     <h2 className="text-2xl font-bold text-slate-800 font-serif">{activeSubNode?.title || "请选择小节"}</h2>
                </div>

                {!ghostText ? (
                <>
                    <textarea ref={textareaRef} value={localContent} onChange={(e) => handleContentChange(e.target.value)} onDoubleClick={handleDoubleClick} onMouseUp={updateEditorInternalState} onKeyUp={updateEditorInternalState} onScroll={updateEditorInternalState} className="flex-1 w-full px-8 pb-12 pt-4 text-lg leading-relaxed text-slate-800 border-none focus:ring-0 resize-none font-serif outline-none bg-transparent overflow-y-auto h-full" placeholder="在此写作..." />
                    <div ref={mirrorRef} className="absolute top-0 left-0 px-8 pb-12 pt-4 w-full h-full pointer-events-none opacity-0 whitespace-pre-wrap font-serif text-lg leading-relaxed border-none overflow-hidden" />
                </>
                ) : (
                    <div ref={ghostViewRef} className="flex-1 w-full px-8 pb-12 pt-4 text-lg leading-relaxed font-serif outline-none bg-transparent overflow-y-auto whitespace-pre-wrap focus:outline-none relative h-full" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); handleAcceptGhost(); } if (e.key === 'Escape') { e.preventDefault(); handleDiscardGhost(); } }}>
                        <span className="text-slate-800">{localContent.substring(0, selectionIndex)}</span>
                        {isGhostEditable ? <textarea autoFocus value={ghostText} onChange={e => setGhostText(e.target.value)} className="bg-purple-50 text-slate-700 border-b-2 border-purple-200 outline-none w-full resize-y min-h-[100px] overflow-hidden p-1 rounded" onClick={e => e.stopPropagation()} /> : <span className="bg-purple-50 text-slate-500 border-b-2 border-purple-200 animate-pulse">{ghostText}</span>}
                        <span className="text-slate-800">{localContent.substring(selectionIndex)}</span>
                        
                        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-purple-100 p-4 rounded-xl animate-in slide-in-from-bottom-5 flex items-center gap-4">
                            <div className="flex items-center gap-2 text-purple-600 font-bold"><Sparkles size={18} /> {isGhostEditable ? "确认回插编辑内容" : "AI 生成预览"}</div>
                            <div className="h-6 w-px bg-slate-200" />
                            <div className="flex gap-2 text-xs">
                                {isGhostEditable ? <button onClick={handleAcceptGhost} className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1 rounded font-bold shadow hover:bg-purple-700"><Check size={12}/> 确认回插</button> : <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200 text-slate-600 font-medium shadow-sm"><Keyboard size={12}/> Tab 接受</div>}
                                <button onClick={handleDiscardGhost} className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200 text-slate-400 hover:bg-slate-50">Esc 放弃</button>
                            </div>
                            {pendingSaveType === 'partial_merge' && <div className="ml-2 pl-4 border-l border-slate-200 flex items-center gap-2"><input type="checkbox" id="saveMerge" checked={saveMergeToHistory} onChange={e => setSaveMergeToHistory(e.target.checked)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"/><label htmlFor="saveMerge" className="text-xs text-slate-600 cursor-pointer">保存为历史版本</label></div>}
                        </div>
                    </div>
                )}
                </>
            )}
            
            {/* FLOATING MENU */}
            {menuVisible && caretPos && !ghostText && viewMode === 'editor' && (
                <div style={{ top: caretPos.top, left: caretPos.left }} className="fixed z-[9999] flex items-center gap-1 bg-white p-1.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 animate-in fade-in zoom-in duration-200 scale-100 origin-top-left floating-menu" onMouseDown={preventBlur}>
                    {!aiInputMode ? (
                        <>
                            <button onClick={handleQuoteSelection} className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-full transition-colors" title="引用"><Quote size={18} /></button>
                            <button onClick={handleChatSelection} className="p-2 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-full transition-colors" title="对话"><MessageSquare size={18} /></button>
                            {isEditorSelection && <><div className="w-px h-4 bg-slate-200 mx-1"></div><button onClick={() => setAiInputMode(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-full hover:bg-blue-600 transition-colors shadow-sm"><Wand2 size={16} /><span className="text-xs font-bold">AI</span></button></>}
                        </>
                    ) : (
                        <div className="flex items-center gap-2 px-2">
                            <input value={aiInputValue} onChange={e => setAiInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSmartSubmit()} autoFocus placeholder={selectionRange && selectionRange.start !== selectionRange.end ? "改写选区..." : "续写..."} className="w-48 bg-transparent text-sm focus:outline-none text-slate-700" />
                            <button onClick={handleSmartSubmit} className="p-1.5 bg-primary text-white rounded-full hover:bg-blue-600"><ArrowUp size={14} /></button>
                            {(!selectionRange || selectionRange.start === selectionRange.end) && <><div className="w-px h-4 bg-slate-200 mx-1"></div><button onClick={handleFullWrite} className="text-xs text-purple-600 font-bold hover:bg-purple-50 px-2 py-1 rounded whitespace-nowrap" title="一键全文">✨ 全文</button></>}
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Chapter Action Bar */}
            {viewMode === 'editor' && (
            <div className="border-t bg-white p-4 flex items-center justify-between gap-4 shrink-0 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                    {allSubNodesHaveContent ? <Check size={14} className="text-green-500"/> : <CircleDashed size={14} />}
                    {allSubNodesHaveContent ? "本章小节均有内容" : `还有 ${subNodes.filter(n => !n.content || n.content.length <= 20).length} 个小节需补充内容`}
                </div>
                <div className="flex gap-3">
                    <button 
                        disabled={!canChapterAction}
                        onClick={handleChapterPolish}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${canChapterAction ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    >
                        {isPolishingChapter ? <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"/> : <Sparkles size={14}/>} 全章润色
                    </button>
                    <button 
                        disabled={!canReview}
                        onClick={handleChapterReview}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${canReview ? 'bg-primary text-white hover:bg-blue-600 shadow' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    >
                        {isReviewing ? <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"/> : <CheckSquare size={14}/>} 评审本章
                    </button>
                </div>
            </div>
            )}

        </div>
        
        {/* Right Resizer ... */}
        {!isRightCollapsed && <div className="w-1 cursor-col-resize hover:bg-blue-400 bg-slate-200 transition-colors z-20 flex flex-col justify-center items-center group" onMouseDown={() => setIsResizing('right')}><GripVertical size={12} className="text-slate-400 opacity-0 group-hover:opacity-100"/></div>}
        {isRightCollapsed && <div className="w-8 border-l bg-slate-50 flex flex-col items-center py-2 gap-2"><button onClick={() => setIsRightCollapsed(false)} className="p-1 hover:bg-slate-200 rounded text-slate-500"><PanelRightOpen size={16}/></button></div>}
        
        {/* RIGHT SIDEBAR */}
        {!isRightCollapsed && (
            <div style={{ width: rightWidth }} className="bg-white border-l border-slate-200 shrink-0 relative flex flex-col z-20 shadow-xl h-full">
                 
                 {/* Top Tabs */}
                 <div className="flex justify-between items-center p-2 border-b bg-slate-50">
                     <div className="flex gap-2">
                         <button onClick={() => setRightTab('chat')} className={`text-xs font-bold px-3 py-1 rounded ${rightTab === 'chat' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>通用助手</button>
                         <button onClick={() => setRightTab('history')} className={`text-xs font-bold px-3 py-1 rounded ${rightTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>历史版本</button>
                     </div>
                     <button onClick={() => setIsRightCollapsed(true)} className="p-1 hover:bg-slate-200 rounded text-slate-500"><PanelRightClose size={14}/></button>
                 </div>

                 {rightTab === 'chat' ? (
                     <>
                     {/* "I CAN..." Dynamic Header */}
                     {activeSubNode && !activeToDo && (
                         <div className="bg-purple-50 border-b border-purple-100 p-4 shrink-0">
                             <div className="flex items-center gap-2 text-purple-800 font-bold text-sm mb-2">
                                 <Lightbulb size={16} className="text-purple-600"/>
                                 我能帮您完成 {activeSubNode.title.split(' ')[0]} ...
                             </div>
                             <div className="space-y-2">
                                 <button onClick={handleFullWrite} className="w-full text-left bg-white border border-purple-200 hover:border-purple-400 hover:bg-purple-50 rounded-lg p-2.5 transition-all group flex items-center justify-between shadow-sm">
                                     <div>
                                         <div className="text-xs font-bold text-purple-700 flex items-center gap-1"><Wand2 size={12}/> 一键代写本小节</div>
                                         <div className="text-[10px] text-slate-400 mt-0.5">基于大纲要点自动生成初稿（双栏对比）</div>
                                     </div>
                                     <Play size={14} className="text-purple-300 group-hover:text-purple-600 fill-current"/>
                                 </button>
                                 <div className="grid grid-cols-2 gap-2">
                                     {writingPoints.slice(0, 2).map((wp, i) => (
                                         <button key={i} onClick={() => handleChatAboutText(wp.text, "写作建议")} className="text-left bg-white border border-slate-200 hover:border-purple-300 p-2 rounded text-[10px] text-slate-600 truncate hover:text-purple-700 transition-colors">
                                             <span className="font-bold mr-1">?</span> 如何写: {wp.text}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* Context-aware "I Can..." for To-Do */}
                     {activeToDo && (
                         <div className="bg-amber-50 border-b border-amber-100 p-4 shrink-0 animate-in slide-in-from-right">
                             <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                                    <CheckSquare size={16} className="text-amber-600"/>
                                    针对此问题，我能...
                                </div>
                                {/* Auto-switch replaces explicit close button */}
                             </div>
                             <div className="text-xs text-slate-600 mb-3 line-clamp-2 italic bg-white/50 p-2 rounded">
                                 "{activeToDo}"
                             </div>
                             <div className="space-y-2">
                                 <button onClick={() => handleAutoFixToDo(activeToDo)} className="w-full text-left bg-white border border-amber-200 hover:border-amber-400 hover:bg-amber-50 rounded-lg p-2.5 transition-all group flex items-center justify-between shadow-sm">
                                     <div>
                                         <div className="text-xs font-bold text-amber-700 flex items-center gap-1"><Wand2 size={12}/> 一键修复/回答</div>
                                         <div className="text-[10px] text-slate-400 mt-0.5">AI 自动生成修改建议或回答</div>
                                     </div>
                                     <ArrowRight size={14} className="text-amber-300 group-hover:text-amber-600"/>
                                 </button>
                                 <button onClick={() => handleChatAboutText(activeToDo, "待办事项")} className="w-full text-left bg-white border border-slate-200 hover:border-amber-300 p-2 rounded text-xs text-slate-600 hover:text-amber-700 transition-colors flex items-center gap-2">
                                     <MessageSquare size={12}/> 讨论此问题
                                 </button>
                             </div>
                         </div>
                     )}

                    <ChatAssistant 
                        currentContext={localContent} 
                        sessions={chatSessions} 
                        setSessions={setChatSessions} 
                        onMergeMessages={handleMergeMessages} 
                        onMergeWithInstruction={handleMergeWithInstruction} 
                        activeReferences={activeReferences} 
                        onRemoveReference={(id) => setActiveReferences(prev => prev.filter(r => r.id !== id))} 
                        hasEditorSelection={Boolean(hasSelection)}
                        mergeContext={mergeContext}
                        onUpload={() => alert("模拟上传资料成功")}
                    />
                    </>
                 ) : (
                     <div className="flex-1 flex flex-col">
                         <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                             {(!activeSubNode?.history || activeSubNode.history.length === 0) ? (
                                 <div className="text-center text-xs text-slate-400 py-10 flex flex-col items-center gap-2"><History size={24} className="opacity-50"/>暂无历史版本</div>
                             ) : (
                                 <div className="space-y-4">
                                     {[...activeSubNode.history].reverse().map((ver, idx) => {
                                         const prevVer = activeSubNode.history![activeSubNode.history!.length - idx - 2];
                                         const isExpanded = expandedHistoryIds.has(ver.id);
                                         
                                         return (
                                         <div key={ver.id} className="bg-white p-3 rounded border border-slate-200 shadow-sm relative group">
                                             <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => toggleHistoryExpand(ver.id)}>
                                                 <div className="flex items-center gap-2">
                                                    <button className="text-slate-400 hover:text-slate-600">{isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>
                                                    <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold">V{activeSubNode.history!.length - idx}</span>
                                                    <span className="text-xs text-slate-400">{new Date(ver.timestamp).toLocaleTimeString()}</span>
                                                    {ver.type === 'partial_merge' && <span className="bg-purple-100 text-purple-700 text-[10px] px-1 rounded">局部整合</span>}
                                                    {ver.type === 'full_polish' && <span className="bg-green-100 text-green-700 text-[10px] px-1 rounded">全文润色</span>}
                                                    {ver.type === 'smart_edit' && <span className="bg-blue-100 text-blue-700 text-[10px] px-1 rounded">AI改写</span>}
                                                    {ver.type === 'ai_gen' && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1 rounded">一键代写</span>}
                                                 </div>
                                                 <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     <button onClick={(e) => { e.stopPropagation(); setViewingDiff({old: ver.content, new: localContent})}} className="text-xs text-slate-500 hover:text-primary flex items-center gap-1"><FileDiff size={12}/> 对比</button>
                                                     <button onClick={(e) => { e.stopPropagation(); handleRestoreVersion(ver)}} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><RotateCcw size={12}/> 恢复</button>
                                                 </div>
                                             </div>
                                             <div className="text-xs font-bold text-slate-700 mb-1 pl-6">{ver.note || "自动保存"}</div>
                                             {isExpanded ? (
                                                  <div className="text-[10px] bg-slate-50 p-2 rounded ml-6 border border-slate-100 max-h-60 overflow-y-auto">
                                                      {(ver.type === 'partial_merge' || ver.type === 'smart_edit') && prevVer ? (
                                                          <HelperDiffRenderer currentContent={ver.content} previousContent={prevVer.content} />
                                                      ) : (
                                                          <div className="whitespace-pre-wrap text-slate-500">{ver.content}</div>
                                                      )}
                                                  </div>
                                             ) : (
                                                  <div className="text-[10px] text-slate-400 line-clamp-1 ml-6">{ver.content.substring(0, 50)}...</div>
                                             )}
                                         </div>
                                     )})}
                                 </div>
                             )}
                         </div>
                     </div>
                 )}
            </div>
        )}
    </div>
  );
};

export default WriterInterface;
