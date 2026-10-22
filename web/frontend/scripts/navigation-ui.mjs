import assert from 'node:assert/strict';

// Sample actual painted frames across full-document route navigation.
export async function checkRouteFlash({send,evaluate,waitFor,navigate}) {
  const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:
    "window.routeFrames=[];window.routeSamplingDone=false;let start;function sample(time){start??=time;const main=document.querySelector('main');if(main&&getComputedStyle(main).display==='flex'){window.routeFrames.push({dark:document.documentElement.classList.contains('dark'),opacity:Number(getComputedStyle(main).opacity),background:getComputedStyle(document.body).backgroundColor});}if(time-start<1200)requestAnimationFrame(sample);else window.routeSamplingDone=true;}requestAnimationFrame(sample);"
  });
  try {
    await send('Emulation.setCPUThrottlingRate',{rate:4});
    for(const motion of ['no-preference','reduce']) {
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:motion}]});
      for(const theme of ['light','dark']) {
        await evaluate('localStorage.setItem("theme",'+JSON.stringify(theme)+')');
        for(const route of ['/comunidades/','/criadores/','/forum/']) {
          await navigate(route);
          await waitFor('window.routeSamplingDone');
          const frames=await evaluate('window.routeFrames');
          assert.ok(frames.length>0,'No painted frames sampled: '+route);
          assert.ok(frames.every(frame=>frame.dark===(theme==='dark')), 'Theme flashed on '+route+' ('+theme+', '+motion+'): '+JSON.stringify(frames));
          if(motion==='reduce') assert.ok(frames.every(frame=>frame.opacity===1),'Reduced motion hid content: '+route);
          else {
            assert.ok(frames.some(frame=>frame.opacity<1),'Missing route entrance animation: '+route);
            assert.ok(frames.every((frame,index)=>!index || frame.opacity>=frames[index-1].opacity-0.002),'Entrance flashed backward: '+route);
            await waitFor("Number(getComputedStyle(document.querySelector('main')).opacity)===1");
          }
        }
      }
    }
  } finally {
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
    await send('Emulation.setCPUThrottlingRate',{rate:1});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate('localStorage.setItem("theme","light")');
    await navigate('/');
  }
}
