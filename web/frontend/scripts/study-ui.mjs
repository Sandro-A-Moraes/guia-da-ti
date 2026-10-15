import assert from "node:assert/strict";
import { studyTypes } from "../src/study-ranking.ts";
export async function installStudyFixtures(send, catalog) {
  const records = catalog.resources
    .filter((r) => studyTypes.has(r.type))
    .map((r) => ({
      key: `${r.type}/${r.slug}`,
      average: null,
      ratings: 0,
      hypes: 0,
      comments: 0,
      discussion: null,
      myRating: null,
      myHype: false,
    }));
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      const studyFetch=window.fetch.bind(window);
      const studyRecords=${JSON.stringify(records)};
      window.fetch=async(input,options)=>{
        const url=new URL(String(input),location.origin);
        if(url.pathname==='/api/study/activity') return sessionStorage.getItem('studyTestMode')==='error'?Response.json({error:'Indisponível'},{status:503}):Response.json(studyRecords);
        const match=url.pathname.match(/^\\/api\\/study\\/([^/]+)\\/([^/]+)\\/(vote|comments)$/);
        if(match){
          const data=JSON.parse(options.body);window.lastStudyPublication={path:url.pathname,data,csrf:options.headers['X-CSRF-Token']};
          const a=studyRecords.find(r=>r.key===match[1]+'/'+match[2]);
          if(match[3]==='vote'){
            if(data.rating!=null){a.myRating=data.rating;a.average=data.rating;a.ratings=1;}
            if(data.hype!=null){a.myHype=data.hype;a.hypes=data.hype?1:0;}
            return Response.json({saved:true});
          }
          a.discussion=7;a.comments++;return Response.json({number:7});
        }
        return studyFetch(input,options);
      };`,
  });
}
export async function checkStudy({
  send,
  evaluate,
  waitFor,
  navigate,
  click,
  selectOption,
}) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate("/plataformas/");
  await waitFor(
    `!!document.querySelector('[aria-label="Cards: Plataformas de cursos"]') && !document.querySelector('main [role="status"]')`,
  );
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('[aria-label="Cards: Plataformas de cursos"]')).gridTemplateColumns.split(' ').length`,
    ),
    4,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[aria-label="Exibir cards"]').getAttribute('aria-pressed')`,
    ),
    "true",
  );
  await click(`document.querySelector('[aria-label="Exibir lista"]')`);
  await waitFor(`!!document.querySelector('[aria-label="Lista: Plataformas de cursos"]')`);
  assert.equal(
    await evaluate(`new URLSearchParams(location.search).get('visualizacao')`),
    "lista",
  );
  await selectOption("Ordenar por", "Mais comentado");
  assert.equal(
    await evaluate(`new URLSearchParams(location.search).get('ordem')`),
    "comments",
  );
  await navigate('/cursos/curso-exemplo/');
  await waitFor(
    `!!document.querySelector('[aria-label="Avaliações e discussão"]')`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('main').textContent.includes('não recebe avaliações ou comentários')`,
    ),
    true,
  );
  assert.equal(
    await evaluate(`!!document.querySelector('[role="radiogroup"]')`),
    false,
    "Fictional items cannot collect real ratings",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await navigate("/roadmaps/");
  await waitFor(`!!document.querySelector('[aria-label="Cards: Roadmaps"]')`);
  assert.equal(
    await evaluate(
      `getComputedStyle(document.querySelector('[aria-label="Cards: Roadmaps"]')).gridTemplateColumns.split(' ').length`,
    ),
    1,
  );
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
    true,
  );
  await evaluate(`sessionStorage.setItem('studyTestMode','error')`);
  await navigate("/plataformas/");
  await waitFor(
    `document.querySelector('main [role="alert"]')?.textContent.includes('A atividade dos itens não carregou. Tente novamente.')`,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('main').textContent.includes('— comentários')`,
    ),
    true,
    "Failed reads do not display fictional zeros",
  );
  await evaluate(`sessionStorage.removeItem('studyTestMode')`);
  await click(
    `[...document.querySelectorAll('main button')].find(b=>b.textContent==='Tentar novamente')`,
  );
  await waitFor(
    `!document.querySelector('main [role="alert"]') && document.querySelector('main').textContent.includes('0 comentários')`,
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  console.log(
    "Study UI OK: four-column cards, list, sort URL, detail route, fictional-item protection, mobile and unavailable activity.",
  );
}
