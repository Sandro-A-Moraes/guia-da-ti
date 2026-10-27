import { useEffect, useState } from 'react';
import { LoadingImage } from './LoadingImage';

type Person = { login: string; url: string; avatarUrl: string };
type Contributor = Person & { contributions: number };
type Credits = { creator: Person | null; contributors: Contributor[] };

const githubProfile = (value: unknown): value is Person => {
  const person = value as Person;
  return !!person && typeof person.login === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(person.login)
    && typeof person.url === 'string' && person.url === `https://github.com/${person.login}`
    && typeof person.avatarUrl === 'string' && person.avatarUrl.startsWith('https://');
};

function Avatar({ person }: { person: Person }) {
  return <LoadingImage src={person.avatarUrl} alt="" width={20} height={20} referrerPolicy="no-referrer" className="size-5 shrink-0 rounded-full bg-muted" imageClassName="rounded-full object-cover" />;
}

function PersonLink({ person }: { person: Person }) {
  return <a href={person.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"><Avatar person={person} />@{person.login}</a>;
}

// Credits come from the Git history. Any failure leaves the page without them.
export function RoadmapContributors({ slug }: { slug: string }) {
  const [credits, setCredits] = useState<Credits | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/roadmaps/${encodeURIComponent(slug)}/contributors`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('unavailable')))
      .then((data: Partial<Credits>) => {
        const creator = githubProfile(data.creator) ? data.creator : null;
        const contributors = Array.isArray(data.contributors) ? data.contributors.filter((person): person is Contributor => githubProfile(person) && person.login !== creator?.login) : [];
        setCredits(creator || contributors.length ? { creator, contributors } : null);
      })
      .catch(() => setCredits(null));
    return () => controller.abort();
  }, [slug]);
  if (!credits) return null;
  return <section aria-label="Autoria do roadmap" className="flex flex-col gap-2 text-sm text-muted-foreground">
    {credits.creator && <p className="flex flex-wrap items-center gap-2">Criado por <PersonLink person={credits.creator} /></p>}
    {credits.contributors.length > 0 && <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span>Contribuições de</span><ul className="flex flex-wrap gap-x-3 gap-y-2">{credits.contributors.map(person => <li key={person.login}><PersonLink person={person} /></li>)}</ul></div>}
  </section>;
}
