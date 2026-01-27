'use client';

import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  os?: 'macos' | 'linux' | 'both' | 'any';
}

export function CodeBlock({ code, language, os = 'any' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getOsLabel = () => {
    switch (os) {
      case 'macos':
        return 'macOS';
      case 'linux':
        return 'Linux';
      case 'both':
        return 'macOS / Linux';
      default:
        return null;
    }
  };

  const osLabel = getOsLabel();

  return (
    <div className="relative group mb-4">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-[#0a0a0a] border border-b-0 border-[#333] px-4 py-2">
        <div className="flex items-center gap-3">
          {language && (
            <span className="text-xs text-[#666] font-mono uppercase">{language}</span>
          )}
          {osLabel && (
            <span className="text-xs text-[#888] border border-[#444] px-2 py-0.5 rounded">
              {osLabel}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs text-[#666] hover:text-[#e9e9e7] transition-colors"
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="bg-[#0d0d0d] border border-[#333] p-4 overflow-x-auto font-mono text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Multi-OS code block for showing different commands per OS
interface MultiOsCodeBlockProps {
  macos?: string;
  linux?: string;
  universal?: string;
  language?: string;
}

export function MultiOsCodeBlock({ macos, linux, universal, language = 'bash' }: MultiOsCodeBlockProps) {
  const [activeOs, setActiveOs] = useState<'macos' | 'linux'>(
    macos ? 'macos' : 'linux'
  );
  const [copied, setCopied] = useState(false);

  // If universal command works on both
  if (universal) {
    return <CodeBlock code={universal} language={language} os="both" />;
  }

  const currentCode = activeOs === 'macos' ? macos : linux;

  const handleCopy = async () => {
    if (!currentCode) return;
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = currentCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group mb-4">
      {/* Header bar with OS tabs */}
      <div className="flex items-center justify-between bg-[#0a0a0a] border border-b-0 border-[#333] px-4 py-2">
        <div className="flex items-center gap-1">
          {macos && (
            <button
              onClick={() => setActiveOs('macos')}
              className={`text-xs px-3 py-1 transition-colors ${
                activeOs === 'macos'
                  ? 'bg-[#333] text-[#e9e9e7]'
                  : 'text-[#666] hover:text-[#888]'
              }`}
            >
              macOS
            </button>
          )}
          {linux && (
            <button
              onClick={() => setActiveOs('linux')}
              className={`text-xs px-3 py-1 transition-colors ${
                activeOs === 'linux'
                  ? 'bg-[#333] text-[#e9e9e7]'
                  : 'text-[#666] hover:text-[#888]'
              }`}
            >
              Linux
            </button>
          )}
          {language && (
            <span className="text-xs text-[#666] font-mono uppercase ml-3">{language}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs text-[#666] hover:text-[#e9e9e7] transition-colors"
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre className="bg-[#0d0d0d] border border-[#333] p-4 overflow-x-auto font-mono text-sm">
        <code>{currentCode}</code>
      </pre>
    </div>
  );
}
