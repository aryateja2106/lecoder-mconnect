import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import { BlogContent } from './BlogContent';

// Blog post metadata
const blogMetadata: Record<string, { title: string; description: string; date: string }> = {
  'building-apps-from-raspberry-pi-with-ai-agents': {
    title: 'Building Apps from a Raspberry Pi with AI Agents',
    description: 'How I use a $80 computer, my iPad, and AI coding assistants to build real software.',
    date: '2026-01-27',
  },
  'lecoder-cgpu-run-colab-gpus-from-terminal': {
    title: 'LeCoder cGPU: Run Google Colab GPUs from Your Terminal',
    description: 'A production-grade CLI for A100 access without leaving your workflow.',
    date: '2026-01-27',
  },
  'reproducing-nested-learning-from-scratch': {
    title: 'Reproducing Nested Learning from Scratch',
    description: "A hands-on guide to implementing Google Research's paper on continual learning.",
    date: '2026-01-27',
  },
  'control-ai-agents-from-your-phone': {
    title: 'Control AI Agents from Your Phone',
    description: 'Getting started with LeCoder MConnect for mobile AI development workflows.',
    date: '2026-01-27',
  },
};

// Static params for build
export function generateStaticParams() {
  return Object.keys(blogMetadata).map((slug) => ({ slug }));
}

// Dynamic metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = blogMetadata[slug];

  if (!meta) {
    return { title: 'Not Found' };
  }

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: `${meta.title} | LeCoder Blog`,
      description: meta.description,
      type: 'article',
      publishedTime: meta.date,
    },
  };
}

// Pixelated L Logo
function PixelLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="4" width="10" height="24" fill="currentColor"/>
      <rect x="4" y="22" width="24" height="6" fill="currentColor"/>
      <rect x="10" y="10" width="4" height="12" fill="#191919" opacity="0.3"/>
    </svg>
  );
}

// Simple markdown to HTML converter
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Remove frontmatter (title line and --- separators at top)
  html = html.replace(/^#[^\n]*\n\n\*[^\n]*\*\n\n---\n\n/, '');

  // Code blocks with language
  html = html.replace(/```(\w+)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-[#0d0d0d] border border-[#333] p-4 overflow-x-auto mb-4 font-mono text-sm" data-language="${lang}"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Code blocks without language
  html = html.replace(/```\n([\s\S]*?)```/g, (_, code) => {
    return `<pre class="bg-[#0d0d0d] border border-[#333] p-4 overflow-x-auto mb-4 font-mono text-sm"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-[#0d0d0d] border border-[#333] px-1.5 py-0.5 font-mono text-sm">$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-8 mb-4 border-b border-[#333] pb-2">$1</h2>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80">$1</a>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="mb-2">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="mb-4 pl-6 list-disc">$&</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="mb-2">$1</li>');

  // Tables (simple support)
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(c => c.trim());
    if (cells.every(c => c.trim().match(/^-+$/))) {
      return ''; // Skip separator rows
    }
    const cellTags = cells.map(c => `<td class="border border-[#333] p-2">${c.trim()}</td>`).join('');
    return `<tr>${cellTags}</tr>`;
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table class="w-full border-collapse mb-4">$&</table>');

  // Paragraphs (lines not already wrapped)
  const lines = html.split('\n');
  html = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return line;
    if (trimmed.startsWith('#')) return line;
    return `<p class="mb-4 leading-7">${line}</p>`;
  }).join('\n');

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-t border-[#333] my-8" />');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = blogMetadata[slug];

  if (!meta) {
    notFound();
  }

  // Read markdown file
  let content = '';
  try {
    const filePath = path.join(process.cwd(), 'public', 'blog', `${slug}.md`);
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    notFound();
  }

  const htmlContent = markdownToHtml(content);

  return (
    <div className="min-h-screen bg-[#191919] text-[#e9e9e7]">
      {/* Header */}
      <header className="border-b border-[#333]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
            <PixelLogo size={24} />
            <span className="font-mono font-bold">LeCoder</span>
          </Link>
          <Link href="/blog" className="text-sm text-[#888] hover:text-[#e9e9e7] font-mono">
            ← Back to Blog
          </Link>
        </div>
      </header>

      {/* Article */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <article>
          {/* Article Header */}
          <header className="mb-12">
            <time dateTime={meta.date} className="text-sm text-[#666] font-mono">
              {meta.date}
            </time>
            <h1 className="text-3xl font-bold mt-2 mb-4">{meta.title}</h1>
            <p className="text-lg text-[#aaa]">{meta.description}</p>
          </header>

          {/* Article Content */}
          <BlogContent htmlContent={htmlContent} />
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#333] mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-[#666] text-sm font-mono">
          <p>Part of <a href="https://lesearch.ai" className="hover:underline">LeSearch AI</a>&apos;s open-source initiative</p>
        </div>
      </footer>
    </div>
  );
}
