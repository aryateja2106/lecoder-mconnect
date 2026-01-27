import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Technical articles about AI coding agents, remote development workflows, and machine learning research from LeSearch AI.',
  openGraph: {
    title: 'Blog | LeCoder MConnect',
    description: 'Technical articles about AI coding agents, remote development workflows, and machine learning research.',
  },
};

const blogPosts = [
  {
    slug: 'building-apps-from-raspberry-pi-with-ai-agents',
    title: 'Building Apps from a Raspberry Pi with AI Agents',
    description: 'How I use a $80 computer, my iPad, and AI coding assistants to build real software.',
    date: '2026-01-27',
    tags: ['raspberry-pi', 'ai-agents', 'mobile-development'],
  },
  {
    slug: 'lecoder-cgpu-run-colab-gpus-from-terminal',
    title: 'LeCoder cGPU: Run Google Colab GPUs from Your Terminal',
    description: 'A production-grade CLI for A100 access without leaving your workflow.',
    date: '2026-01-27',
    tags: ['gpu', 'colab', 'machine-learning', 'cli'],
  },
  {
    slug: 'reproducing-nested-learning-from-scratch',
    title: 'Reproducing Nested Learning from Scratch',
    description: "A hands-on guide to implementing Google Research's paper on continual learning.",
    date: '2026-01-27',
    tags: ['machine-learning', 'research', 'pytorch', 'nested-learning'],
  },
  {
    slug: 'control-ai-agents-from-your-phone',
    title: 'Control AI Agents from Your Phone',
    description: 'Getting started with LeCoder MConnect for mobile AI development workflows.',
    date: '2026-01-27',
    tags: ['mconnect', 'ai-agents', 'mobile', 'tutorial'],
  },
];

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

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#191919] text-[#e9e9e7]">
      {/* Header */}
      <header className="border-b border-[#333]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
            <PixelLogo size={24} />
            <span className="font-mono font-bold">LeCoder</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-mono text-3xl font-bold mb-2">Blog</h1>
        <p className="text-[#888] mb-12">
          Technical articles about AI coding agents, remote development, and machine learning research.
        </p>

        {/* Blog Posts */}
        <div className="space-y-8">
          {blogPosts.map((post) => (
            <article
              key={post.slug}
              className="border border-[#333] p-6 hover:border-[#555] transition-colors"
            >
              <div className="flex items-center gap-2 text-sm text-[#666] mb-2 font-mono">
                <time dateTime={post.date}>{post.date}</time>
              </div>

              <h2 className="text-xl font-bold mb-2">
                <Link
                  href={`/blog/${post.slug}`}
                  className="hover:underline"
                >
                  {post.title}
                </Link>
              </h2>

              <p className="text-[#aaa] mb-4">{post.description}</p>

              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-mono px-2 py-1 border border-[#444] text-[#888]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#333] mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-[#666] text-sm font-mono">
          <p>Part of <a href="https://lesearch.ai" className="hover:underline">LeSearch AI</a>'s open-source initiative</p>
        </div>
      </footer>
    </div>
  );
}
