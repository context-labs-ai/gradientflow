import React, { useState } from 'react';

import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="layout-container">
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
