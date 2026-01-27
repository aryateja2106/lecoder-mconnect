'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Terminal,
  Smartphone,
  Shield,
  Github,
  Copy,
  Check,
  Lock,
  QrCode,
  MonitorSmartphone,
  Bot,
  ArrowRight,
  Download,
  Star,
  ChevronRight,
  Container,
  Users,
  Cpu,
  Building2,
  Eye,
  Zap,
} from 'lucide-react';

let toastTimeout: NodeJS.Timeout;

// Pixelated L Logo - Monochrome
function PixelLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="4" y="4" width="10" height="24" fill="currentColor"/>
      <rect x="4" y="22" width="24" height="6" fill="currentColor"/>
      <rect x="10" y="10" width="4" height="12" fill="#191919" opacity="0.3"/>
    </svg>
  );
}

// Copy Button
function CopyButton({ text, showToast }: { text: string; showToast: (msg: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      showToast('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text, showToast]);

  return (
    <button
      onClick={handleCopy}
      className={`p-2 rounded transition-all ${copied ? 'text-[#e9e9e7]' : 'text-[#6b6b6b] hover:text-[#e9e9e7]'}`}
      title="Copy to clipboard"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

// Feature Card - Monochrome with border emphasis
function FeatureCard({ icon: Icon, title, description }: { icon: typeof Terminal; title: string; description: string }) {
  return (
    <div className="p-6 border border-[#333] hover:border-[#e9e9e7] transition-colors group">
      <div className="w-10 h-10 border border-[#333] group-hover:border-[#e9e9e7] flex items-center justify-center mb-4 transition-colors">
        <Icon size={20} className="text-[#888] group-hover:text-[#e9e9e7] transition-colors" />
      </div>
      <h3 className="text-[15px] font-bold text-[#e9e9e7] mb-2">{title}</h3>
      <p className="text-[#888] text-[13px] leading-relaxed">{description}</p>
    </div>
  );
}

// Roadmap Item - Simple, no colors
function RoadmapItem({ title, description, status }: { title: string; description: string; status: 'done' | 'building' | 'planned' }) {
  return (
    <div className="flex items-start gap-4 p-4 border border-[#333] hover:border-[#e9e9e7] transition-colors">
      <div className={`w-3 h-3 mt-1 border ${status === 'done' ? 'bg-[#e9e9e7] border-[#e9e9e7]' : status === 'building' ? 'border-[#e9e9e7]' : 'border-[#555]'}`} />
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h4 className="text-[14px] font-bold text-[#e9e9e7]">{title}</h4>
          {status === 'building' && <span className="text-[10px] border border-[#555] px-2 py-0.5 text-[#888]">IN PROGRESS</span>}
        </div>
        <p className="text-[#888] text-[13px] mt-1">{description}</p>
      </div>
    </div>
  );
}

// Agent Badge - Monochrome
function AgentBadge({ name, tested }: { name: string; tested?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-[#333] hover:border-[#e9e9e7] transition-colors">
      <Bot size={18} className="text-[#888]" />
      <span className="text-[#e9e9e7] text-[14px]">{name}</span>
      {tested && <span className="ml-auto text-[11px] border border-[#555] px-2 py-0.5 text-[#888]">TESTED</span>}
    </div>
  );
}

export default function Home() {
  const [toastMessage, setToastMessage] = useState('');
  const [showToastState, setShowToastState] = useState(false);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimeout);
    setToastMessage(msg);
    setShowToastState(true);
    toastTimeout = setTimeout(() => setShowToastState(false), 2000);
  }, []);

  const installCommand = 'npx lecoder-mconnect';

  return (
    <div className="min-h-screen bg-[#191919] text-[#e9e9e7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Toast */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#191919] border border-[#e9e9e7] px-4 py-3 text-sm z-50 transition-all duration-200 ${showToastState ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <Check size={14} />
          {toastMessage}
        </div>
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#191919] border-b border-[#333]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PixelLogo size={24} />
            <span className="font-bold text-[15px]">LeCoder</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hidden sm:inline text-[#888] hover:text-[#e9e9e7] transition-colors text-sm">Features</a>
            <a href="#roadmap" className="hidden sm:inline text-[#888] hover:text-[#e9e9e7] transition-colors text-sm">Roadmap</a>
            <a href="#enterprise" className="hidden sm:inline text-[#888] hover:text-[#e9e9e7] transition-colors text-sm">Enterprise</a>
            <a href="/blog" className="hidden sm:inline text-[#888] hover:text-[#e9e9e7] transition-colors text-sm">Blog</a>
            <a href="https://github.com/aryateja2106/lecoder-mconnect" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#888] hover:text-[#e9e9e7] transition-colors text-sm">
              <Github size={18} />
            </a>
            <a href="https://www.npmjs.com/package/lecoder-mconnect" target="_blank" rel="noopener noreferrer" className="border border-[#e9e9e7] px-4 py-2 text-sm hover:bg-[#e9e9e7] hover:text-[#191919] transition-colors">
              Install
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <a href="https://github.com/aryateja2106/lecoder-mconnect" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#333] hover:border-[#e9e9e7] transition-colors text-xs text-[#888]">
              <Star size={12} />
              Open source · v0.1.3
              <ChevronRight size={12} />
            </a>
          </div>

          <h1 className="text-center text-[28px] sm:text-[36px] md:text-[44px] font-bold tracking-tight mb-6 leading-tight">
            The productivity layer<br />for AI coding agents
          </h1>

          <p className="text-center text-[15px] sm:text-[16px] text-[#888] max-w-2xl mx-auto mb-10 leading-relaxed">
            As AI agents multiply, you need one place to <span className="text-[#e9e9e7] font-bold">orchestrate</span>, <span className="text-[#e9e9e7] font-bold">monitor</span>, and <span className="text-[#e9e9e7] font-bold">secure</span> them all.
            LeCoder MConnect gives you control from anywhere.
          </p>

          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-2 border border-[#333] hover:border-[#e9e9e7] px-4 py-3 transition-colors">
              <span className="text-[#555]">$</span>
              <code className="text-sm">{installCommand}</code>
              <CopyButton text={installCommand} showToast={showToast} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-16">
            <a href="https://www.npmjs.com/package/lecoder-mconnect" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#e9e9e7] text-[#191919] font-bold text-sm hover:bg-[#fff] transition-colors">
              <Download size={16} />
              Get Started
            </a>
            <a href="https://github.com/aryateja2106/lecoder-mconnect#readme" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#555] text-sm hover:border-[#e9e9e7] transition-colors">
              Documentation
              <ArrowRight size={16} />
            </a>
          </div>

          {/* Phone mockups */}
          <div className="relative">
            <div className="flex justify-center items-end gap-3 md:gap-6">
              <div className="w-[120px] md:w-[180px] lg:w-[220px] transform -rotate-6 hover:rotate-0 transition-transform duration-300">
                <div className="border border-[#333] p-1.5">
                  <div className="bg-[#191919] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#333]">
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <span className="ml-1 text-[8px] text-[#888]">Claude Code</span>
                    </div>
                    <Image src="/mobile-view-ss/claude-code-view.PNG" alt="Claude Code" width={220} height={380} className="w-full h-auto" />
                  </div>
                </div>
              </div>

              <div className="w-[140px] md:w-[200px] lg:w-[260px] z-10 hover:scale-105 transition-transform duration-300">
                <div className="border-2 border-[#e9e9e7] p-1.5">
                  <div className="bg-[#191919] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#333]">
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <span className="ml-1 text-[8px] text-[#888]">Gemini CLI</span>
                    </div>
                    <Image src="/mobile-view-ss/gemini-cli-view.PNG" alt="Gemini CLI" width={260} height={450} className="w-full h-auto" />
                  </div>
                </div>
              </div>

              <div className="w-[120px] md:w-[180px] lg:w-[220px] transform rotate-6 hover:rotate-0 transition-transform duration-300">
                <div className="border border-[#333] p-1.5">
                  <div className="bg-[#191919] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#333]">
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <div className="w-1.5 h-1.5 rounded-full border border-[#555]" />
                      <span className="ml-1 text-[8px] text-[#888]">Cursor Agent</span>
                    </div>
                    <Image src="/mobile-view-ss/cursor-agent-view.PNG" alt="Cursor Agent" width={220} height={380} className="w-full h-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why LeCoder */}
      <section className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Why LeCoder?</h2>
          <p className="text-[#888] mb-12 max-w-2xl text-sm leading-relaxed">
            Claude Code, Gemini CLI, Cursor, Aider, Codex—the list keeps growing.
            You need a way to <span className="text-[#e9e9e7] font-bold">run them in parallel</span>, <span className="text-[#e9e9e7] font-bold">monitor from your phone</span>, and <span className="text-[#e9e9e7] font-bold">keep them secure</span>.
          </p>

          <div className="grid md:grid-cols-3 gap-px bg-[#333]">
            <div className="bg-[#191919] p-8">
              <Zap size={24} className="mb-4" />
              <h3 className="font-bold mb-2">One command</h3>
              <p className="text-[#888] text-sm">Start any AI agent with <code className="border border-[#333] px-1">npx lecoder-mconnect</code>. No config needed.</p>
            </div>
            <div className="bg-[#191919] p-8">
              <QrCode size={24} className="mb-4" />
              <h3 className="font-bold mb-2">QR to connect</h3>
              <p className="text-[#888] text-sm">Scan from your phone. Instant secure tunnel via Cloudflare. No port forwarding.</p>
            </div>
            <div className="bg-[#191919] p-8">
              <Eye size={24} className="mb-4" />
              <h3 className="font-bold mb-2">Watch & control</h3>
              <p className="text-[#888] text-sm">Monitor output from anywhere. Send commands when needed. Read-only by default.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Features</h2>
          <p className="text-[#888] mb-12 max-w-xl text-sm">Built for developers who need control without compromise.</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#333]">
            <div className="bg-[#191919]"><FeatureCard icon={Bot} title="Multi-Agent Support" description="Run Claude, Gemini, Cursor, Codex, Aider in parallel sessions" /></div>
            <div className="bg-[#191919]"><FeatureCard icon={Smartphone} title="Mobile-First UI" description="Touch-optimized terminal with smooth scrolling and gestures" /></div>
            <div className="bg-[#191919]"><FeatureCard icon={Lock} title="Read-Only Default" description="Safely monitor without accidental interruption" /></div>
            <div className="bg-[#191919]"><FeatureCard icon={Shield} title="Guardrails" description="Block dangerous commands, require approval for risky ops" /></div>
            <div className="bg-[#191919]"><FeatureCard icon={QrCode} title="QR Code Connect" description="Scan to connect instantly, no manual URL typing" /></div>
            <div className="bg-[#191919]"><FeatureCard icon={MonitorSmartphone} title="Secure Tunnels" description="Cloudflare encryption, no port forwarding needed" /></div>
          </div>
        </div>
      </section>

      {/* Supported Agents */}
      <section className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Supported Agents</h2>
          <p className="text-[#888] mb-10 text-sm">Works with any CLI-based AI coding tool.</p>

          <div className="grid sm:grid-cols-2 gap-px bg-[#333]">
            <div className="bg-[#191919]"><AgentBadge name="Claude Code" tested /></div>
            <div className="bg-[#191919]"><AgentBadge name="Gemini CLI" tested /></div>
            <div className="bg-[#191919]"><AgentBadge name="Cursor Agent" tested /></div>
            <div className="bg-[#191919]"><AgentBadge name="OpenAI Codex" /></div>
            <div className="bg-[#191919]"><AgentBadge name="Aider" /></div>
            <div className="bg-[#191919]"><AgentBadge name="Any CLI Tool" /></div>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Roadmap</h2>
          <p className="text-[#888] mb-10 text-sm">What we&apos;re building next.</p>

          <div className="space-y-px bg-[#333]">
            <div className="bg-[#191919]">
              <RoadmapItem
                status="done"
                title="Multi-agent parallel execution"
                description="Run multiple AI agents simultaneously in isolated terminals"
              />
            </div>
            <div className="bg-[#191919]">
              <RoadmapItem
                status="done"
                title="Cloudflare secure tunnels"
                description="End-to-end encrypted remote access without port forwarding"
              />
            </div>
            <div className="bg-[#191919]">
              <RoadmapItem
                status="done"
                title="Command guardrails"
                description="Block dangerous commands, require approval for risky operations"
              />
            </div>
            <div className="bg-[#191919]">
              <RoadmapItem
                status="building"
                title="Container isolation"
                description="Run each agent in its own Docker container with resource limits"
              />
            </div>
            <div className="bg-[#191919]">
              <RoadmapItem
                status="building"
                title="Git worktrees"
                description="Automatic worktree per agent for parallel work without conflicts"
              />
            </div>
            <div className="bg-[#191919]">
              <RoadmapItem
                status="planned"
                title="Real-time collaboration"
                description="Share sessions with teammates, live cursors, chat alongside terminal"
              />
            </div>
            <div className="bg-[#191919]">
              <RoadmapItem
                status="planned"
                title="Local AI support (Ollama)"
                description="Run local models with zero data leaving your machine"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise */}
      <section id="enterprise" className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 size={20} />
                <span className="text-sm font-bold">For Enterprise</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                AI agents for your<br />entire organization
              </h2>
              <p className="text-[#888] mb-8 leading-relaxed text-sm">
                Security teams need visibility. Compliance needs audit trails. Developers need freedom.
                LeCoder MConnect gives everyone what they need.
              </p>

              <a
                href="mailto:hello@lecoder.ai?subject=Enterprise%20Inquiry"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[#e9e9e7] font-bold text-sm hover:bg-[#e9e9e7] hover:text-[#191919] transition-colors"
              >
                Contact Sales
                <ArrowRight size={16} />
              </a>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 border border-[#333]">
                <Container size={20} className="mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Sandboxed Environments</h4>
                  <p className="text-[#888] text-[13px]">Isolated containers with resource limits and network policies</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border border-[#333]">
                <Users size={20} className="mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Team Collaboration</h4>
                  <p className="text-[#888] text-[13px]">Approval workflows, Slack notifications, session sharing</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border border-[#333]">
                <Shield size={20} className="mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">SSO & Audit Logs</h4>
                  <p className="text-[#888] text-[13px]">Okta, Azure AD integration. Full session recordings for compliance</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 border border-[#333]">
                <Cpu size={20} className="mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Local AI Support</h4>
                  <p className="text-[#888] text-[13px]">Air-gapped deployment with Ollama. Your data never leaves your network</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Security</h2>
          <p className="text-[#888] mb-8 text-sm">Your terminal, your data. Always.</p>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-px bg-[#333]">
            {[
              { title: 'No accounts', desc: 'No signup required' },
              { title: 'No cloud storage', desc: 'All data on your machine' },
              { title: 'Ephemeral sessions', desc: 'URLs expire when CLI stops' },
              { title: 'No telemetry', desc: "We don't track anything" },
            ].map((item) => (
              <div key={item.title} className="bg-[#191919] p-6">
                <div className="font-bold text-sm mb-1">{item.title}</div>
                <div className="text-[13px] text-[#888]">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Get Started</h2>
          <p className="text-[#888] mb-10 text-sm">Up and running in under a minute.</p>

          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between border border-[#333] px-4 py-3">
              <div>
                <span className="text-[#555] text-xs block mb-1"># Install cloudflared (for remote access)</span>
                <code className="text-sm">brew install cloudflared</code>
              </div>
              <CopyButton text="brew install cloudflared" showToast={showToast} />
            </div>

            <div className="flex items-center justify-between border border-[#333] px-4 py-3">
              <div>
                <span className="text-[#555] text-xs block mb-1"># Run MConnect</span>
                <code className="text-sm">npx lecoder-mconnect</code>
              </div>
              <CopyButton text="npx lecoder-mconnect" showToast={showToast} />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to take control?</h2>
          <p className="text-[#888] mb-8 text-sm">Free, open source, and built for developers.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="https://www.npmjs.com/package/lecoder-mconnect" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 bg-[#e9e9e7] text-[#191919] font-bold text-sm hover:bg-[#fff] transition-colors">
              <Download size={18} />
              Install Now
            </a>
            <a href="https://github.com/aryateja2106/lecoder-mconnect" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 border border-[#555] text-sm hover:border-[#e9e9e7] transition-colors">
              <Github size={18} />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="py-20 px-6 border-t border-[#333]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">From the Blog</h2>
            <p className="text-[#888] max-w-2xl mx-auto">Technical deep dives, tutorials, and stories from building with AI agents</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <a href="/blog/building-apps-from-raspberry-pi-with-ai-agents" className="block border border-[#333] p-6 hover:border-[#e9e9e7] transition-colors group">
              <span className="text-xs text-[#666] font-mono">2026-01-27</span>
              <h3 className="text-lg font-bold mt-2 mb-2 group-hover:underline">Building Apps from a Raspberry Pi with AI Agents</h3>
              <p className="text-[#888] text-sm">How I use a $80 computer, my iPad, and AI coding assistants to build real software.</p>
            </a>

            <a href="/blog/control-ai-agents-from-your-phone" className="block border border-[#333] p-6 hover:border-[#e9e9e7] transition-colors group">
              <span className="text-xs text-[#666] font-mono">2026-01-27</span>
              <h3 className="text-lg font-bold mt-2 mb-2 group-hover:underline">Control AI Agents from Your Phone</h3>
              <p className="text-[#888] text-sm">Getting started with LeCoder MConnect for mobile AI development workflows.</p>
            </a>

            <a href="/blog/lecoder-cgpu-run-colab-gpus-from-terminal" className="block border border-[#333] p-6 hover:border-[#e9e9e7] transition-colors group">
              <span className="text-xs text-[#666] font-mono">2026-01-27</span>
              <h3 className="text-lg font-bold mt-2 mb-2 group-hover:underline">LeCoder cGPU: Run Colab GPUs from Your Terminal</h3>
              <p className="text-[#888] text-sm">A production-grade CLI for A100 access without leaving your workflow.</p>
            </a>

            <a href="/blog/reproducing-nested-learning-from-scratch" className="block border border-[#333] p-6 hover:border-[#e9e9e7] transition-colors group">
              <span className="text-xs text-[#666] font-mono">2026-01-27</span>
              <h3 className="text-lg font-bold mt-2 mb-2 group-hover:underline">Reproducing Nested Learning from Scratch</h3>
              <p className="text-[#888] text-sm">A hands-on guide to implementing Google Research&apos;s paper on continual learning.</p>
            </a>
          </div>

          <div className="text-center mt-8">
            <a href="/blog" className="inline-flex items-center gap-2 text-sm text-[#888] hover:text-[#e9e9e7] transition-colors">
              View all posts <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#333]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <PixelLogo size={20} />
              <span className="text-[#888] text-sm">LeCoder MConnect</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-[#555]">
              <a href="/blog" className="hover:text-[#e9e9e7] transition-colors">Blog</a>
              <a href="https://github.com/aryateja2106/lecoder-mconnect" target="_blank" rel="noopener noreferrer" className="hover:text-[#e9e9e7] transition-colors flex items-center gap-1">
                <Github size={14} />
                GitHub
              </a>
              <a href="https://www.npmjs.com/package/lecoder-mconnect" target="_blank" rel="noopener noreferrer" className="hover:text-[#e9e9e7] transition-colors">npm</a>
              <a href="https://twitter.com/r_aryateja" target="_blank" rel="noopener noreferrer" className="hover:text-[#e9e9e7] transition-colors">Twitter</a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-[#333] text-center">
            <p className="text-xs text-[#555]">Built by Arya Teja · MIT License</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
