export interface Subject {
  id: string;
  name: string;
  color: string;
}

export interface Material {
  id: string;
  subjectId: string;
  title: string;
  content: string;
  url: string;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  subjectId: string | null;
}

export interface StudyHubData {
  subjects: Subject[];
  materials: Material[];
  glossary: GlossaryTerm[];
}

export const emptyData: StudyHubData = {
  subjects: [],
  materials: [],
  glossary: [],
};
