let products = [];
let category = 'All';

function cart() { return JSON.parse(localStorage.getItem('supershop_cart') || '[]'); }
function saveCart(c) { localStorage.setItem('supershop_cart', JSON.stringify(c)); updateCartCount(); }
function updateCartCount() { document.querySelectorAll('#cartCount').forEach(e => e.textContent = cart().reduce((s,x)=>s+x.quantity,0)); }

async function loadProducts() {
  const res = await fetch('/api/products');
  products = await res.json();
  renderProducts();
}
function setCategory(c){ category=c; renderProducts(); }
function renderProducts(){
  const q=(document.getElementById('search')?.value||'').toLowerCase();
  const list=products.filter(p=>(category==='All'||p.category===category)&&(!q||p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q)));
  const grid=document.getElementById('productsGrid');
  if(!grid)return;
  document.getElementById('resultCount').textContent=`${list.length} products`;
  grid.innerHTML=list.map(p=>`
    <article class="card">
      <div class="pic"><img src="${p.image_url}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none';this.parentElement.textContent='🛒'"></div>
      <div class="card-body">
        <div class="cat">${escapeHtml(p.category)}</div>
        <h3>${escapeHtml(p.name)}</h3>
        <div class="price">৳${Number(p.price).toFixed(0)}</div>
        <button onclick="addToCart(${p.id})">Add to Cart</button>
      </div>
    </article>`).join('');
}
function addToCart(id){
  const c=cart(); const found=c.find(x=>x.productId===id);
  if(found) found.quantity++; else c.push({productId:id,quantity:1});
  saveCart(c); alert('Added to cart!');
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
document.addEventListener('DOMContentLoaded',()=>{updateCartCount();loadProducts();document.getElementById('search')?.addEventListener('input',renderProducts);});
