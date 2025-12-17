import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`language-switcher ${className}`}
      title={i18n.language === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <Globe size={16} />
      <span>{i18n.language === 'zh' ? 'EN' : '中文'}</span>
      <style>{`
        .language-switcher {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(203, 213, 225, 0.5);
          border-radius: 20px;
          color: #475569;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .language-switcher:hover {
          background: rgba(255, 255, 255, 0.9);
          border-color: #cbd5e1;
          color: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .language-switcher:active {
          transform: translateY(0);
        }
      `}</style>
    </button>
  );
};
