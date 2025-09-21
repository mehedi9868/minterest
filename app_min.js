
// === Added for image/video count badges ===
let imageCount = 0;
let videoCount = 0;
let totalsEl = null;

function updateTotalsBadge(){
  try{
    const bar = document.querySelector('.toggle-bar');
    if(!bar) return;
    if(!totalsEl){
      totalsEl = document.createElement('div');
      totalsEl.id = 'totals';
      totalsEl.className = 'totals-badge';
      bar.appendChild(totalsEl);
    }
    totalsEl.textContent = `ছবি: ${imageCount} · ভিডিও: ${videoCount}`;
    totalsEl.setAttribute('aria-label', `মোট ছবি ${imageCount} এবং ভিডিও ${videoCount}`);
  }catch(e){}
}
'use strict';

/* ========= Config ========= */
const API_KEY = "AIzaSyDUE_P391KSJ4gC6-FG8ch-XeinTh4gUT8";   // <-- আপনার Drive API key
const REQUIRED_PASSWORD = "iloveyou";                        // <-- পাসওয়ার্ড
const ANOTHER_PASSWORD = "50607080";
const DEFAULT_DRIVE_URL = "https://drive.google.com/drive/folders/12qLQqg_gjw7gGcmbJ4dIGeNe6iRigahy";
/* ========================== */

let grid, toast, overlay, pwdInput;
let firstImageSquared = false;
let currentView = 'image'; // default
const seen = new Set();
let renderCount = 0; // counts rendered media to assign size pattern

// Observer for scroll animation
const observer = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
},{threshold:0.1});


function syncToggleFromView(){
  try{
    const mediaToggle = document.getElementById('mediaToggle');
    if(!mediaToggle) return;
    if(currentView==='video'){ mediaToggle.classList.add('active'); }
    else { mediaToggle.classList.remove('active'); }
    mediaToggle.setAttribute('aria-checked', mediaToggle.classList.contains('active') ? 'true' : 'false');
  }catch(e){}
}


function saveStateExtras(){
  try{
    localStorage.setItem('drivepins_firstImageSquared', JSON.stringify(firstImageSquared));
    localStorage.setItem('drivepins_view', currentView);
  }catch(e){}
}
function loadStateExtras(){
  try{
    const fis = localStorage.getItem('drivepins_firstImageSquared');
    if(fis !== null) firstImageSquared = JSON.parse(fis);
    const v = localStorage.getItem('drivepins_view');
    if(v) currentView = v;
  }catch(e){}
}


