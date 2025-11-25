import React, { useState } from 'react';

import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isOnline = useNetworkStatus();

  return (
    <div className="layout-container">
      {!isOnline && (
        <div className="offline-banner">
          You are currently offline. Changes may not be saved.
        </div>
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <main className="main-content">
        <div className="mobile-header">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <span className="mobile-title">AI Chat</span>
        </div>
        {children}
      </main>

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
          width: 100%; /* Ensure full width */
        }

        .mobile-header {
            display: none;
            align-items: center;
            gap: 12px;
            padding: 0 var(--spacing-md);
            height: 60px;
            border-bottom: 1px solid var(--border-light);
            background-color: var(--bg-primary);
        }

        .menu-btn {
            color: var(--text-primary);
            padding: 4px;
        }

        .mobile-title {
            font-weight: 700;
            font-size: 1.1rem;
        }

        @media (max-width: 768px) {
            .mobile-header {
                display: flex;
            }
        }
      `}</style>
    </div>
  );
};
