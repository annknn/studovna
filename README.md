# Studovna (React + TypeScript)

Tři soubory ke stažení do libovolného React+TS projektu (Vite, Next.js atd.):

- `types.ts` — datové typy (`Subject`, `Material`, `GlossaryTerm`)
- `Studovna.tsx` — hlavní komponenta se vší logikou
- `Studovna.css` — vzhled, včetně zeleného podtečkování pojmů a tooltipu

## Použití

```tsx
import Studovna from './Studovna';

function App() {
  return <Studovna />;
}

export default App;
```

Žádné další závislosti nejsou potřeba — jen React 18+ a podporu CSS `content: attr(...)` a lookbehind regexů (běžné moderní prohlížeče).

## Ukládání dat

Komponenta si data ukládá do `localStorage` prohlížeče pod klíčem `study-hub-data`, takže fungují okamžitě bez backendu. Pokud později budeš chtít data synchronizovat mezi zařízeními, stačí nahradit volání `localStorage` v `Studovna.tsx` (funkce `loadInitialData` a `useEffect`, který ukládá) voláním na tvůj vlastní backend/API.

## Zvýrazňování pojmů

Funkce `highlightGlossary` v `Studovna.tsx` prohledává text materiálu a jakékoli slovo odpovídající pojmu ve slovníku obalí do `<span className="gloss-highlight" data-def="...">`. Vzhled (zelené tečkované podtržení + bublina s definicí při najetí myší) je čistě v CSS, takže žádný JS pro tooltip není potřeba.
