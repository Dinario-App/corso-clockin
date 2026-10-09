import type { SkillTemplateId } from './skillTemplate';

const added = new Set<SkillTemplateId>();

export function addSkill(id: SkillTemplateId): void {
  added.add(id);
}

export function isSkillAdded(id: SkillTemplateId): boolean {
  return added.has(id);
}

export function listAddedSkills(): SkillTemplateId[] {
  return [...added];
}

export function __resetAddedSkillsForTests(): void {
  added.clear();
}