function showToast(msg, ms = 2600){
  if(!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(()=> toast.style.display='none', ms);
}

function showSuccessOverlay(){
  const el = document.getElementById("success-overlay");
  if(!el) return;
  el.style.display = "flex";
  setTimeout(()=>{ el.style.display = "none"; }, 2000);
}

function saveBoard(){
  if(!grid) return;
  try{
    localStorage.setItem('drivepins_grid', grid.innerHTML);
    localStorage.setItem('drivepins_seen', JSON.stringify(Array.from(seen)));
    saveStateExtras();
  }catch(e){}
}
function resetBoard(){
  if(!grid) return;
  grid.innerHTML = '';
  try{ seen.clear(); localStorage.removeItem('drivepins_grid'); localStorage.removeItem('drivepins_seen'); localStorage.removeItem('drivepins_firstImageSquared'); localStorage.removeItem('drivepins_view'); }catch(e){}
  showToast('Reset Successful');
}
function loadBoard(){
  if(!grid) return;
  try{
    const html = localStorage.getItem('drivepins_grid');
    const ids = localStorage.getItem('drivepins_seen');
    if(html){ grid.innerHTML = html; 
      // Re-attach animation state for existing cards
      grid.querySelectorAll('.card').forEach(card=>{ card.classList.add('visible'); });
    }
    if(ids){ JSON.parse(ids).forEach(id=>seen.add(id)); }
    loadStateExtras();
  }catch(e){}
}

function openModal(){
  try{ if(overlay) overlay.style.display = 'flex'; }catch(e){}
  try{ pwdInput?.focus(); }catch(e){}
}
function closeModal(){
  try{ overlay.style.display = 'none'; }catch(e){}
  try{ pwdInput.value = ''; }catch(e){}
}

function getFolderIdFromUrl(url){
  if(!url) return null;
  try{
    const u = new URL(url);
    let m = u.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if(m) return m[1];
    const idParam = u.searchParams.get('id');
    if(idParam) return idParam;
    m = u.pathname.match(/\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/);
    if(m) return m[1];
    return null;
  }catch(e){ return null; }
}

async function listFolderFiles(folderId){
  const base = 'https://www.googleapis.com/drive/v3/files';
  const q = encodeURIComponent(`'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`);
  let pageToken = '';
  let added = 0;
  const all = [];

  do {
    const url = `${base}?q=${q}&fields=nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(API_KEY)}`;
    const res = await fetch(url);
    if(!res.ok){
      const err = await res.text();
      throw new Error(err || ('HTTP '+res.status));
    }
    const data = await res.json();
    const files = (data.files || []);
    for(const f of files){
      if(seen.has(f.id)) continue;
      all.push(f);
    }
    pageToken = data.nextPageToken || '';
  } while(pageToken);

  // Ensure first item is an image if any exists
  let ordered = [];
  const firstImgIdx = all.findIndex(f => (f.mimeType || '').startsWith('image/'));
  if(firstImgIdx > 0){
    ordered.push(all[firstImgIdx]);
    for(let i=0;i<all.length;i++){ if(i!==firstImgIdx) ordered.push(all[i]); }
  }else{
    ordered = all.slice();
  }

  for(const f of ordered){
    renderFileCard(f);
    seen.add(f.id);
    added++;
  }
  if(added>0) saveBoard();
  return added;
}

function renderFileCard(file){
  if(!grid) return;
  const isVideo = (file.mimeType || '').startsWith('video/');
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.type = isVideo ? 'video' : 'image';

  const link = document.createElement('a');
  link.href = file.webViewLink || '#';
  link.target = '_blank'; link.rel='noopener';

  const img = document.createElement('img');
  const thumb = file.thumbnailLink ? file.thumbnailLink.replace(/=s\\d+/, '=s2048') : `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`;
  img.src = thumb;
  img.alt = isVideo ? 'ভিডিও' : 'image';
  img.loading = 'lazy';
  // Assign one of five fixed size classes cyclically
  const slot = (renderCount % 5) + 1; // 1..5
  img.classList.add(`size-${slot}`);

link.appendChild(img);
  card.appendChild(link);
  // === Serial number badge ===
  const countBadge = document.createElement('div');
  countBadge.className = 'count-badge';
  if(isVideo){
    videoCount += 1;
    countBadge.textContent = String(videoCount);
    countBadge.setAttribute('aria-label', `ভিডিও নম্বর ${videoCount}`);
  }else{
    imageCount += 1;
    countBadge.textContent = String(imageCount);
    countBadge.setAttribute('aria-label', `ছবি নম্বর ${imageCount}`);
  }
  card.appendChild(countBadge);
  updateTotalsBadge();


  if(isVideo){
    const label = document.createElement('div');
    label.className = 'badge';
    label.textContent = 'ভিডিও';
    card.appendChild(label);
  }

  grid.appendChild(card);
  renderCount++;
  observer.observe(card);   // scroll animation
}

function showOnly(type){
  currentView = type;
  if(!grid) return;
  const cards = grid.querySelectorAll('.card');
  cards.forEach(card=>{
    const t = card.dataset.type || '';
    card.style.display = (type==='all' || t===type) ? '' : 'none';
  });
}

async function handleAdd(){
  try{
    const pwd = (pwdInput?.value || '');
    if(pwd !== REQUIRED_PASSWORD && pwd !== ANOTHER_PASSWORD){
      showToast('ভুল পাসওয়ার্ড ⚠️');
      return;
    }
    showSuccessOverlay();
    // always use default folder (clean build)
    let folderId = getFolderIdFromUrl(DEFAULT_DRIVE_URL);
    if(!folderId){
      showToast('ডিফল্ট ফোল্ডার সেট করা নেই বা ভুল।');
      return;
    }
    closeModal();
    showToast('Loading…');
    const added = await listFolderFiles(folderId);
    showOnly(currentView);
    showToast(added===0 ? 'ফাইল পাওয়া যায়নি 💔' : `${added} টি নতুন আইটেম যোগ হয়েছে`);
  }catch(err){
    console.error(err);
    showToast('লোড করতে সমস্যা হয়েছে (folder public? API Key ঠিক আছে?)');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  grid = document.getElementById('grid');
  toast = document.getElementById('toast');
  overlay = document.getElementById('overlay');
  pwdInput = document.getElementById('password');

  const fab = document.getElementById('fab');
  const btnReset = document.getElementById('btnReset');
  const btnCancel = document.getElementById('btnCancel');
  const btnAdd = document.getElementById('btnAdd');
  const mediaToggle = document.getElementById('mediaToggle');

  if(fab) fab.addEventListener('click', openModal);
  if(btnReset) btnReset.addEventListener('click', resetBoard);
  if(btnCancel) btnCancel.addEventListener('click', closeModal);
  if(btnAdd) btnAdd.addEventListener('click', handleAdd);

  if(mediaToggle){
    const apply = ()=>{
      const showType = mediaToggle.classList.contains('active') ? 'video' : 'image';
      showOnly(showType);
      mediaToggle.setAttribute('aria-checked', mediaToggle.classList.contains('active') ? 'true':'false');
    };
    mediaToggle.addEventListener('click', ()=>{ mediaToggle.classList.toggle('active'); apply(); });
    mediaToggle.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); mediaToggle.classList.toggle('active'); apply(); }
      if(e.key==='ArrowLeft'){ mediaToggle.classList.remove('active'); apply(); }
      if(e.key==='ArrowRight'){ mediaToggle.classList.add('active'); apply(); }
    });
    // (initial state will be synced after loadBoard)
  }

  loadBoard();
  showOnly(currentView);
  syncToggleFromView();

  // Save just before refresh/tab close
  window.addEventListener('beforeunload', saveBoard);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) saveBoard(); });
});


