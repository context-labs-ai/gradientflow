import React, { useState } from 'react';

import { Menu, Info, Hash, Users, PanelRightOpen, PanelRightClose, Settings } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { Sidebar } from './Sidebar';
import { AgentConfigPanel } from './AgentConfigPanel';
import { AboutModal } from './AboutModal';
import { ChatSidebar } from './ChatSidebar';
import { SettingsModal } from './SettingsModal';

interface LayoutProps {
  children: React.ReactNode;
}

import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isOnline = useNetworkStatus();
  const { state } = useChat();

  const onlineCount = state.users.filter(u => u.status === 'online').length;

  return (
    <div className="layout-container">
      {!isOnline && (
        <div className="offline-banner">
          您当前处于离线状态。更改可能无法保存。
        </div>
      )}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenAgentPanel={() => setIsAgentPanelOpen(true)}
      />

      {/* Main Content */}
      <main className="main-content">
        <div className="chat-header">
          <div className="chat-header-left">
            <button className="menu-btn mobile-only" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="chat-header-channel">
              <Hash size={18} className="channel-icon" />
              <span className="channel-name">general</span>
            </div>
            <div className="chat-header-meta">
              <Users size={14} />
              <span>{onlineCount} 在线</span>
            </div>
          </div>
          <div className="chat-header-right">
            <div className="chat-header-powered">
              Powered by <span className="parallax-text">Parallax</span>
            </div>
            <button
              className={`info-btn${isChatSidebarOpen ? ' active' : ''}`}
              onClick={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
              title="聊天信息"
            >
              {isChatSidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
            <button className="info-btn" onClick={() => setIsSettingsOpen(true)} title="设置">
              <Settings size={18} />
            </button>
            <button className="info-btn" onClick={() => setIsAboutOpen(true)} title="关于">
              <Info size={18} />
            </button>
          </div>
        </div>
        {children}
      </main>

      <AgentConfigPanel isOpen={isAgentPanelOpen} onClose={() => setIsAgentPanelOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <ChatSidebar
        isOpen={isChatSidebarOpen}
        onClose={() => setIsChatSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <style>{`
        .layout-container {
          display: flex;
          height: 100vh;
          width: 100vw;
          background-color: var(--bg-primary);
          overflow: hidden;
          position: relative;
        }

        .offline-banner {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          background-color: #ef4444;
          color: white;
          text-align: center;
          padding: 4px;
          font-size: 0.8rem;
          z-index: 100;
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: var(--bg-primary);
          position: relative;
          width: 100%;
        }

        .chat-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 0 24px;
            height: 60px;
            border-bottom: 1px solid var(--border-light);
            /* Clean White Header with Blur */
            background-color: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            z-index: 10;
        }

        .chat-header-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .chat-header-channel {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 12px;
            background: #ffffff;
            border-radius: var(--radius-full);
            border: 1px solid var(--border-light);
            box-shadow: var(--shadow-sm);
        }

        .channel-icon {
            color: var(--text-tertiary);
        }

        .channel-name {
            font-weight: 600;
            font-size: 0.95rem;
            color: var(--text-primary);
        }

        .chat-header-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: rgba(16, 185, 129, 0.1);
            border-radius: 999px;
            font-size: 0.75rem;
            color: #10b981;
            font-weight: 500;
        }

        .chat-header-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .chat-header-powered {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            background: var(--bg-tertiary);
            border-radius: 999px;
            font-size: 0.7rem;
            color: var(--text-secondary);
        }

        .parallax-text {
            font-weight: 700;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .menu-btn {
            color: var(--text-primary);
            padding: 8px;
            border-radius: var(--radius-md);
        }

        .menu-btn.mobile-only {
            display: none;
        }

        .info-btn {
            color: var(--text-secondary);
            padding: 8px;
            border-radius: var(--radius-md);
            transition: all 0.2s ease;
        }

        .info-btn:hover {
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
        }

        .info-btn.active {
            background-color: var(--accent-primary);
            color: white;
        }

        @media (max-width: 768px) {
            .menu-btn.mobile-only {
                display: flex;
            }
            .chat-header-meta {
                display: none;
            }
            .chat-header-powered {
                padding: 4px 8px;
                font-size: 0.65rem;
            }
        }
      `}</style>
    </div>
  );
};
