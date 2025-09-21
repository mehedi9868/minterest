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

// Observer for scroll animation
const observer = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
},{threshold:0.1});


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
  }catch(e){}
}
function resetBoard(){
  if(!grid) return;
  grid.innerHTML = '';
  try{ seen.clear(); localStorage.removeItem('drivepins_grid'); localStorage.removeItem('drivepins_seen'); }catch(e){}
  showToast('Reset Successful');
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
  const thumb = file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, '=s2048') : `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`;
  img.src = thumb;
  img.alt = isVideo ? 'ভিডিও' : 'image';
  img.loading = 'lazy';

  if(!isVideo && !firstImageSquared){
    img.classList.add('sq1');
    firstImageSquared = true;
  }

  link.appendChild(img);
  card.appendChild(link);

  if(isVideo){
    const label = document.createElement('div');
    label.className = 'badge';
    label.textContent = 'ভিডিও';
    card.appendChild(label);
  }

  grid.appendChild(card);
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
    mediaToggle.classList.remove('active'); // start on Images
  }

  loadBoard();
  showOnly(currentView);
});
