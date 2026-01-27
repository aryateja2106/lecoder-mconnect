'use client';

import { useState, useEffect, useRef } from 'react';

interface BlogContentProps {
  htmlContent: string;
}

export function BlogContent({ htmlContent }: BlogContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !contentRef.current) return;

    // Find all pre elements and add copy functionality
    const preElements = contentRef.current.querySelectorAll('pre');

    preElements.forEach((pre) => {
      // Skip if already processed
      if (pre.parentElement?.classList.contains('code-wrapper')) return;

      const code = pre.querySelector('code')?.textContent || pre.textContent || '';
      const language = pre.getAttribute('data-language') || '';

      // Detect OS from code content
      let osHint = detectOs(code, language);

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'code-wrapper relative group mb-4';

      // Create header
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between bg-[#0a0a0a] border border-b-0 border-[#333] px-4 py-2';

      // Left side - language and OS
      const leftSide = document.createElement('div');
      leftSide.className = 'flex items-center gap-3';

      if (language) {
        const langSpan = document.createElement('span');
        langSpan.className = 'text-xs text-[#666] font-mono uppercase';
        langSpan.textContent = language;
        leftSide.appendChild(langSpan);
      }

      if (osHint) {
        const osSpan = document.createElement('span');
        osSpan.className = 'text-xs text-[#888] border border-[#444] px-2 py-0.5';
        osSpan.textContent = osHint;
        leftSide.appendChild(osSpan);
      }

      header.appendChild(leftSide);

      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'flex items-center gap-2 text-xs text-[#666] hover:text-[#e9e9e7] transition-colors';
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      `;

      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.trim());
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
          `;
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            `;
          }, 2000);
        } catch {
          // Fallback
          const textarea = document.createElement('textarea');
          textarea.value = code.trim();
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
          `;
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            `;
          }, 2000);
        }
      });

      header.appendChild(copyBtn);

      // Wrap the pre element
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      // Update pre styles
      pre.className = 'bg-[#0d0d0d] border border-t-0 border-[#333] p-4 overflow-x-auto font-mono text-sm';
    });
  }, [mounted, htmlContent]);

  return (
    <div
      ref={contentRef}
      className="max-w-none blog-content"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

// Detect which OS a command is for
function detectOs(code: string, language: string): string | null {
  if (language !== 'bash' && language !== 'sh' && language !== '') {
    return null; // Non-shell code doesn't need OS hints
  }

  const lowerCode = code.toLowerCase();

  // macOS specific
  if (lowerCode.includes('brew ') || lowerCode.includes('homebrew')) {
    return 'macOS';
  }

  // Linux specific (Debian/Ubuntu)
  if (lowerCode.includes('apt-get') || lowerCode.includes('apt install') || lowerCode.includes('dpkg')) {
    return 'Linux (Debian/Ubuntu)';
  }

  // Linux specific (RHEL/Fedora)
  if (lowerCode.includes('yum ') || lowerCode.includes('dnf ')) {
    return 'Linux (RHEL/Fedora)';
  }

  // Universal commands that work on both
  const universalCommands = [
    'npm ', 'npx ', 'node ', 'yarn ', 'pnpm ',
    'pip ', 'python ', 'python3 ',
    'git ', 'curl ', 'wget ',
    'cd ', 'mkdir ', 'ls ', 'cat ', 'echo ',
    'ssh ', 'scp ',
  ];

  const isUniversal = universalCommands.some(cmd => lowerCode.includes(cmd));

  if (isUniversal) {
    return 'macOS / Linux';
  }

  // If it starts with common shell patterns but we can't identify OS
  if (language === 'bash' || language === 'sh') {
    return 'macOS / Linux';
  }

  return null;
}
