import React, { useState } from 'react';
import { PromptsConfig } from '../types';
import { Save, Plus, Trash2, Settings, FileText, Code } from 'lucide-react';

interface Props {
  prompts: PromptsConfig;
  expertOutline: string[];
  onSavePrompts: (prompts: PromptsConfig) => void;
  onSaveOutline: (outline: string[]) => void;
}

const PromptExpertDashboard: React.FC<Props> = ({ prompts, expertOutline, onSavePrompts, onSaveOutline }) => {
  const [activeTab, setActiveTab] = useState<'prompts' | 'outline'>('prompts');
  
  // Local state for edits
  const [localPrompts, setLocalPrompts] = useState<PromptsConfig>(prompts);
  const [localOutline, setLocalOutline] = useState<string[]>(expertOutline);
  const [newOutlineItem, setNewOutlineItem] = useState("");

  const handlePromptChange = (key: keyof PromptsConfig, value: string) => {
    setLocalPrompts(prev => ({ ...prev, [key]: value }));
  };

  const handleAddOutlineItem = () => {
    if (!newOutlineItem.trim()) return;
    setLocalOutline(prev => [...prev, newOutlineItem.trim()]);
    setNewOutlineItem("");
  };

  const handleDeleteOutlineItem = (index: number) => {
    setLocalOutline(prev => prev.filter((_, i) => i !== index));
  };

  const saveAll = () => {
    onSavePrompts(localPrompts);
    onSaveOutline(localOutline);
    alert("配置已保存，写作者将应用新的设置。");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <Settings className="text-purple-600" size={32} />
              Prompt 专家工作台
            </h1>
            <p className="text-slate-500 mt-2">配置全局 Prompt 模板与标准大纲结构</p>
          </div>
          <button 
            onClick={saveAll}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center gap-2 shadow-sm transition-colors"
          >
            <Save size={18} /> 保存生效
          </button>
        </header>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('prompts')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'prompts' 
                ? 'border-purple-600 text-purple-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Code size={16} /> Prompt 调优
          </button>
          <button 
            onClick={() => setActiveTab('outline')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'outline' 
                ? 'border-purple-600 text-purple-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={16} /> 标准大纲配置
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[600px]">
          {activeTab === 'prompts' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">大纲生成 Prompt</label>
                  <p className="text-xs text-slate-500 mb-2">可用变量: {`{{TOPIC}}, {{MATERIALS}}, {{CONSTRAINTS}}`}</p>
                  <textarea 
                    value={localPrompts.outline_gen}
                    onChange={(e) => handlePromptChange('outline_gen', e.target.value)}
                    className="w-full h-48 p-3 text-sm font-mono border rounded-lg bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">内容生成 (Chunk) Prompt</label>
                  <p className="text-xs text-slate-500 mb-2">可用变量: {`{{TITLE}}, {{CONTEXT}}, {{STYLE}}, {{POINTS}}`}</p>
                  <textarea 
                    value={localPrompts.content_gen}
                    onChange={(e) => handlePromptChange('content_gen', e.target.value)}
                    className="w-full h-48 p-3 text-sm font-mono border rounded-lg bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">评审 Prompt</label>
                  <p className="text-xs text-slate-500 mb-2">可用变量: {`{{TITLE}}, {{CONTENT}}`}</p>
                  <textarea 
                    value={localPrompts.review_gen}
                    onChange={(e) => handlePromptChange('review_gen', e.target.value)}
                    className="w-full h-48 p-3 text-sm font-mono border rounded-lg bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">改写 Prompt</label>
                  <p className="text-xs text-slate-500 mb-2">可用变量: {`{{CONTENT}}, {{GUIDANCE}}, {{MATERIALS}}, {{POINTS}}`}</p>
                  <textarea 
                    value={localPrompts.rewrite_gen}
                    onChange={(e) => handlePromptChange('rewrite_gen', e.target.value)}
                    className="w-full h-48 p-3 text-sm font-mono border rounded-lg bg-slate-50 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
                在此定义的一级大纲（Level 1）将作为用户生成大纲时的<strong>强制结构</strong>。
                用户的资料将被用于填充这些章节下的二级子章节内容。
              </div>

              <div className="flex gap-2 mb-6">
                <input 
                  value={newOutlineItem}
                  onChange={(e) => setNewOutlineItem(e.target.value)}
                  placeholder="输入一级章节标题（例如：研究背景）"
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddOutlineItem()}
                />
                <button 
                  onClick={handleAddOutlineItem}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1"
                >
                  <Plus size={18} /> 添加
                </button>
              </div>

              <div className="space-y-2">
                {localOutline.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-lg">
                    暂无预设一级大纲，用户可自由生成。
                  </div>
                ) : (
                  localOutline.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg group">
                      <span className="font-medium text-slate-700 flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 text-xs flex items-center justify-center font-bold">
                            {index + 1}
                        </span>
                        {item}
                      </span>
                      <button 
                        onClick={() => handleDeleteOutlineItem(index)}
                        className="text-slate-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptExpertDashboard;