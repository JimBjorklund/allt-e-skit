// Loads shout lines and joke lines from plain text files in public/.
export function parseLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

async function load(file, fallback) {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
    if (!res.ok) return fallback;
    const lines = parseLines(await res.text());
    return lines.length ? lines : fallback;
  } catch {
    return fallback;
  }
}

export async function loadContent() {
  const [shouts, jokes] = await Promise.all([
    load('shouts.txt', ['NOT AGAIN!']),
    load('jokes.txt', ['Welcome to the village']),
  ]);
  return { shouts, jokes };
}
