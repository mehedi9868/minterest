'use strict';

// ===== Config (set these) =====
const API_KEY = "AIzaSyDUE_P391KSJ4gC6-FG8ch-XeinTh4gUT8";         // <-- আপনার Drive API key
const REQUIRED_PASSWORD = "i love you";                             // <-- পাসওয়ার্ড
// ডিফল্ট ড্রাইভ ফোল্ডার (যদি ইউজার লিংক না দেয় বা ভুল দেয়, এটা ব্যবহার হবে)
const DEFAULT_DRIVE_URL = "https://drive.google.com/drive/folders/12qLQqg_gjw7gGcmbJ4dIGeNe6iRigahy"; // <-- এখানে আপনার ডিফল্ট ফোল্ডার লিংক বসান
// =================================

const seen = new Set();
let grid, toast, overlay, linkInput, pwdInput;

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
  localStorage.setItem('drivepins_grid', html);
  localStorage.setItem('drivepins_seen', JSON.stringify(ids));
}
function loadBoard(){
  if(!grid) return;
  const html = localStorage.getItem('drivepins_grid');
  const ids = localStorage.getItem('drivepins_seen');
  if(html){ grid.innerHTML = html; }
  if(ids){ JSON.parse(ids).forEach(id=>seen.add(id)); }
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

async function listFolderFiles(folderId){
  const base = 'https://www.googleapis.com/drive/v3/files';
  const q = encodeURIComponent(`'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`);
  let pageToken = '';
  let added = 0;
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
      renderFileCard(f);
      seen.add(f.id);
      added++;
    }
    pageToken = data.nextPageToken || '';
  } while(pageToken);
  if(added>0) saveBoard();
  return added;
}

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
  img.alt = file.name || (isVideo?'video':'image');
  img.loading = 'lazy';
  link.appendChild(img);
  card.appendChild(link);
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<span title="${file.name||''}">${truncate(file.name||'', 28)}</span><span>${file.mimeType.split('/')[0]}</span>`;
  card.appendChild(meta);
  grid.appendChild(card);
}
function truncate(s, n){ return s.length>n? s.slice(0, n-1)+'…' : s; }

function openModal(){
  overlay.style.display = 'flex';
  linkInput.focus();
}
function closeModal(){
  overlay.style.display = 'none';
  linkInput.value = '';
  pwdInput.value = '';
}

async function handleAdd(){
  try{
    const rawLink = (linkInput.value || '').trim();
    const pwd = (pwdInput.value || '').trim().toLowerCase();
    if(pwd !== REQUIRED_PASSWORD){
      showToast('ভুল পাসওয়ার্ড ⚠️');
      return;
    }

    // Try user link → else fallback to default
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
  const btnCancel = document.getElementById('btnCancel');
  const btnAdd = document.getElementById('btnAdd');

  if(fab) fab.addEventListener('click', openModal);
  if(btnCancel) btnCancel.addEventListener('click', closeModal);
  if(btnAdd) btnAdd.addEventListener('click', handleAdd);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeModal(); });
  window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });

  loadBoard();
});
