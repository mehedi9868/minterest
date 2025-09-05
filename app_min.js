// app_min.js (modified with reset)

// assume grid, seen, showToast, closeModal already exist in your code

function clearBoardStorage(){
  localStorage.removeItem('drivepins_grid');
  localStorage.removeItem('drivepins_seen');
}

function resetBoard(){
  try{
    if(grid) grid.innerHTML = '';
    if(seen && seen.clear) seen.clear();
    clearBoardStorage();
    if(typeof closeModal === 'function') closeModal();
    if(typeof showToast === 'function') showToast('রিসেট হয়েছে ✅');
  }catch(e){
    console.error(e);
    if(typeof showToast === 'function') showToast('রিসেট করতে সমস্যা হয়েছে');
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  const btnReset = document.getElementById('btnReset');
  if(btnReset) btnReset.addEventListener('click', resetBoard);
});