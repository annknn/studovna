import React, { useEffect, useMemo, useState } from 'react';
import type { Subject, Material, GlossaryTerm, StudyHubData, Chapter, Flashcard } from './types';
import { emptyData } from './types';
import './Studovna.css';

const STORAGE_KEY = 'study-hub-data';
const SWATCHES = ['#2F4A3B', '#AD8327', '#6C4457', '#3A5A78', '#8A5A2E', '#4A5A2E'];
const ALPHABET = 'ABCČDEFGHIJKLMNOPQRSŠTUVWXYZŽ'.split('');

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pluralMaterialu(count: number): string {
  if (count === 1) return 'materiál';
  if (count >= 2 && count <= 4) return 'materiály';
  return 'materiálů';
}

/** Builds a regex matching any glossary term as a whole word (Unicode-aware). */
function buildHighlightRegex(terms: GlossaryTerm[]): RegExp | null {
  const valid = terms.filter((t) => t.term.trim().length > 0);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => b.term.length - a.term.length);
  const pattern = sorted.map((t) => escapeRegex(t.term)).join('|');
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'giu');
  } catch {
    // fallback for environments without lookbehind / unicode property escapes
    return new RegExp(`\\b(${pattern})\\b`, 'gi');
  }
}

/**
 * Splits `text` into plain strings and <span> highlights for any word that
 * matches a glossary term. Each highlight carries the definition as a
 * data-def attribute, shown as a hover tooltip via CSS (see Studovna.css).
 */
function highlightGlossary(text: string, terms: GlossaryTerm[]): React.ReactNode {
  if (!text) return text;
  const re = buildHighlightRegex(terms);
  if (!re) return text;

  const byLower = new Map(terms.map((t) => [t.term.toLowerCase(), t]));
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    const full = match[0];
    const start = match.index;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const term = byLower.get(full.toLowerCase());
    if (term) {
      nodes.push(
        <span
          key={key++}
          className="gloss-highlight"
          data-def={term.definition.replace(/\n+/g, ' ')}
        >
          {full}
        </span>
      );
    } else {
      nodes.push(full);
    }

    lastIndex = start + full.length;
    if (full.length === 0) re.lastIndex += 1; // guard against zero-length matches
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function loadInitialData(): StudyHubData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw) as Partial<StudyHubData>;
    return {
      subjects: parsed.subjects ?? [],
      materials: parsed.materials ?? [],
      glossary: parsed.glossary ?? [],
    };
  } catch {
    return emptyData;
  }
}

type View = 'materials' | 'glossary';

export default function Studovna(): React.ReactElement {
  const [data, setData] = useState<StudyHubData>(loadInitialData);
  const [view, setView] = useState<View>('materials');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [status, setStatus] = useState('Uloženo v tvém prohlížeči');

  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showTermForm, setShowTermForm] = useState(false);
  const [search, setSearch] = useState('');

  // persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStatus('Uloženo ✓');
    } catch {
      setStatus('Ukládání se nezdařilo, zkus to prosím znovu.');
    }
  }, [data]);

  function changeView(next: View) {
    setView(next);
    setActiveSubjectId(null);
    setShowSubjectForm(false);
    setShowMaterialForm(false);
    setShowTermForm(false);
  }

  // ---------- subjects ----------
  function addSubject(name: string, color: string) {
    if (!name.trim()) return;
    setData((d) => ({
      ...d,
      subjects: [...d.subjects, { id: uid(), name: name.trim(), color, chapters: [] }],
    }));
    setShowSubjectForm(false);
  }
  function deleteSubject(id: string) {
    setData((d) => ({
      subjects: d.subjects.filter((s) => s.id !== id),
      materials: d.materials.filter((m) => m.subjectId !== id),
      glossary: d.glossary.map((g) => (g.subjectId === id ? { ...g, subjectId: null } : g)),
    }));
    if (activeSubjectId === id) setActiveSubjectId(null);
  }

  // ---------- chapters ----------
  function addChapter(subjectId: string, title: string) {
    if (!title.trim()) return;
    setData((d) => ({
      ...d,
      subjects: d.subjects.map((s) =>
        s.id === subjectId ? { ...s, chapters: [...s.chapters, { id: uid(), title: title.trim() }] } : s
      ),
    }));
  }
  function deleteChapter(subjectId: string, chapterId: string) {
    setData((d) => ({
      ...d,
      subjects: d.subjects.map((s) =>
        s.id === subjectId ? { ...s, chapters: s.chapters.filter((c) => c.id !== chapterId) } : s
      ),
    }));
  }

  // ---------- materials ----------
  function addMaterial(title: string, content: string, url: string, table?: string[][], flashcards?: Flashcard[]) {
    if (!title.trim() || !activeSubjectId) return;
    setData((d) => ({
      ...d,
      materials: [
        ...d.materials,
        {
          id: uid(),
          subjectId: activeSubjectId,
          title: title.trim(),
          content: content.trim(),
          url: url.trim(),
          ...(table && table.length > 0 ? { table } : {}),
          ...(flashcards && flashcards.length > 0 ? { flashcards } : {}),
        },
      ],
    }));
    setShowMaterialForm(false);
  }
  function deleteMaterial(id: string) {
    setData((d) => ({ ...d, materials: d.materials.filter((m) => m.id !== id) }));
  }

  // ---------- glossary ----------
  function addTerm(term: string, definition: string, subjectId: string | null) {
    if (!term.trim() || !definition.trim()) return;
    setData((d) => ({
      ...d,
      glossary: [...d.glossary, { id: uid(), term: term.trim(), definition: definition.trim(), subjectId }],
    }));
    setShowTermForm(false);
  }
  function deleteTerm(id: string) {
    setData((d) => ({ ...d, glossary: d.glossary.filter((t) => t.id !== id) }));
  }

  return (
    <div className="studovna">
      <div className="wrap">
        <header>
          <div className="brand">
            <h1>Studovna</h1>
            <p>studijní materiály &amp; slovník na jednom místě</p>
          </div>
          <nav>
            <button className={view === 'materials' ? 'active' : ''} onClick={() => changeView('materials')}>
              Materiály
            </button>
            <button className={view === 'glossary' ? 'active' : ''} onClick={() => changeView('glossary')}>
              Slovník
            </button>
          </nav>
        </header>

        {view === 'materials' ? (
          activeSubjectId ? (
            <SubjectDetail
              subject={data.subjects.find((s) => s.id === activeSubjectId)!}
              materials={data.materials.filter((m) => m.subjectId === activeSubjectId)}
              glossary={data.glossary}
              showForm={showMaterialForm}
              onToggleForm={() => setShowMaterialForm((v) => !v)}
              onBack={() => setActiveSubjectId(null)}
              onAdd={addMaterial}
              onDelete={deleteMaterial}
              onAddChapter={(title) => addChapter(activeSubjectId, title)}
              onDeleteChapter={(chapterId) => deleteChapter(activeSubjectId, chapterId)}
            />
          ) : (
            <SubjectsView
              subjects={data.subjects}
              materials={data.materials}
              showForm={showSubjectForm}
              onToggleForm={() => setShowSubjectForm((v) => !v)}
              onOpen={setActiveSubjectId}
              onAdd={addSubject}
              onDelete={deleteSubject}
            />
          )
        ) : (
          <GlossaryView
            glossary={data.glossary}
            subjects={data.subjects}
            search={search}
            onSearch={setSearch}
            showForm={showTermForm}
            onToggleForm={() => setShowTermForm((v) => !v)}
            onAdd={addTerm}
            onDelete={deleteTerm}
          />
        )}

        <div className="status">{status}</div>
      </div>
    </div>
  );
}

/* ============ Materials: subject grid ============ */

