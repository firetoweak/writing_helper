import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatSession, Reference } from '../types';
import { queryAssistant, generateDetailedInfo } from '../services/geminiService';
import { Send, X, Bot, Menu, Plus, CheckSquare, Pencil, Trash2, Merge, Paperclip, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  currentContext: string;
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  onMergeMessages: (messages: ChatMessage[]) => void;
  onMergeWithInstruction?: (messages: ChatMessage[], instruction: string) => void;
  activeReferences?: Reference[];
  onRemoveReference?: (id: string) => void;
  hasEditorSelection?: boolean;
  mergeContext?: 'section' | 'chapter';
  onUpload?: () => void;
}

const ChatAssistant: React.FC<Props> = ({ currentContext, sessions, setSessions, onMergeMessages, onMergeWithInstruction, activeReferences = [], onRemoveReference, hasEditorSelection = false, mergeContext = 'section', onUpload }) => {
  const [showDrawer, setShowDrawer] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState<Set<string>>(new Set());
  
  // Edit State
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Merge Instruction State
  const [showMergeInput, setShowMergeInput] = useState(false);
  const [mergeInstruction, setMergeInstruction] = useState("");
  
  // Selected Messages Popover State
  const [showSelectedPopover, setShowSelectedPopover] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find(s => s.isActive) || sessions[0];

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current && !editingMsgId) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSession?.messages?.length, activeSession?.messages?.[activeSession.messages.length - 1]?.text]);

  const handleCreateSession = () => {
      const newSession: ChatSession = {
          id: Date.now().toString(),
          title: `新对话 ${sessions.length + 1}`,
          isActive: true,
          messages: [],
          createdAt: Date.now()
      };
      setSessions(prev => prev.map(s => ({...s, isActive: false})).concat(newSession));
      setShowDrawer(false);
  };

  const handleSwitchSession = (id: string) => {
      setSessions(prev => prev.map(s => ({...s, isActive: s.id === id})));
      setShowDrawer(false);
  };
  
  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (sessions.length <= 1) {
          alert("至少保留一个会话");
          return;
      }
      if (confirm("确定要删除此会话吗？")) {
          const newSessions = sessions.filter(s => s.id !== id);
          setSessions(newSessions);
          if (activeSession.id === id) {
             const next = newSessions[0];
             setSessions(prev => prev.map(s => ({...s, isActive: s.id === next.id})));
          }
      }
  };

  // ✅ [重写] 发送消息逻辑 - 核心修复
  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || loading) return;

    setInput('');
    setLoading(true);
    
    // 1. 生成唯一 ID
    const now = Date.now();
    const userMsgId = `user-${now}`;
    const aiMsgId = `ai-${now}`;

    // 2. 乐观更新：一次性加入用户消息和 AI 占位
    setSessions(prev => prev.map(s => {
        if (s.id !== activeSession.id) return s;
        return {
            ...s,
            messages: [
                ...s.messages,
                { id: userMsgId, role: 'user', text: textToSend, timestamp: now },
                { id: aiMsgId, role: 'model', text: "...", timestamp: now } // 占位
            ]
        };
    }));

    try {
        // 3. 调用流式接口
        // 注意：queryAssistant 现在返回的是最终全量文本 (string)
        // 回调 (chunk) 也是全量文本
        await queryAssistant(textToSend, currentContext, activeReferences, (fullText) => {
            // 4. 流式更新：只更新 AI 消息的内容
            setSessions(prev => prev.map(s => {
                if (s.id !== activeSession.id) return s;
                return {
                    ...s,
                    messages: s.messages.map(m => 
                        m.id === aiMsgId ? { ...m, text: fullText } : m
                    )
                };
            }));
        });
    } catch (error) {
        console.error("Chat error:", error);
        setSessions(prev => prev.map(s => {
            if (s.id !== activeSession.id) return s;
            return {
                ...s,
                messages: s.messages.map(m => 
                    m.id === aiMsgId ? { ...m, text: "请求失败，请稍后重试。" } : m
                )
            };
        }));
    } finally {
        setLoading(false);
    }
  };

  const toggleSelectMessage = (msgId: string) => { const next = new Set(selectedMsgs); if (next.has(msgId)) next.delete(msgId); else next.add(msgId); setSelectedMsgs(next); };
  const handleDeleteMsg = (msgId: string) => { setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: s.messages.filter(m => m.id !== msgId) } : s)); };
  
  const handleMergeAction = () => { 
      if (selectedMsgs.size === 0) return; 
      let allMessages: ChatMessage[] = []; 
      sessions.forEach(s => allMessages.push(...s.messages)); 
      const targetMessages = allMessages.filter(m => selectedMsgs.has(m.id)); 
      
      if (hasEditorSelection && onMergeWithInstruction) { 
          if (!showMergeInput) { setShowMergeInput(true); return; } 
          if (mergeInstruction.trim()) { 
              onMergeWithInstruction(targetMessages, mergeInstruction); 
              resetMergeState(); 
          } else { 
              onMergeMessages(targetMessages); 
              resetMergeState(); 
          } 
      } else { 
          onMergeMessages(targetMessages); 
          resetMergeState(); 
      } 
  };
  
  const confirmMergeWithInstruction = () => { if (selectedMsgs.size === 0) return; let allMessages: ChatMessage[] = []; sessions.forEach(s => allMessages.push(...s.messages)); const targetMessages = allMessages.filter(m => selectedMsgs.has(m.id)); if (onMergeWithInstruction) { onMergeWithInstruction(targetMessages, mergeInstruction || "请整合这些内容"); resetMergeState(); } };
  const resetMergeState = () => { setSelectedMsgs(new Set()); setShowMergeInput(false); setMergeInstruction(""); };
  const startEditing = (msg: ChatMessage) => { setEditingMsgId(msg.id); setEditValue(msg.text); };
  const saveEdit = (msgId: string) => { setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: s.messages.map(m => m.id === msgId ? { ...m, text: editValue } : m) } : s)); setEditingMsgId(null); };

  // ✅ [重写] 详情生成 - 同样的流式修复
  const handleInfoItemClick = async (info: string) => {
      const newMsgId = `ai-info-${Date.now()}`;
      const newMsg: ChatMessage = { id: newMsgId, role: 'model', text: '...', timestamp: Date.now() };
      
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, messages: [...s.messages, newMsg] } : s));
      setLoading(true);

      try {
        await generateDetailedInfo(info, currentContext, (fullText) => {
            setSessions(prev => prev.map(s => s.id === activeSession.id ? {
                ...s,
                messages: s.messages.map(m => m.id === newMsgId ? { ...m, text: fullText } : m)
            } : s));
        });
      } finally {
        setLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Header (Fixed) */}
      <div className="h-10 border-b flex items-center justify-between px-3 bg-white shrink-0 z-10">
          <div className="flex items-center gap-2">
              <button onClick={() => setShowDrawer(true)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Menu size={16}/></button>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{activeSession?.title || "新对话"}</span>
          </div>
          <button onClick={handleCreateSession} className="p-1 hover:bg-slate-100 rounded text-primary"><Plus size={16}/></button>
      </div>

      {/* Drawer */}
      {showDrawer && (
          <div className="absolute inset-0 z-30 bg-black/20 flex" onClick={() => setShowDrawer(false)}>
              <div className="w-64 bg-white h-full shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-3 border-b font-bold text-sm text-slate-700">对话列表</div>
                  <div className="flex-1 overflow-y-auto">
                      {sessions.map(s => (
                          <div key={s.id} onClick={() => handleSwitchSession(s.id)} className={`p-3 text-xs border-b cursor-pointer hover:bg-slate-50 flex justify-between items-center group ${s.isActive ? 'bg-blue-50 text-primary font-bold' : 'text-slate-600'}`}>
                              <div>
                                  {s.title}
                                  <div className="text-[10px] text-slate-400 mt-1">{new Date(s.createdAt).toLocaleString()}</div>
                              </div>
                              <button onClick={(e) => handleDeleteSession(e, s.id)} className="p-1.5 hover:bg-red-100 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={12}/>
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Messages (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {activeSession?.messages?.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isSelected = selectedMsgs.has(msg.id);
              return (
              <div key={msg.id} className={`group relative flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {isUser ? "Me" : <Bot size={16}/>}
                  </div>
                  
                  <div className={`flex-1 max-w-[85%] space-y-1`}>
                      <div className={`p-3 rounded-xl text-sm leading-relaxed shadow-sm ${
                          isUser ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'
                      }`}>
                          {/* Message Content */}
                          {editingMsgId === msg.id ? (
                              <div className="flex flex-col gap-2">
                                  <textarea autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full bg-slate-50 border p-2 rounded text-xs focus:outline-none min-h-[100px] text-slate-800"/>
                                  <div className="flex justify-end gap-2">
                                      <button onClick={() => setEditingMsgId(null)} className="text-xs text-slate-400">取消</button>
                                      <button onClick={() => saveEdit(msg.id)} className="text-xs bg-primary text-white px-2 py-1 rounded">保存</button>
                                  </div>
                              </div>
                          ) : (
                              <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
                                  <ReactMarkdown>{msg.text || "..."}</ReactMarkdown>
                              </div>
                          )}
                          
                          {/* AI Suggestions - I Can Provide */}
                          {!isUser && msg.suggestionData && msg.suggestionData.aiInfo.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-3">
                                  <div className="flex flex-col gap-1">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase">我能提供...</div>
                                      <div className="flex flex-col gap-2">
                                          {msg.suggestionData.aiInfo.map((info, i) => (
                                              <button key={i} onClick={() => handleInfoItemClick(info)} className="text-left bg-purple-50 border border-purple-100 rounded text-xs p-2 hover:bg-purple-100 cursor-pointer text-purple-700 flex items-center gap-2">
                                                  <Sparkles size={12}/> {info}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                      
                      {/* Message Actions */}
                      {!isUser && (
                          <div className="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => toggleSelectMessage(msg.id)} className={`p-1 rounded ${isSelected ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-100'}`} title="选择"><CheckSquare size={14}/></button>
                              <button onClick={() => startEditing(msg)} className="p-1 text-slate-400 hover:text-primary hover:bg-slate-100 rounded" title="编辑"><Pencil size={14}/></button>
                              <button onClick={() => handleDeleteMsg(msg.id)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded" title="删除"><Trash2 size={14}/></button>
                          </div>
                      )}
                      
                      {isUser && (
                          <div className="flex justify-end px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleDeleteMsg(msg.id)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded" title="删除"><Trash2 size={14}/></button>
                          </div>
                      )}
                  </div>
              </div>
          )})}
          {loading && !activeSession?.messages.some(m => m.role === 'model' && m.text === '...') && (
              // 备用 Loading 状态 (当占位消息未成功显示时)
              <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><Bot size={16}/></div>
                  <div className="bg-white border border-slate-200 p-3 rounded-xl text-xs text-slate-500 flex items-center gap-2 shadow-sm">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"/>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100"/>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200"/>
                  </div>
              </div>
          )}
      </div>

      {/* Input Area (Fixed Footer) */}
      <div className="p-4 bg-white border-t shrink-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
          {/* Reference Buffer */}
          {activeReferences.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                  {activeReferences.map(ref => (
                      <div key={ref.id} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] flex items-center gap-1 border border-blue-100 max-w-full">
                          <div className="shrink-0 font-bold">Ref:</div>
                          <span className="truncate max-w-[150px]">{ref.preview}</span>
                          <button onClick={() => onRemoveReference && onRemoveReference(ref.id)} className="hover:text-blue-900"><X size={10}/></button>
                      </div>
                  ))}
              </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-2 relative">
             <div className="flex gap-2">
                 <button onClick={onUpload} className="p-1.5 text-slate-500 hover:text-primary hover:bg-blue-50 rounded flex items-center gap-1 transition-colors text-xs font-medium" title="上传参考资料">
                     <Paperclip size={14}/> 上传
                 </button>
                 <button 
                    onClick={handleMergeAction} 
                    disabled={selectedMsgs.size === 0}
                    className={`p-1.5 rounded flex items-center gap-1 transition-colors text-xs font-bold ${
                        selectedMsgs.size > 0 ? 'text-purple-600 hover:bg-purple-50' : 'text-slate-300 cursor-not-allowed'
                    }`} 
                    title={hasEditorSelection ? "基于对话改写选区" : "基于对话润色全文"}
                 >
                     <Merge size={14}/> {mergeContext === 'chapter' ? '合入本章' : '合入本节'}
                 </button>
             </div>
             
             {/* Selected Messages Trigger & Popover */}
             {selectedMsgs.size > 0 && (
                 <div>
                    <button 
                        onClick={() => setShowSelectedPopover(!showSelectedPopover)}
                        className="text-[10px] text-slate-500 hover:text-primary underline flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200"
                    >
                        <CheckSquare size={10}/> 已选 {selectedMsgs.size} 条
                    </button>
                    {showSelectedPopover && (
                        <div className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-slate-200 shadow-xl rounded-lg p-2 z-50 max-h-60 overflow-y-auto animate-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-center mb-2 pb-1 border-b">
                                <span className="text-xs font-bold text-slate-700">已选消息</span>
                                <button onClick={() => setShowSelectedPopover(false)} className="text-slate-400 hover:text-slate-600"><X size={12}/></button>
                            </div>
                            <div className="space-y-1">
                                {sessions.flatMap(s => s.messages).filter(m => selectedMsgs.has(m.id)).map(m => (
                                    <div key={m.id} className="text-[10px] bg-slate-50 p-1.5 rounded flex justify-between gap-2 border border-slate-100">
                                        <span className="truncate flex-1 text-slate-600">{m.text}</span>
                                        <button onClick={() => toggleSelectMessage(m.id)} className="text-slate-400 hover:text-red-500 shrink-0"><X size={10}/></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => { setSelectedMsgs(new Set()); setShowSelectedPopover(false); }} className="w-full mt-2 text-[10px] text-red-500 hover:bg-red-50 py-1 rounded">清空选择</button>
                        </div>
                    )}
                 </div>
             )}
          </div>

          {/* Merge Instruction Input */}
          {showMergeInput && (
              <div className="absolute inset-x-4 bottom-20 bg-white border border-slate-200 shadow-xl rounded-lg p-3 animate-in slide-in-from-bottom-2 z-20">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-700">请输入整合指令</span>
                      <button onClick={resetMergeState} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                  </div>
                  <textarea 
                      autoFocus
                      value={mergeInstruction} 
                      onChange={e => setMergeInstruction(e.target.value)} 
                      placeholder="例如：结合这些观点，反驳选中的段落..." 
                      className="w-full text-xs p-2 border rounded mb-2 h-16 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="flex justify-end">
                      <button onClick={confirmMergeWithInstruction} className="bg-primary text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-blue-600">开始整合</button>
                  </div>
              </div>
          )}
          
          {/* Main Input */}
          <div className="relative">
              <textarea 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="输入问题或写作指令..."
                  className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all resize-none h-12 max-h-32"
                  rows={1}
              />
              <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() && activeReferences.length === 0}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white text-primary rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                  <Send size={16} />
              </button>
          </div>
      </div>
      
      {/* Right-side Timeline Strip */}
      <div className="absolute right-0 top-0 bottom-0 w-1 flex flex-col gap-1 py-2 items-center pointer-events-none">
          {activeSession?.messages?.filter(m => m.role === 'model').map((msg) => (
             <div key={msg.id} className={`w-1 rounded-full transition-all ${
                 msg.suggestionData ? 'h-3 bg-purple-400' : 'h-1.5 bg-green-300'
             }`} />
          ))}
      </div>
    </div>
  );
};

export default ChatAssistant;