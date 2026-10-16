import React from 'react';
import { StudentSubjects } from './StudentSubjects';
export const StudentPeriods: React.FC<{ onNavigateLesson?: (lessonId: string) => void; onNavigateView?: (view: string) => void }> = ({ onNavigateLesson }) => <StudentSubjects onOpenLesson={onNavigateLesson} />;