/* === Image/Video Serial & Totals (added by ChatGPT) === */
(function(){
  let imageCount = 0;
  let videoCount = 0;
  let totalsEl = null;
  let recalcScheduled = false;

  function getGridNodes(){
    // Try common containers; fallback to all cards in document
    const grids = Array.from(document.querySelectorAll('.grid, #grid, .cards, .cards-grid'));
    if(grids.length) return grids;
    return [document.body];
  }

  function ensureTotalsNode(){
    if(totalsEl && totalsEl.isConnected) return totalsEl;
    const bar = document.querySelector('.toggle-bar');
    totalsEl = document.createElement('div');
    totalsEl.id = 'totals';
    totalsEl.className = 'totals-badge';
    totalsEl.textContent = 'লোড হচ্ছে…';
    if(bar){
      bar.appendChild(totalsEl);
    }else{
      totalsEl.classList.add('fallback-fixed');
      document.body.appendChild(totalsEl);
    }
    return totalsEl;
  }

  function isVideoCard(card){
    // Priority 1: data-type hint
    const t = (card.dataset && card.dataset.type) ? String(card.dataset.type).toLowerCase() : '';
    if(t === 'video') return true;
    if(t === 'image' || t === 'img' || t === 'photo') return false;
    // Priority 2: tag detection within the card
    if(card.querySelector('video, source[type^="video/"]')) return true;
    // Priority 3: badge text heuristic (for Bengali "ভিডিও" etc.)
    const b = card.querySelector('.badge, .tag, .label');
    if(b){
      const txt = b.textContent.trim().toLowerCase();
      if(txt.includes('video') || txt.includes('ভিডিও')) return true;
    }
    return false;
  }

  function recalc(){
    recalcScheduled = false;
    imageCount = 0;
    videoCount = 0;

    const cards = Array.from(document.querySelectorAll('.card'));
    let imgIndex = 0, vidIndex = 0;
    for(const c of cards){
      // position context
      c.style.position = c.style.position || 'relative';
      const video = isVideoCard(c);
      const badge = c.querySelector('.count-badge') || (()=>{
        const el = document.createElement('div');
        el.className = 'count-badge';
        c.appendChild(el);
        return el;
      })();
      if(video){
        vidIndex += 1;
        badge.textContent = String(vidIndex);
        badge.setAttribute('aria-label', `ভিডিও নম্বর ${vidIndex}`);
        videoCount += 1;
      }else{
        imgIndex += 1;
        badge.textContent = String(imgIndex);
        badge.setAttribute('aria-label', `ছবি নম্বর ${imgIndex}`);
        imageCount += 1;
      }
    }
    const total = ensureTotalsNode();
    total.textContent = `ছবি: ${imageCount} · ভিডিও: ${videoCount}`;
    total.setAttribute('aria-label', `মোট ছবি ${imageCount} এবং ভিডিও ${videoCount}`);
  }

  function scheduleRecalc(){
    if(recalcScheduled) return;
    recalcScheduled = true;
    requestAnimationFrame(()=>{
      setTimeout(recalc, 0);
    });
  }

  // Observe grid(s) for dynamic changes
  function setupObservers(){
    const grids = getGridNodes();
    const cfg = {childList:true, subtree:true};
    for(const g of grids){
      new MutationObserver(scheduleRecalc).observe(g, cfg);
    }
    // Also observe body (fallback for appends elsewhere)
    new MutationObserver(scheduleRecalc).observe(document.body, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{
      ensureTotalsNode();
      setupObservers();
      scheduleRecalc();
    });
  }else{
    ensureTotalsNode();
    setupObservers();
    scheduleRecalc();
  }

  // Public helper in case app code wants to force-update
  window.__updateImageVideoTotals = scheduleRecalc;
})();


