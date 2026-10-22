import snapshot from './generated/catalog.json';
import navigation from './navigation.json';
import type { CommunityLocation } from './community-location';
export type Resource = {
  slug: string; type: string; name: string; summary: string; description: string;
  url: string; imageUrl?: string; discussionNumber?: number; areas: string[]; technologies: string[]; languages: string[]; universityType?: "public" | "private"; countries?: string[]; creatorCategories?: string[]; communityLocation?: CommunityLocation; communityPlatforms?: string[]; communityModality?: string; communityAudience?: string; communityLinks?: {platform:string;url:string}[]; communityMembers?:{count:number;moreThan?:boolean;checkedAt:string}; updatedAt: string; demo?: boolean;
};
export const resources = snapshot.resources as Resource[];
export const taxonomy = snapshot.taxonomy;
export const groups = navigation;
export const categories = [...groups.flatMap(group => group.categories), { id: 'youtube', route: 'youtube', name: 'YouTube' }];
export const listingCategories = categories.filter(category => !['courses', 'youtube'].includes(category.id));
export const labels: Record<string, string> = { geral: 'Geral', networking: 'Networking', eventos: 'Eventos', vagas: 'Vagas', frontend: 'Front-end', backend: 'Back-end', dados: 'Dados', devops: 'DevOps', cybersecurity: 'Segurança', design: 'Design', produto: 'Produto', cloud: 'Cloud', qa: 'Qualidade', mobile: 'Mobile', ia: 'Inteligência artificial', redes: 'Redes', hardware: 'Hardware', carreira: 'Carreira', educacao: 'Educação', react: 'React', typescript: 'TypeScript', csharp: 'C#', dotnet: '.NET', python: 'Python', linux: 'Linux', figma: 'Figma', US: 'Estados Unidos' };
export const resourcePath = (r: Resource) => `/${categories.find(c => c.id === r.type)!.route}/${r.slug}`;
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function pageInfo(path: string) {
  const parts = path.split('/').filter(Boolean);
  const category = categories.find(c => c.route === parts[0]);
  const resource = parts.length === 2 && category ? resources.find(r => r.type === category.id && r.slug === parts[1]) : undefined;
  const area = parts.length === 2 && parts[0] === 'areas' && taxonomy.areas.includes(parts[1]) ? parts[1] : undefined;
  const technology = parts.length === 2 && parts[0] === 'tecnologias' && taxonomy.technologies.includes(parts[1]) ? parts[1] : undefined;
  const valid = ['/', '/forum', '/divulgue', '/empresas', '/admin/anuncios'].includes(path) || (parts.length === 1 && listingCategories.some(item => item === category)) || !!resource || !!area || !!technology;
  const title = !valid ? 'Página não encontrada' : resource?.name ?? (area ? labels[area] : technology ? labels[technology] : undefined) ?? category?.name ?? (path === '/' ? 'Início' : path === '/forum' ? 'Fórum da comunidade' : path === '/divulgue' || path === '/empresas' ? 'Divulgue no Guia da TI' : 'Explore tecnologia');
  if (path === '/divulgue' || path === '/empresas') return { category, resource, area, technology, valid, title, description: 'Conheça as opções para divulgar projetos, conteúdos e soluções no Guia da TI.' };
  if (path === '/admin/anuncios') return { category, resource, area, technology, valid, title: 'Administração de anúncios', description: 'Painel restrito para administrar as campanhas do Guia da TI.' };
  return { category, resource, area, technology, valid, title, description: resource ? `Indicação de ${resource.name}. ${resource.summary} Acesse o conteúdo no site de origem.` : (path === '/' ? 'Encontre links de tecnologia, comunidades e oportunidades para escolher seu próximo passo.' : path === '/forum' ? 'Tire dúvidas e compartilhe experiências sobre tecnologia no fórum do Guia da TI.' : 'Encontre links para cursos, artigos, ferramentas, comunidades e oportunidades de tecnologia em outros sites.') };
}
export const routes = ['/', '/forum', '/divulgue', ...listingCategories.map(c => `/${c.route}`), ...resources.map(resourcePath), ...taxonomy.areas.map(a => `/areas/${a}`), ...taxonomy.technologies.map(t => `/tecnologias/${t}`)];