function SubjectsView(props: {
  subjects: Subject[];
  materials: Material[];
  showForm: boolean;
  onToggleForm: () => void;
  onOpen: (id: string) => void;
  onAdd: (name: string, color: string) => void;
  onDelete: (id: string) => void;
}) {
  const { subjects, materials, showForm, onToggleForm, onOpen, onAdd, onDelete } = props;
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);

  function submit() {
    onAdd(name, color);
    setName('');
    setColor(SWATCHES[0]);
  }

  return (
    <>
      <div className="toolbar">
        <h2>Předměty</h2>
        <button className="btn primary" onClick={onToggleForm}>
          + Nový předmět
        </button>
      </div>

      {showForm && (
        <div className="panel">
          <h3>Nový předmět</h3>
          <div className="field">
            <label>Název</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="např. Analytická chemie"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Barva</label>
            <div className="swatches">
              {SWATCHES.map((c) => (
                <div
                  key={c}
                  className={`swatch ${c === color ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn primary" onClick={submit}>
              Uložit
            </button>
            <button className="btn ghost" onClick={onToggleForm}>
              Zrušit
            </button>
          </div>
        </div>
      )}

      {subjects.length === 0 && !showForm ? (
        <div className="empty">
          <b>Zatím žádné předměty</b>
          Vytvoř první předmět a přidej k němu poznámky, skripta nebo odkazy.
        </div>
      ) : (
        <div className="subject-grid">
          {subjects.map((s) => {
            const count = materials.filter((m) => m.subjectId === s.id).length;
            return (
              <div key={s.id} className="subject-card" onClick={() => onOpen(s.id)}>
                <div className="tab" style={{ background: s.color }} />
                <button
                  className="del"
                  title="Smazat předmět"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                >
                  ✕
                </button>
                <h3>{s.name}</h3>
                <div className="count">
                  {count} {pluralMaterialu(count)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ============ Materials: single subject detail ============ */

type MaterialTab = 'notes' | 'table' | 'flashcards';

const emptyTable: string[][] = [['', '']];

function SubjectDetail(props: {
  subject: Subject;
  materials: Material[];
  glossary: GlossaryTerm[];
  showForm: boolean;
  onToggleForm: () => void;
  onBack: () => void;
  onAdd: (title: string, content: string, url: string, table?: string[][], flashcards?: Flashcard[]) => void;
  onDelete: (id: string) => void;
  onAddChapter: (title: string) => void;
  onDeleteChapter: (chapterId: string) => void;
}) {
  const { subject, materials, glossary, showForm, onToggleForm, onBack, onAdd, onDelete, onAddChapter, onDeleteChapter } =
    props;

  const [activeTab, setActiveTab] = useState<MaterialTab>('notes');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [tableData, setTableData] = useState<string[][]>(emptyTable);
  const [cardName, setCardName] = useState('');
  const [cardExplanation, setCardExplanation] = useState('');

  function resetForm() {
    setActiveTab('notes');
    setTitle('');
    setContent('');
    setUrl('');
    setTableData(emptyTable);
    setCardName('');
    setCardExplanation('');
  }

  function handleToggle() {
    if (showForm) resetForm();
    onToggleForm();
  }

  function submit() {
    let finalTitle = title.trim();
    let finalContent = '';
    let finalUrl = '';
    let finalTable: string[][] | undefined;
    let finalFlashcards: Flashcard[] | undefined;

    if (activeTab === 'notes') {
      if (!finalTitle) return;
      finalContent = content;
      finalUrl = url;
    } else if (activeTab === 'table') {
      if (!finalTitle) return;
      if (tableData.some((row) => row.some((cell) => cell.trim() !== ''))) finalTable = tableData;
    } else if (activeTab === 'flashcards') {
      const name = cardName.trim();
      const explanation = cardExplanation.trim();
      if (!name) return;
      finalFlashcards = [{ id: uid(), name, explanation }];
      // there is no separate Název field for flashcards — use the card's own name
      finalTitle = name;
    }

    onAdd(finalTitle, finalContent, finalUrl, finalTable, finalFlashcards);
    resetForm();
  }

  function addTableColumn() {
    setTableData((prev) => prev.map((row) => [...row, '']));
  }
  function addTableRow() {
    setTableData((prev) => [...prev, Array(prev[0]?.length || 1).fill('')]);
  }
  function removeTableColumn(ci: number) {
    setTableData((prev) => prev.map((row) => row.filter((_, i) => i !== ci)));
  }
  function removeTableRow(ri: number) {
    setTableData((prev) => prev.filter((_, i) => i !== ri));
  }
  function updateTableCell(ri: number, ci: number, value: string) {
    setTableData((prev) => prev.map((row, r) => (r === ri ? row.map((c, i) => (i === ci ? value : c)) : row)));
  }

  function submitChapter() {
    onAddChapter(chapterTitle);
    setChapterTitle('');
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>
        ← Zpět na předměty
      </button>

      <div className="subject-detail-layout">
        <aside className="subject-aside">
          <h2 style={{ color: subject.color }}>{subject.name}</h2>

          <h3 className="aside-heading">Kapitoly</h3>
          {subject.chapters.length === 0 ? (
            <p className="aside-empty">Zatím žádné kapitoly.</p>
          ) : (
            <ol className="chapter-list">
              {subject.chapters.map((c: Chapter) => (
                <li key={c.id} className="chapter-item">
                  <span>{c.title}</span>
                  <button className="del" title="Smazat kapitolu" onClick={() => onDeleteChapter(c.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="chapter-add">
            <input
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="Nová kapitola…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitChapter();
              }}
            />
            <button className="btn small" onClick={submitChapter}>
              +
            </button>
          </div>
        </aside>

        <div className="subject-main">
          <div className="toolbar">
            <h2>Materiály</h2>
            <button className="btn primary" onClick={handleToggle}>
              {showForm ? 'Zavřít' : '+ Přidat materiál'}
            </button>
          </div>

          {showForm && (
            <div className="panel">
              <h3>Nový materiál</h3>

              <div className="type-tabs">
                <button
                  type="button"
                  className={`type-tab ${activeTab === 'notes' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notes')}
                >
                  Poznámky
                </button>
                <button
                  type="button"
                  className={`type-tab ${activeTab === 'table' ? 'active' : ''}`}
                  onClick={() => setActiveTab('table')}
                >
                  Tabulka
                </button>
                <button
                  type="button"
                  className={`type-tab ${activeTab === 'flashcards' ? 'active' : ''}`}
                  onClick={() => setActiveTab('flashcards')}
                >
                  Kartičky
                </button>
              </div>

              {activeTab === 'notes' && (
                <>
                  <div className="field">
                    <label>Název</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="např. Poznámky z přednášky 4"
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Poznámka / obsah</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Shrnutí, co materiál obsahuje…"
                    />
                  </div>
                  <div className="field">
                    <label>Odkaz (nepovinné)</label>
                    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
                  </div>
                </>
              )}

              {activeTab === 'table' && (
                <>
                  <div className="field">
                    <label>Název</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="např. Přehled reakcí"
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Tabulka</label>
                    <div className="table-builder">
                      <table className="table-builder-grid">
                        <thead>
                          <tr>
                            {tableData[0]?.map((_, ci) => (
                              <th key={ci}>
                                <button
                                  type="button"
                                  className="cell-del"
                                  title="Smazat sloupec"
                                  disabled={tableData[0].length <= 1}
                                  onClick={() => removeTableColumn(ci)}
                                >
                                  ✕
                                </button>
                              </th>
                            ))}
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, ri) => (
                            <tr key={ri} className={ri === 0 ? 'header-row' : ''}>
                              {row.map((cell, ci) => (
                                <td key={ci}>
                                  <input
                                    value={cell}
                                    onChange={(e) => updateTableCell(ri, ci, e.target.value)}
                                    placeholder={ri === 0 ? `Sloupec ${ci + 1}` : ''}
                                  />
                                </td>
                              ))}
                              <td>
                                <button
                                  type="button"
                                  className="cell-del"
                                  title="Smazat řádek"
                                  disabled={tableData.length <= 1}
                                  onClick={() => removeTableRow(ri)}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="table-builder-actions">
                        <button className="btn small" type="button" onClick={addTableColumn}>
                          + Sloupec
                        </button>
                        <button className="btn small" type="button" onClick={addTableRow}>
                          + Řádek
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'flashcards' && (
                <div className="flashcard-block">
                  <div className="field">
                    <label>Název</label>
                    <input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Název kartičky"
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Zadní strana (vysvětlivka)</label>
                    <textarea
                      value={cardExplanation}
                      onChange={(e) => setCardExplanation(e.target.value)}
                      placeholder="Co pojem znamená…"
                    />
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button className="btn primary" onClick={submit}>
                  Uložit
                </button>
                <button className="btn ghost" onClick={handleToggle}>
                  Zrušit
                </button>
              </div>
            </div>
          )}

          {materials.length === 0 && !showForm ? (
            <div className="empty">
              <b>Zatím prázdno</b>
              Přidej první materiál k tomuto předmětu.
            </div>
          ) : (
            materials.map((m) => (
              <div key={m.id} className="material-item" style={{ borderLeftColor: subject.color }}>
                <button className="del" title="Smazat" onClick={() => onDelete(m.id)}>
                  ✕
                </button>
                <h4>{highlightGlossary(m.title, glossary)}</h4>
                {m.content && <p>{highlightGlossary(m.content, glossary)}</p>}
                {m.table && m.table.length > 0 && (
                  <table className="material-table">
                    <thead>
                      <tr>
                        {m.table[0].map((cell, ci) => (
                          <th key={ci}>{highlightGlossary(cell, glossary)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {m.table.slice(1).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{highlightGlossary(cell, glossary)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {m.flashcards && m.flashcards.length > 0 && (
                  <div className="flashcard-grid">
                    {m.flashcards.map((c) => (
                      <FlashcardView key={c.id} card={c} glossary={glossary} />
                    ))}
                  </div>
                )}
                {m.url && (
                  <div style={{ marginTop: 5 }}>
                    <a href={m.url} target="_blank" rel="noopener noreferrer">
                      {m.url}
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function FlashcardView(props: { card: Flashcard; glossary: GlossaryTerm[] }) {
  const { card, glossary } = props;
  const [flipped, setFlipped] = useState(false);

  return (
    <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)} title="Klikni pro otočení">
      <div className="flashcard-back">{highlightGlossary(card.explanation, glossary)}</div>
      <div className="flashcard-front">
        <strong>{highlightGlossary(card.name, glossary)}</strong>
      </div>
    </div>
  );
}

/* ============ Glossary ============ */

function GlossaryView(props: {
  glossary: GlossaryTerm[];
  subjects: Subject[];
  search: string;
  onSearch: (v: string) => void;
  showForm: boolean;
  onToggleForm: () => void;
  onAdd: (term: string, definition: string, subjectId: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const { glossary, subjects, search, onSearch, showForm, onToggleForm, onAdd, onDelete } = props;
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [subjectId, setSubjectId] = useState('');

  function submit() {
    onAdd(term, definition, subjectId || null);
    setTerm('');
    setDefinition('');
    setSubjectId('');
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return glossary
      .filter((t) => !q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q))
      .sort((a, b) => a.term.localeCompare(b.term, 'cs'));
  }, [glossary, search]);

  const lettersPresent = useMemo(() => new Set(filtered.map((t) => (t.term[0] || '#').toUpperCase())), [filtered]);

  function jumpTo(letter: string) {
    document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let currentLetter = '';

  return (
    <>
      <div className="toolbar">
        <h2>Slovník pojmů</h2>
        <button className="btn primary" onClick={onToggleForm}>
          + Nový pojem
        </button>
      </div>

      {showForm && (
        <div className="panel">
          <h3>Nový pojem</h3>
          <div className="field">
            <label>Slovo / pojem</label>
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="např. Osmóza" autoFocus />
          </div>
          <div className="field">
            <label>Definice</label>
            <textarea
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Vysvětlení pojmu vlastními slovy…"
            />
          </div>
          <div className="field">
            <label>Předmět (nepovinné)</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— bez přiřazení —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button className="btn primary" onClick={submit}>
              Uložit
            </button>
            <button className="btn ghost" onClick={onToggleForm}>
              Zrušit
            </button>
          </div>
        </div>
      )}

      <div className="search-row">
        <input placeholder="Hledat pojem…" value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>

      <div className="gloss-layout">
        <div className="gloss-main">
          {filtered.length === 0 ? (
            <div className="empty">
              {glossary.length === 0 ? (
                <>
                  <b>Slovník je zatím prázdný</b>
                  Přidej první pojem a jeho definici — postupně z toho vznikne tvůj vlastní studijní slovník.
                </>
              ) : (
                <>Žádný pojem neodpovídá hledání „{search}“.</>
              )}
            </div>
          ) : (
            filtered.map((t) => {
              const letter = (t.term[0] || '#').toUpperCase();
              const showHeading = letter !== currentLetter;
              currentLetter = letter;
              const subject = subjects.find((s) => s.id === t.subjectId);
              return (
                <React.Fragment key={t.id}>
                  {showHeading && (
                    <div className="letter-heading" id={`letter-${letter}`}>
                      {letter}
                    </div>
                  )}
                  <div className="term-entry">
                    <button className="del" title="Smazat" onClick={() => onDelete(t.id)}>
                      ✕
                    </button>
                    <div className="term-row">
                      <h4>{t.term}</h4>
                      {subject && (
                        <span className="tag" style={{ background: subject.color }}>
                          {subject.name}
                        </span>
                      )}
                    </div>
                    <p>{t.definition}</p>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="az-rail">
          {ALPHABET.map((l) => (
            <button key={l} className={lettersPresent.has(l) ? 'has' : ''} disabled={!lettersPresent.has(l)} onClick={() => jumpTo(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}