(function(){
  // wait for DOM
  const onReady = (fn)=>{
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  };

  onReady(()=>{
    // locate grid (common class names fallback)
    const grid = document.querySelector('.grid, .cards, .gallery, #grid, .masonry') || document.body;
    const toggleBar = document.querySelector('.toggle-bar') || document.querySelector('.toolbar') || document.querySelector('header');

    let imageCount = 0, videoCount = 0;
    let totalsEl = null;

    const ensureTotals = ()=>{
      if(!toggleBar) return null;
      if(!totalsEl){
        totalsEl = document.createElement('div');
        totalsEl.id = 'totals';
        totalsEl.className = 'totals-badge';
        toggleBar.appendChild(totalsEl);
      }
      return totalsEl;
    };

    const typeOfCard = (card)=>{
      // priority: data-type attr
      const t = (card.dataset && card.dataset.type) ? card.dataset.type.toLowerCase() : '';
      if(t === 'video' || t === 'vid') return 'video';
      if(t === 'image' || t === 'img' || t === 'photo' ) return 'image';
      // heuristic by content
      if(card.querySelector('video')) return 'video';
      if(card.querySelector('img')) return 'image';
      // fallback by extension if anchor exists
      const a = card.querySelector('a');
      if(a && a.href){
        const url = a.href.split('?')[0].toLowerCase();
        if(/\.(mp4|webm|mov|m4v|ogg)$/.test(url)) return 'video';
        if(/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/.test(url)) return 'image';
      }
      return 'image';
    };

    const addBadgeIfMissing = (card, n, label)=>{
      if(card.querySelector('.count-badge')) return;
      // ensure card is positioned container
      const style = getComputedStyle(card);
      if(style.position === 'static'){
        card.style.position = 'relative';
      }
      const b = document.createElement('div');
      b.className = 'count-badge';
      b.textContent = String(n);
      b.setAttribute('aria-label', (label === 'video' ? 'ভিডিও নম্বর ' : 'ছবি নম্বর ') + n);
      card.appendChild(b);
    };

    const recountAll = ()=>{
      imageCount = 0; videoCount = 0;
      const cards = grid.querySelectorAll('.card, .item, .tile, .gallery-item');
      cards.forEach(card=>{
        const kind = typeOfCard(card);
        if(kind === 'video'){
          videoCount += 1;
          addBadgeIfMissing(card, videoCount, 'video');
        }else{
          imageCount += 1;
          addBadgeIfMissing(card, imageCount, 'image');
        }
      });
      const t = ensureTotals();
      if(t){
        t.textContent = `ছবি: ${imageCount} · ভিডিও: ${videoCount}`;
        t.setAttribute('aria-label', `মোট ছবি ${imageCount} এবং ভিডিও ${videoCount}`);
      }
    };

    // Initial pass after small delay to allow other scripts to render cards
    setTimeout(recountAll, 50);

    // Observe future changes
    const obs = new MutationObserver(()=>{
      recountAll();
    });
    obs.observe(grid, {childList:true, subtree:true});

    // Also update after window load (media elements might be added late)
    window.addEventListener('load', recountAll);
  });
})();
/* === End added === */

