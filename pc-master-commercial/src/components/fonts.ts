import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// Inter / Inter Display (OFL) + JetBrains Mono (OFL) — поддерживают кириллицу и польские символы.
const FACES: [string, string, number][] = [
  ['Inter', 'Inter-Regular.otf', 400],
  ['Inter', 'Inter-Medium.otf', 500],
  ['Inter', 'Inter-SemiBold.otf', 600],
  ['Inter', 'Inter-Bold.otf', 700],
  ['Inter Display', 'InterDisplay-SemiBold.otf', 600],
  ['Inter Display', 'InterDisplay-Bold.otf', 700],
  ['Inter Display', 'InterDisplay-ExtraBold.otf', 800],
  ['Inter Display', 'InterDisplay-Black.otf', 900],
  ['JetBrains Mono', 'jetbrains-mono-latin-500-normal.woff2', 500],
  ['JetBrains Mono', 'jetbrains-mono-cyrillic-500-normal.woff2', 500],
  ['JetBrains Mono', 'jetbrains-mono-latin-700-normal.woff2', 700],
  ['JetBrains Mono', 'jetbrains-mono-cyrillic-700-normal.woff2', 700],
];

let promise: Promise<void> | null = null;
const loadAll = () => {
  if (!promise) {
    promise = Promise.all(
      FACES.map(async ([family, file, weight]) => {
        const ff = new FontFace(family, `url(${staticFile('fonts/' + file)})`, {weight: String(weight)});
        await ff.load();
        (document.fonts as unknown as Set<FontFace>).add(ff);
      })
    ).then(() => undefined);
  }
  return promise;
};

// Сцены рендерятся только после загрузки шрифтов — иначе текстуры с надписями нарисуются запасным шрифтом.
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    loadAll().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready;
};

export const FONT = {
  display: '"Inter Display", "Inter", sans-serif',
  text: '"Inter", sans-serif',
  mono: '"JetBrains Mono", monospace',
};
