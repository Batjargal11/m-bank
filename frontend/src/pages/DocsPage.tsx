import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Book, GitBranch } from 'lucide-react';
import { README_CONTENT, DIAGRAMS_CONTENT } from './docs-content';

type Tab = 'readme' | 'diagrams';

const TABS = [
  { id: 'readme' as Tab, label: 'Гарын авлага', icon: Book },
  { id: 'diagrams' as Tab, label: 'Диаграм', icon: GitBranch },
];

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('readme');
  const content = activeTab === 'readme' ? README_CONTENT : DIAGRAMS_CONTENT;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card prose prose-sm max-w-none prose-headings:text-gray-900 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:uppercase prose-th:text-gray-500 prose-td:text-sm prose-td:text-gray-700 prose-table:border-collapse prose-th:border prose-th:border-gray-200 prose-th:bg-gray-50 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-gray-200 prose-td:px-3 prose-td:py-2 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:text-xs prose-code:text-primary-700 prose-code:bg-primary-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
