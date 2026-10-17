/** Only the first unfinished lesson is available to a learner. */
export function isLessonLocked(index: number, orderedIds: string[], completed: ReadonlySet<string>, role: string) {
  return role === 'aluno' && orderedIds.slice(0, index).some(id => !completed.has(id));
}

export function isFinalExamLocked(orderedIds: string[], completed: ReadonlySet<string>, role: string) {
  return role === 'aluno' && orderedIds.some(id => !completed.has(id));
}
