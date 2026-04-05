import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Book, GitBranch, ExternalLink, Building2, LogIn } from 'lucide-react';
import { README_CONTENT, DIAGRAMS_CONTENT } from './docs-content';

type Tab = 'readme' | 'diagrams';

const TABS = [
  { id: 'readme' as Tab, label: 'Guide', icon: Book },
  { id: 'diagrams' as Tab, label: 'Diagrams', icon: GitBranch },
];

export default function DocsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('readme');
  const content = activeTab === 'readme' ? README_CONTENT : DIAGRAMS_CONTENT;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">M-Bank</h1>
              <p className="text-xs text-gray-500">Documentation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Batjargal11/m-bank"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              GitHub
            </a>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
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

          {/* Article */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 lg:p-10">
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
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </article>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
