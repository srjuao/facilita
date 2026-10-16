import React from 'react';
import { WordMark } from './WordMark';

interface TopBarProps {
  courseName?: string;
  currentPage: string;
}

export const TopBar: React.FC<TopBarProps> = ({ courseName, currentPage }) => {
  return (
    <header className="workspace-topbar">
      <div className="workspace-breadcrumb">
        <WordMark courseName={courseName} />
        <span aria-hidden="true">/</span>
        <span className="workspace-current">{currentPage}</span>
      </div>
      <span className="workspace-label">FACILITA ESTUDOS</span>
    </header>
  );
};
