
import React, { useState, useMemo } from 'react';
import { generateOutlineFromMaterials, generateFullReview, generateGlobalWritingGuide, polishContent, DEFAULT_PROMPTS } from './services/geminiService';
import OutlineEditor from './components/OutlineEditor';
import WriterInterface from './components/WriterInterface';
import PromptExpertDashboard from './components/PromptExpertDashboard';
import { OutlineNode, ViewState, MOCK_USERS, User, ReviewComment, PromptsConfig, ChatSession, VersionType, Version, GlobalGuide } from './types';
import { BookOpen, CheckCircle, UploadCloud, ChevronRight, Menu, FileText, CheckCheck, CircleDashed, Loader2, Users, Layout, Zap, Info, Sparkles, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('setup');
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [fullReview, setFullReview] = useState<string>("");
  
  // Global Guide State
  const [globalGuide, setGlobalGuide] = useState<GlobalGuide | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Final Preview & Polish State
  const [fullPolishContent, setFullPolishContent] = useState("");
  const [isPolishingFull, setIsPolishingFull] = useState(false);

  // Expert Config
  const [customPrompts, setCustomPrompts] = useState<PromptsConfig>(DEFAULT_PROMPTS);
  const [expertOutline, setExpertOutline] = useState<string[]>([]);

  // Chat Sessions (Global)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
      { id: 'default', title: '通用助手', messages: [], createdAt: Date.now(), isActive: true }
  ]);

  // Setup State
  const [topic, setTopic] = useState("人工智能对现代教育的影响");
  const [concept, setConcept] = useState("核心是探讨AI如何从工具转变为协作伙伴，重点关注个性化学习路径的生成。");
  const [materials, setMaterials] = useState<string>("模拟PDF内容：'2024年AI进校园报告'...");
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingFullReview, setIsGeneratingFullReview] = useState(false);

  const handleGenerateOutline = async () => {
    setIsGeneratingOutline(true);
    // 1. Generate Outline
    const nodes = await generateOutlineFromMaterials(
        topic, 
        concept,
        materials, 
        expertOutline, 
        customPrompts.outline_gen
    );
    setOutline(nodes);
    
    // 2. Generate Global Guide immediately
    const guide = await generateGlobalWritingGuide(topic, concept, materials, nodes);
    setGlobalGuide(guide);
    
    setIsGeneratingOutline(false);
    setView('outline');
    // After outline review, user will go to writing, but let's prep the guide.
    // Logic update: User views Outline editor first, then clicks "Start Writing".
    // We should show the Guide Modal AFTER Outline confirmation.
  };

  const confirmOutlineAndStart = () => {
      // Logic: Click "Start Writing" from OutlineEditor triggers this.
      // Show Guide Modal first.
      setShowGuideModal(true);
  }

  const handleGuideModalClose = () => {
      setShowGuideModal(false);
      setView('writing');
      if(!activeSectionId && outline.length) setActiveSectionId(outline[0].id);
  }

  const handleUpdateContent = (id: string, content: string) => {
    setOutline(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  };

  const handleUpdateStatus = (id: string, status: 'draft' | 'reviewing' | 'done') => {
      setOutline(prev => prev.map(n => n.id === id ? { ...n, status } : n));
  };

  const handleAddReview = (id: string, reviews: ReviewComment[]) => {
    // Deprecated: Review system moved to structured chapterReview
    console.warn("Legacy onAddReview called. Use updateChapterReview instead.");
  };

  const handleSaveVersion = (id: string, content: string, note?: string, type: VersionType = 'manual') => {
      setOutline(prev => prev.map(n => {
          if (n.id === id) {
              const newVersion: Version = {
                  id: Date.now().toString(),
                  timestamp: Date.now(),
                  content,
                  note,
                  type
              };
              return {
                  ...n,
                  history: [...(n.history || []), newVersion]
              };
          }
          return n;
      }));
  };

  const handleFullReview = async () => {
      setIsGeneratingFullReview(true);
      const result = await generateFullReview(outline);
      setFullReview(result);
      setIsGeneratingFullReview(false);
      setView('final_review');
  }

  const handleFullPolish = async () => {
      setIsPolishingFull(true);
      const text = getAllContent();
      setFullPolishContent("");
      await polishContent(text, (chunk) => setFullPolishContent(chunk));
      setIsPolishingFull(false);
  }
  
  const getAllContent = () => {
      // Aggregate L2 content up to L1, then join L1s.
      // Current Structure: L1 has children (L2) but content is stored in L2?
      // Wait, outline array is flat.
      // L1 nodes are headers. L2 nodes have content.
      // We need to reconstruct the full document.
      const l1Nodes = outline.filter(n => n.level === 1);
      return l1Nodes.map(l1 => {
          const l2Nodes = outline.filter(n => n.parentId === l1.id);
          const l2Content = l2Nodes.map(l2 => `## ${l2.title}\n\n${l2.content || ''}`).join('\n\n');
          return `# ${l1.title}\n\n${l2Content}`;
      }).join('\n\n');
  }

  const activeNode = outline.find(n => n.id === activeSectionId) || outline[0];
  const level1Nodes = outline.filter(n => n.level === 1);

  // Stats
  const progress = useMemo(() => {
      if (outline.length === 0) return 0;
      const done = outline.filter(n => n.status === 'done').length;
      return Math.round((done / outline.length) * 100);
  }, [outline]);

  // Expert Switcher
  const switchUser = (userId: string) => {
    const user = MOCK_USERS.find(u => u.id === userId);
    if (user) {
        setCurrentUser(user);
        if (user.role === 'prompt_expert') setView('expert_dashboard');
        else setView('setup');
    }
  }

  if (currentUser.role === 'prompt_expert' || view === 'expert_dashboard') {
      return <PromptExpertDashboard prompts={customPrompts} expertOutline={expertOutline} onSavePrompts={setCustomPrompts} onSaveOutline={setExpertOutline} />;
  }

  if (view === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <BookOpen className="text-primary"/> 新建写作项目
            </h1>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">项目主题</label>
                    <input className="w-full border rounded px-3 py-2" value={topic} onChange={e => setTopic(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">核心构想 (Concept)</label>
                    <textarea 
                        className="w-full border rounded px-3 py-2 h-24" 
                        value={concept} 
                        onChange={e => setConcept(e.target.value)}
                        placeholder="描述你的核心观点、创新点或主要论证逻辑..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">参考资料摘要</label>
                    <textarea className="w-full border rounded px-3 py-2 h-24" value={materials} onChange={e => setMaterials(e.target.value)} />
                </div>
                
                <button 
                    onClick={handleGenerateOutline}
                    disabled={isGeneratingOutline}
                    className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-blue-600 flex justify-center items-center gap-2"
                >
                    {isGeneratingOutline ? <Loader2 className="animate-spin"/> : <Zap size={18}/>}
                    {isGeneratingOutline ? "正在规划大纲..." : "智能生成大纲 (一级章节 + 写作要点)"}
                </button>
            </div>
            
            {/* Dev Role Switcher */}
            <div className="mt-8 pt-4 border-t flex justify-between items-center text-xs text-slate-400">
                <span>CoAuthor AI v2.0</span>
                <select value={currentUser.id} onChange={e => switchUser(e.target.value)} className="bg-slate-100 rounded p-1">
                    {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden relative">
      {/* Global Guide Modal */}
      {showGuideModal && globalGuide && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-full text-purple-600"><Info size={24} /></div>
                      <div>
                          <h2 className="text-2xl font-bold text-slate-800">全文写作指导</h2>
                          <p className="text-slate-500 text-sm">AI 基于您的构想生成的整体策略建议</p>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 prose prose-slate max-w-none">
                      <ReactMarkdown>{globalGuide.globalOverview}</ReactMarkdown>
                  </div>
                  <div className="p-6 border-t bg-slate-50 flex justify-end">
                      <button 
                          onClick={handleGuideModalClose}
                          className="px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-lg flex items-center gap-2"
                      >
                          我知道了，开始写作 <ChevronRight size={18} />
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 w-64">
            <div className="p-1.5 bg-primary text-white rounded"><BookOpen size={16} /></div>
            <h1 className="font-bold text-slate-800 truncate text-sm">{topic}</h1>
        </div>
        
        {/* View Switcher */}
        <div className="flex bg-slate-100 rounded p-1 mx-4">
            <button onClick={() => setView('outline')} className={`px-4 py-1 text-xs rounded transition-all ${view === 'outline' ? 'bg-white shadow text-primary font-bold' : 'text-slate-500 hover:text-slate-700'}`}>大纲</button>
            <button onClick={() => { if(!activeSectionId && outline.length) setActiveSectionId(outline[0].id); if(globalGuide) setView('writing'); else setView('writing'); }} className={`px-4 py-1 text-xs rounded transition-all ${view === 'writing' ? 'bg-white shadow text-primary font-bold' : 'text-slate-500 hover:text-slate-700'}`}>写作</button>
            <button onClick={() => setView('final_preview')} className={`px-4 py-1 text-xs rounded transition-all ${view === 'final_preview' ? 'bg-white shadow text-primary font-bold' : 'text-slate-500 hover:text-slate-700'}`}>全文预览</button>
            <button onClick={() => setView('final_review')} className={`px-4 py-1 text-xs rounded transition-all ${view === 'final_review' ? 'bg-white shadow text-primary font-bold' : 'text-slate-500 hover:text-slate-700'}`}>全文评审</button>
        </div>

        <div className="flex items-center gap-2 w-64 justify-end">
            <span className="text-xs text-slate-400">进度: {progress}%</span>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                {currentUser.avatar}
            </div>
        </div>
      </header>

      {/* Top Level 1 Navigation (Full Width with Status Bar) */}
      {view === 'writing' && (
          <div className="bg-white border-b flex items-stretch px-0 shrink-0 z-20 shadow-sm overflow-x-auto">
              <div className="flex w-full">
                {level1Nodes.map((node, index) => {
                    const isActive = activeSectionId === node.id || outline.find(n => n.id === activeSectionId)?.parentId === node.id;
                    const isDone = node.status === 'done';
                    const isReviewing = node.status === 'reviewing';
                    
                    return (
                        <button
                            key={node.id}
                            onClick={() => setActiveSectionId(node.id)}
                            className={`flex-1 group relative px-4 py-3 text-center transition-colors border-r border-slate-100 last:border-r-0 flex flex-col items-center justify-center gap-1 min-w-[120px] ${
                                isActive ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center gap-2 w-full justify-center">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    {index + 1}
                                </span>
                                <span className={`text-sm font-medium truncate max-w-[120px] ${isActive ? 'text-primary' : 'text-slate-600'}`}>
                                    {node.title}
                                </span>
                            </div>
                            
                            {/* Status Bar Indicator */}
                            <div className={`absolute bottom-0 left-0 w-full h-1.5 transition-colors ${
                                isDone ? 'bg-green-500' :
                                (isReviewing || node.content.length > 0) ? 'bg-yellow-400' : 'bg-transparent'
                            }`} />
                        </button>
                    );
                })}
              </div>
          </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
          {view === 'outline' && <div className="flex-1 overflow-y-auto bg-slate-50"><OutlineEditor outline={outline} setOutline={setOutline} onNavigateToWriter={confirmOutlineAndStart} /></div>}
          
          {view === 'writing' && activeNode && (
               <WriterInterface 
                    activeNode={activeNode}
                    outline={outline} 
                    setOutline={setOutline}
                    currentUser={currentUser}
                    users={MOCK_USERS}
                    onUpdateContent={handleUpdateContent}
                    onUpdateStatus={handleUpdateStatus}
                    onAddReview={handleAddReview}
                    onSaveVersion={handleSaveVersion}
                    customPrompts={customPrompts}
                    chatSessions={chatSessions}
                    setChatSessions={setChatSessions}
                    materials={materials}
                    globalGuide={globalGuide || undefined}
               />
          )}

          {view === 'final_preview' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
                      <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Layout size={20} className="text-primary"/> 全文预览与润色</h2>
                      <button 
                          onClick={handleFullPolish} 
                          disabled={isPolishingFull}
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                          {isPolishingFull ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                          {isPolishingFull ? "正在全速润色..." : "一键全文润色"}
                      </button>
                  </div>
                  
                  <div className="flex-1 flex overflow-hidden">
                       {/* Left: Original (Aggregated) */}
                       <div className="flex-1 border-r bg-slate-50 flex flex-col min-w-0">
                           <div className="p-3 text-xs font-bold text-slate-500 uppercase text-center border-b bg-slate-100 flex items-center justify-center gap-2">
                               <FileText size={14}/> 拼接原文 (预览)
                           </div>
                           <div className="flex-1 overflow-y-auto p-10">
                               <article className="prose prose-slate max-w-none">
                                   <ReactMarkdown>{getAllContent()}</ReactMarkdown>
                               </article>
                           </div>
                       </div>
                       
                       {/* Right: Polished (Result) */}
                       <div className="flex-1 bg-white flex flex-col min-w-0 shadow-[0_0_20px_rgba(0,0,0,0.05)] z-10">
                           <div className="p-3 text-xs font-bold text-purple-600 uppercase text-center border-b bg-purple-50 flex items-center justify-center gap-2">
                               <Sparkles size={14}/> 润色结果
                           </div>
                           {fullPolishContent ? (
                               <textarea 
                                   value={fullPolishContent}
                                   readOnly
                                   className="flex-1 p-10 resize-none focus:outline-none font-serif text-lg leading-relaxed text-slate-800"
                               />
                           ) : (
                               <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4">
                                   <Sparkles size={48} className="opacity-20"/>
                                   <p>点击上方按钮开始生成全文润色版</p>
                               </div>
                           )}
                       </div>
                  </div>
              </div>
          )}

          {view === 'final_review' && (
              <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                  <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-xl p-10 min-h-full">
                      <div className="flex justify-between items-center mb-8 border-b pb-6">
                        <h2 className="text-3xl font-bold text-slate-800">全文评审报告</h2>
                        <button onClick={handleFullReview} className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 font-bold shadow-sm flex items-center gap-2">
                            <Zap size={18}/> 生成评审
                        </button>
                      </div>
                      {isGeneratingFullReview ? (
                          <div className="py-20 text-center text-slate-400 animate-pulse">
                              正在深度分析全文逻辑与结构...
                          </div>
                      ) : (
                          <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-primary">
                              <ReactMarkdown>{fullReview || "点击上方按钮开始全文评审..."}</ReactMarkdown>
                          </article>
                      )}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default App;
