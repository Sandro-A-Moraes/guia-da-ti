import characters from './assets/home/personagens.png';

const crops = {
  peek: '45 235 420 310',
  point: '545 120 315 420',
  community: '5 660 520 320',
  contact: '975 670 470 310',
} as const;

export function GuideCharacter({ pose, className = '' }: { pose: keyof typeof crops; className?: string }) {
  return <svg viewBox={crops[pose]} aria-hidden="true" focusable="false" className={`guide-character ${className}`}>
    <image href={characters} width="1448" height="1086" />
  </svg>;
}
