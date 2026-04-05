import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Book, GitBranch, ExternalLink } from 'lucide-react';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
          <p className="mt-1 text-sm text-gray-500">Системийн гарын авлага болон техникийн баримт бичиг</p>
        </div>
        <a
          href="https://github.com/Batjargal11/m-bank"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-sm"
        >
          <ExternalLink className="h-4 w-4" />
          GitHub
        </a>
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 lg:p-8">
          <article className="
            prose prose-sm max-w-none
            prose-headings:text-gray-900
            prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-3 prose-h1:mb-6
            prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-4
            prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6
            prose-p:text-gray-600 prose-p:leading-relaxed
            prose-strong:text-gray-900
            prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
            prose-table:border-collapse prose-table:w-full prose-table:text-sm
            prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:uppercase prose-th:tracking-wider prose-th:text-gray-500 prose-th:bg-gray-50 prose-th:border prose-th:border-gray-200 prose-th:px-4 prose-th:py-2.5
            prose-td:border prose-td:border-gray-200 prose-td:px-4 prose-td:py-2 prose-td:text-gray-700
            prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:text-xs prose-pre:rounded-lg prose-pre:border prose-pre:border-gray-700
            prose-code:text-primary-700 prose-code:bg-primary-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
            prose-li:text-gray-600
            prose-ol:text-gray-600
            prose-ul:text-gray-600
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
}