/* === Updated by ChatGPT: only per-item badges, no totals === */
(function(){
  const onReady = (fn)=>{
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  };

  onReady(()=>{
    const grid = document.querySelector('.grid, .cards, .gallery, #grid, .masonry') || document.body;

    let imageCount = 0, videoCount = 0;

    const typeOfCard = (card)=>{
      const t = (card.dataset && card.dataset.type) ? card.dataset.type.toLowerCase() : '';
      if(t === 'video') return 'video';
      if(t === 'image') return 'image';
      if(card.querySelector('video')) return 'video';
      if(card.querySelector('img')) return 'image';
      const a = card.querySelector('a');
      if(a && a.href){
        const url = a.href.split('?')[0].toLowerCase();
        if(/\.(mp4|webm|mov|m4v|ogg)$/.test(url)) return 'video';
        if(/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/.test(url)) return 'image';
      }
      return 'image';
    };

    const addBadgeIfMissing = (card, n, label)=>{
      if(card.querySelector('.count-badge')) return;
      if(getComputedStyle(card).position === 'static'){
        card.style.position = 'relative';
      }
      const b = document.createElement('div');
      b.className = 'count-badge';
      b.textContent = String(n);
      b.setAttribute('aria-label', (label==='video' ? 'ভিডিও নম্বর ' : 'ছবি নম্বর ') + n);
      card.appendChild(b);
    };

    const recountAll = ()=>{
      imageCount = 0; videoCount = 0;
      const cards = grid.querySelectorAll('.card, .item, .tile, .gallery-item');
      cards.forEach(card=>{
        const kind = typeOfCard(card);
        if(kind === 'video'){
          videoCount++;
          addBadgeIfMissing(card, videoCount, 'video');
        } else {
          imageCount++;
          addBadgeIfMissing(card, imageCount, 'image');
        }
      });
    };

    setTimeout(recountAll, 50);
    const obs = new MutationObserver(recountAll);
    obs.observe(grid, {childList:true, subtree:true});
    window.addEventListener('load', recountAll);
  });
})();

