import React, { useState } from 'react';
import { OutlineNode } from '../types';
import { Lock, Plus, Trash2, ChevronRight, ChevronDown, FileText, AlertCircle, ListChecks } from 'lucide-react';

interface Props {
  outline: OutlineNode[];
  setOutline: (outline: OutlineNode[]) => void;
  onNavigateToWriter: () => void;
}

const OutlineEditor: React.FC<Props> = ({ outline, setOutline, onNavigateToWriter }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(outline.map(n => n.id)));

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const addSubSection = (parentId: string) => {
    const parent = outline.find(n => n.id === parentId);
    if (!parent) return;

    const newId = Math.random().toString(36).substr(2, 9);
    const newNode: OutlineNode = {
      id: newId,
      title: "新子章节",
      level: parent.level + 1,
      parentId: parentId,
      content: "",
      isLocked: false,
      status: 'draft'
    };

    const newOutline = [...outline];
    newOutline.push(newNode);
    setOutline(newOutline);
    setExpanded(prev => new Set(prev).add(parentId));
  };

  const updateTitle = (id: string, newTitle: string) => {
    setOutline(outline.map(n => n.id === id ? { ...n, title: newTitle } : n));
  };

  // Hierarchy builder
  const renderNode = (node: OutlineNode) => {
    const children = outline.filter(n => n.parentId === node.id);
    const isExpanded = expanded.has(node.id);

    return (
      <div key={node.id} className="ml-4 mt-4">
        <div className={`flex flex-col gap-2 p-3 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white transition-all ${node.level === 1 ? 'bg-slate-50 shadow-sm' : ''}`}>
          
          {/* Header Row */}
          <div className="flex items-center gap-2">
            {children.length > 0 ? (
                <button onClick={() => toggleExpand(node.id)} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
            ) : <div className="w-6" />}
          
            <div className="flex-1 flex items-center gap-3">
              <FileText size={node.level === 1 ? 20 : 16} className={node.level === 1 ? "text-primary" : "text-slate-400"} />
              {node.isLocked ? (
                <span className={`flex-1 cursor-default text-slate-800 ${node.level === 1 ? 'font-bold text-lg' : 'font-medium'}`}>{node.title}</span>
              ) : (
                <input 
                  value={node.title}
                  onChange={(e) => updateTitle(node.id, e.target.value)}
                  className="flex-1 bg-transparent border-b border-transparent focus:border-primary focus:outline-none text-slate-700 hover:border-slate-300 transition-colors"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              {node.isLocked && (
                <span title="一级标题不可修改" className="flex items-center">
                  <Lock size={14} className="text-slate-400" />
                </span>
              )}
              
              <button 
                  onClick={() => addSubSection(node.id)}
                  className="p-1.5 text-primary hover:bg-blue-50 rounded text-xs flex items-center gap-1 font-medium transition-colors"
                  title="增加子章节"
              >
                  <Plus size={14} /> 增加
              </button>
            </div>
          </div>

          {/* Writing Points Display for Level 1 */}
          {node.level === 1 && (
              <div className="ml-10 mt-2 p-3 bg-white border border-slate-100 rounded-md">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase">
                      <ListChecks size={14} />
                      核心写作要点
                  </div>
                  {(!node.writingPoints || node.writingPoints.length === 0) ? (
                      <div className="text-xs text-slate-400 italic">（暂无生成要点）</div>
                  ) : (
                      <ul className="space-y-2">
                          {node.writingPoints.map((wp, idx) => (
                              <li key={wp.id} className="text-sm text-slate-700">
                                  <span className="font-medium text-slate-900">{idx + 1}. {wp.text}</span>
                                  {wp.subPoints && wp.subPoints.length > 0 && (
                                      <span className="text-slate-500 ml-2 text-xs">
                                          — {wp.subPoints.join('；')}
                                      </span>
                                  )}
                              </li>
                          ))}
                      </ul>
                  )}
              </div>
          )}
        </div>

        {isExpanded && (
            <div className="border-l-2 border-slate-100 ml-3 pl-1">
                {children.map(renderNode)}
            </div>
        )}
      </div>
    );
  };

  const rootNodes = outline.filter(n => n.level === 1);

  return (
    <div className="max-w-5xl mx-auto p-8 bg-white shadow-sm rounded-xl min-h-[80vh] flex flex-col">
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">项目大纲规划</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                <AlertCircle size={14} />
                <span>基于项目构想生成的结构化大纲。一级标题已锁定，请完善子章节。</span>
            </div>
        </div>
        <button 
            onClick={onNavigateToWriter}
            className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-md flex items-center gap-2 text-sm"
        >
            确认并开始写作 <ChevronRight size={16}/>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 pb-20">
        {rootNodes.length === 0 ? (
            <div className="text-center py-24 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                <p>尚未生成大纲。</p>
                <p className="text-sm mt-2">请返回“项目设置”填写构想并生成。</p>
            </div>
        ) : (
            <div className="space-y-2">
                {rootNodes.map(renderNode)}
            </div>
        )}
      </div>
    </div>
  );
};

export default OutlineEditor;