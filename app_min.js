'use strict';

// ===== Config (set these) =====
const API_KEY = "AIzaSyDUE_P391KSJ4gC6-FG8ch-XeinTh4gUT8";         // <-- আপনার Drive API key
const REQUIRED_PASSWORD = "iloveyou";                             // <-- পাসওয়ার্ড
const ANOTHER_PASSWORD = "50607080";
// ডিফল্ট ড্রাইভ ফোল্ডার (যদি ইউজার লিংক না দেয় বা ভুল দেয়, এটা ব্যবহার হবে)
const DEFAULT_DRIVE_URL = "https://drive.google.com/drive/folders/12qLQqg_gjw7gGcmbJ4dIGeNe6iRigahy"; // <-- এখানে আপনার ডিফল্ট ফোল্ডার লিংক বসান
// =================================

const seen = new Set();
let grid, toast, overlay, linkInput, pwdInput;
let firstImageSquared = false; // প্রথম ইমেজ square ট্র্যাক

function showToast(msg, ms = 2600){
  if(!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(()=> toast.style.display='none', ms);
}

function saveBoard(){
  if(!grid) return;
  const html = grid.innerHTML;
  const ids = Array.from(seen);
  try{
    localStorage.setItem('drivepins_grid', html);
    localStorage.setItem('drivepins_seen', JSON.stringify(ids));
  }catch(e){}
}

function resetBoard(){
  if(!grid) return;
  grid.innerHTML = '';
  try{ seen.clear(); }catch(e){}
  try{
    localStorage.removeItem('drivepins_grid');
    localStorage.removeItem('drivepins_seen');
  }catch(e){}
  showToast('প্রথম অবস্থায় ফিরিয়ে আনা হয়েছে');
}

function loadBoard(){
  if(!grid) return;
  try{
    const html = localStorage.getItem('drivepins_grid');
    const ids = localStorage.getItem('drivepins_seen');
    if(html){ grid.innerHTML = html; }
    if(ids){ JSON.parse(ids).forEach(id=>seen.add(id)); }
  }catch(e){}
}

// Drive folder id extractor
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

// API fetch + ordering: keep API order, but ensure first is an image if available
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

  // Ensure first item is an image if any image exists; preserve order for the rest
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

// Card renderer: no meta, first image square, Bengali badge for videos (bottom-right, slightly larger)
function renderFileCard(file){
  if(!grid) return;
  const isVideo = (file.mimeType || '').startsWith('video/');
  const card = document.createElement('article');
  card.className = 'card';

  const link = document.createElement('a');
  link.href = file.webViewLink || '#';
  link.target = '_blank'; link.rel='noopener';

  const img = document.createElement('img');
  const thumb = file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s2048') : `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`;
  img.src = thumb;
  img.alt = isVideo ? 'ভিডিও' : 'image';
  img.loading = 'lazy';

  // First actual image becomes square
  if(!isVideo && !firstImageSquared){
    img.classList.add('sq1');
    firstImageSquared = true;
  }

  link.appendChild(img);
  card.appendChild(link);

  // Bengali video badge at bottom-right
  if(isVideo){
    const label = document.createElement('div');
    label.textContent = 'ভিডিও';
    label.style.position = 'absolute';
    label.style.right = '10px';
    label.style.bottom = '10px';
    label.style.background = 'rgba(0,0,0,0.55)';
    label.style.color = 'white';
    label.style.fontSize = '14px';
    label.style.padding = '3px 10px';
    label.style.borderRadius = '999px';
    label.style.backdropFilter = 'blur(4px)';
    label.style.fontWeight = '700';
    label.style.letterSpacing = '0.2px';
    label.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
    label.style.pointerEvents = 'none';
    card.appendChild(label);
  }

  grid.appendChild(card);
}

function truncate(s, n){ return s.length>n? s.slice(0, n-1)+'…' : s; }

function openModal(){
  overlay.style.display = 'flex';
  if(linkInput) linkInput.focus();
}
function closeModal(){
  overlay.style.display = 'none';
  if(linkInput) linkInput.value = '';
  if(pwdInput) pwdInput.value = '';
}

async function handleAdd(){
  try{
    const rawLink = (linkInput?.value || '').trim();
    const pwd = (pwdInput?.value); //|| '').trim().toLowerCase();
    if(pwd !== REQUIRED_PASSWORD || ANOTHER_PASSWORD){
      showToast('ভুল পাসওয়ার্ড ⚠️');
      return;
    }
    let folderId = getFolderIdFromUrl(rawLink);
    if(!folderId){
      folderId = getFolderIdFromUrl(DEFAULT_DRIVE_URL);
      if(!folderId){
        showToast('ডিফল্ট ফোল্ডার সেট করা নেই বা ভুল। app_min.js এ DEFAULT_DRIVE_URL ঠিক করুন।');
        return;
      }
    }
    closeModal();
    showToast('লোড হচ্ছে…');
    const added = await listFolderFiles(folderId);
    showToast(added===0 ? 'নতুন কোনো ফাইল পাওয়া যায়নি (ডুপ্লিকেট এড়িয়ে গেছে)' : `${added} টি নতুন আইটেম যোগ হয়েছে`);
  }catch(err){
    console.error(err);
    showToast('লোড করতে সমস্যা হয়েছে (folder public? API Key ঠিক আছে?)');
  }
}

// Bind after DOM ready
window.addEventListener('DOMContentLoaded', () => {
  grid = document.getElementById('grid');
  toast = document.getElementById('toast');
  overlay = document.getElementById('overlay');
  linkInput = document.getElementById('link');
  pwdInput = document.getElementById('password');

  const fab = document.getElementById('fab');
  const btnReset = document.getElementById('btnReset');
  const btnCancel = document.getElementById('btnCancel');
  const btnAdd = document.getElementById('btnAdd');

  if(fab) fab.addEventListener('click', openModal);
  if(btnReset) btnReset.addEventListener('click', resetBoard);
  if(btnCancel) btnCancel.addEventListener('click', closeModal);
  if(btnAdd) btnAdd.addEventListener('click', handleAdd);
  if(overlay) overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeModal(); });
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });

  loadBoard();
});

/* >>> Masonry Equal-Height Cleanup (additive) <<< */
(function(){
  function pinterestMasonryFix(){
    var gridEl = document.querySelector('#grid, .grid, .masonry, .pin-grid');
    if(!gridEl) return;
    var nodes = gridEl.querySelectorAll('.card,.pin,.item,.grid-item');
    nodes.forEach(function(el){
      ['height','minHeight','maxHeight','aspectRatio'].forEach(function(p){ 
        try{ el.style.removeProperty(p.replace(/[A-Z]/g, function(m){return '-' + m.toLowerCase();})); }catch(e){}
      });
      try{ el.style.removeProperty('--h'); }catch(e){}
      var media = el.querySelector('img,video');
      if(media){
        ['height','minHeight','maxHeight','aspectRatio'].forEach(function(p){ 
          try{ media.style.removeProperty(p.replace(/[A-Z]/g, function(m){return '-' + m.toLowerCase();})); }catch(e){}
        });
        media.removeAttribute('height');
      }
    });
  }
  document.addEventListener('DOMContentLoaded', pinterestMasonryFix);
  window.addEventListener('load', pinterestMasonryFix);
  var gridWatch = function(){
    var gridEl = document.querySelector('#grid, .grid, .masonry, .pin-grid');
    if(!gridEl) return;
    var mo = new MutationObserver(function(){ pinterestMasonryFix(); });
    mo.observe(gridEl, {childList:true});
  };
  document.addEventListener('DOMContentLoaded', gridWatch);
})();