/* === Updated by ChatGPT (2025-09-21): only per-item badges, no totals === */
(function(){
  const onReady = (fn)=>{
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  };

  onReady(()=>{
    const grid = document.querySelector('.grid, .cards, .gallery, #grid, .masonry') || document.body;

    let imageCount = 0, videoCount = 0;

    const typeOfCard = (card)=>{
      const t = (card.dataset && card.dataset.type) ? card.dataset.type.toLowerCase() : '';
      if(t === 'video' || t === 'vid') return 'video';
      if(t === 'image' || t === 'img' || t === 'photo') return 'image';
      if(card.querySelector('video')) return 'video';
      if(card.querySelector('img')) return 'image';
      const a = card.querySelector('a');
      if(a && a.href){
        const url = a.href.split('?')[0].toLowerCase();
        if(/\.(mp4|webm|mov|m4v|ogg)$/.test(url)) return 'video';
        if(/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/.test(url)) return 'image';
      }
      return 'image';
    };

    const addBadgeIfMissing = (card, n, label)=>{
      if(card.querySelector('.count-badge')) return;
      if(getComputedStyle(card).position === 'static'){
        card.style.position = 'relative';
      }
      const b = document.createElement('div');
      b.className = 'count-badge';
      b.textContent = String(n);
      b.setAttribute('aria-label', (label==='video' ? 'ভিডিও নম্বর ' : 'ছবি নম্বর ') + n);
      card.appendChild(b);
    };

    const recountAll = ()=>{
      imageCount = 0; videoCount = 0;
      const cards = grid.querySelectorAll('.card, .item, .tile, .gallery-item');
      cards.forEach(card=>{
        const kind = typeOfCard(card);
        if(kind === 'video'){
          videoCount++;
          addBadgeIfMissing(card, videoCount, 'video');
        } else {
          imageCount++;
          addBadgeIfMissing(card, imageCount, 'image');
        }
      });
    };

    setTimeout(recountAll, 50);
    const obs = new MutationObserver(recountAll);
    obs.observe(grid, {childList:true, subtree:true});
    window.addEventListener('load', recountAll);
  });
})();
/* === End Updated by ChatGPT === */

/* === Added by ChatGPT (2025-09-21): Single control bar with LEFT counter and RIGHT toggle === */
(function(){
  const onReady = (fn)=>{
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  };

  onReady(()=>{
    const header = document.querySelector('header') || document.body;
    const galleryRoot = document.querySelector('.grid, .cards, .gallery, #grid, .masonry') || document.body;

    // Ensure single control bar under header
    let bar = document.querySelector('.control-bar');
    if(!bar){
      bar = document.createElement('div');
      bar.className = 'control-bar';
      if(header.nextElementSibling){
        header.parentNode.insertBefore(bar, header.nextElementSibling);
      }else{
        header.parentNode.appendChild(bar);
      }
      // build left/right containers
      const left = document.createElement('div');
      left.className = 'control-left';
      const right = document.createElement('div');
      right.className = 'control-right';
      bar.appendChild(left);
      bar.appendChild(right);
    }
    const left = bar.querySelector('.control-left') || bar;
    const right = bar.querySelector('.control-right') || bar;

    // Find any existing toggle switch in DOM and move to right ONCE
    const toggleCandidate = document.querySelector('.toggle-bar, .toggle, .switch, .view-toggle, .filter-toggle');
    if(toggleCandidate && !right.contains(toggleCandidate)){
      right.appendChild(toggleCandidate);
    }

    // Create single totals badge on the LEFT
    let totals = left.querySelector('.totals-badge');
    // Remove duplicates anywhere else
    document.querySelectorAll('.totals-badge').forEach((el)=>{
      if(el !== totals) el.remove();
    });
    if(!totals){
      totals = document.createElement('div');
      totals.className = 'totals-badge';
      totals.setAttribute('role','status');
      left.appendChild(totals);
    }

    // Count updater (images + videos). We assume per-item badges code already exists elsewhere.
    const updateTotals = ()=>{
      const cards = galleryRoot.querySelectorAll('.card, .item, .tile, .gallery-item');
      let imageCount = 0, videoCount = 0;
      cards.forEach(c=>{
        const isVid = c.dataset?.type?.toLowerCase() === 'video' || c.querySelector('video');
        if(isVid) videoCount++; else imageCount++;
      });
      totals.textContent = `ছবি: ${imageCount} · ভিডিও: ${videoCount}`;
      totals.setAttribute('aria-label', `মোট ছবি ${imageCount} এবং ভিডিও ${videoCount}`);
    };

    // First update
    setTimeout(updateTotals, 30);
    // Observe changes to keep in sync
    const obs = new MutationObserver(updateTotals);
    obs.observe(galleryRoot, {childList:true, subtree:true});
    window.addEventListener('load', updateTotals);
  });
})();
/* === End Added === */


/* === Patched by ChatGPT (2025-09-21): SINGLE counter on left, toggle on right; dedupe; stable layout === */
(function(){
  const onReady = (fn)=>{
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  };

  onReady(()=>{
    try{
      if (window.__dp_controlBarSetup) return; // run once
      window.__dp_controlBarSetup = true;

      const header = document.querySelector('header');
      const galleryRoot = document.querySelector('.grid, .cards, .gallery, #grid, .masonry') || document.body;
      const existingBar = document.querySelector('.control-bar');

      let bar = existingBar;
      if(!bar){
        bar = document.createElement('div');
        bar.className = 'control-bar';
        if(header && header.parentNode){
          (header.nextElementSibling)
            ? header.parentNode.insertBefore(bar, header.nextElementSibling)
            : header.parentNode.appendChild(bar);
        }else{
          document.body.insertBefore(bar, document.body.firstChild);
        }
        const left = document.createElement('div'); left.className = 'control-left';
        const right = document.createElement('div'); right.className = 'control-right';
        bar.appendChild(left); bar.appendChild(right);
      }

      const left = bar.querySelector('.control-left') || bar;
      const right = bar.querySelector('.control-right') || bar;

      // Move toggle to right ONCE
      const toggleCandidate = document.querySelector('.toggle-bar');
      if(toggleCandidate && toggleCandidate.parentElement !== right){
        right.appendChild(toggleCandidate);
        toggleCandidate.dataset.pinned = 'true';
      }

      // SINGLE totals on left; kill duplicates
      let totals = left.querySelector('.totals-badge');
      document.querySelectorAll('.totals-badge').forEach(el=>{ if(el !== totals) el.remove(); });
      if(!totals){
        totals = document.createElement('div');
        totals.className = 'totals-badge';
        totals.setAttribute('role','status');
        left.appendChild(totals);
      }
      right.querySelectorAll('.totals-badge').forEach(el=> el.remove());

      const updateTotals = ()=>{
        let imageCount = 0, videoCount = 0;
        const cards = (document.querySelector('.grid, .cards, .gallery, #grid, .masonry') || document.body)
                      .querySelectorAll('.card, .item, .tile, .gallery-item');
        cards.forEach(c=>{
          const isVid = (c.dataset && c.dataset.type && c.dataset.type.toLowerCase()==='video') || c.querySelector('video');
          if(isVid) videoCount++; else imageCount++;
        });
        totals.textContent = `ছবি: ${imageCount} · ভিডিও: ${videoCount}`;
        totals.setAttribute('aria-label', `মোট ছবি ${imageCount} এবং ভিডিও ${videoCount}`);
      };

      setTimeout(updateTotals, 50);
      const obs = new MutationObserver(updateTotals);
      obs.observe(document.querySelector('.grid, .cards, .gallery, #grid, .masonry') || document.body, {childList:true, subtree:true});
      window.addEventListener('load', updateTotals);
    }catch(err){}
  });
})();
/* === End Patch === */
