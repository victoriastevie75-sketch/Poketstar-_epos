// Simple client-side POS demo with Kenyan Shillings formatting and localStorage persistence.

const currency = new Intl.NumberFormat('en-KE',{ style:'currency', currency:'KES' });
const state = {
  products: JSON.parse(localStorage.getItem('pos_products') || '[]'),
  sales: JSON.parse(localStorage.getItem('pos_sales') || '[]'),
  cart: []
};

function saveState(){ localStorage.setItem('pos_products', JSON.stringify(state.products)); localStorage.setItem('pos_sales', JSON.stringify(state.sales)); }

function format(n){ return currency.format(n); }

// DOM refs (guarded)
const productList = document.getElementById('productList');
const barcodeInput = document.getElementById('barcodeInput');
const addToCartBtn = document.getElementById('addToCartBtn');
const cartTableBody = document.querySelector('#cartTable tbody');
const subtotalEl = document.getElementById('subtotal');
const taxEl = document.getElementById('tax');
const discountEl = document.getElementById('discount');
const grandEl = document.getElementById('grandTotal');
const paymentAmount = document.getElementById('paymentAmount');
const completeSaleBtn = document.getElementById('completeSaleBtn');
const printReceiptBtn = document.getElementById('printReceiptBtn');

// Admin
const openAdmin = document.getElementById('openAdmin');
const adminModal = document.getElementById('adminModal');
const closeAdmin = document.getElementById('closeAdmin');
const productForm = document.getElementById('productForm');

function renderProducts(){
  if (!productList) return;
  productList.innerHTML = '';
  state.products.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'productCard';
    el.innerHTML = `<strong>${p.name}</strong><div>${format(p.price)} • ${p.qty} pcs</div>`;
    el.onclick = ()=>{ addToCart(p.barcode || p.name); };
    productList.appendChild(el);
  });
}

function findProductByBarcode(q){
  if (!q) return undefined;
  return state.products.find(p => p.barcode === q || (p.name && p.name.toLowerCase() === q.toLowerCase()));
}

function addToCart(query){
  if (!query) { alert('Please scan or enter a barcode/keyword.'); return; }
  const p = findProductByBarcode(query);
  if(!p){ alert('Product not found. Use admin to add.'); return; }
  const cartItem = state.cart.find(c=>c.barcode===p.barcode);
  if(cartItem){
    if(p.qty <= cartItem.qty) { alert('Not enough stock'); return; }
    cartItem.qty++;
  } else {
    state.cart.push({ barcode:p.barcode, name:p.name, price:p.price, qty:1 });
  }
  renderCart();
}

if (addToCartBtn) addToCartBtn.addEventListener('click', ()=> addToCart((barcodeInput && barcodeInput.value) ? barcodeInput.value.trim() : ''));

function renderCart(){
  if (!cartTableBody) return;
  cartTableBody.innerHTML = '';
  let subtotal = 0;
  state.cart.forEach((it, i)=>{
    const row = document.createElement('tr');
    const total = it.price * it.qty;
    subtotal += total;
    row.innerHTML = `<td>${it.name}</td><td>${it.qty}</td><td>${format(it.price)}</td><td>${format(total)}</td>
      <td><button data-i="${i}" class="removeBtn">Remove</button></td>`;
    cartTableBody.appendChild(row);
  });
  const tax = +(subtotal * 0.16).toFixed(2); // example 16% VAT
  const discount = 0;
  const grand = +(subtotal + tax - discount).toFixed(2);

  if (subtotalEl) subtotalEl.textContent = format(subtotal);
  if (taxEl) taxEl.textContent = format(tax);
  if (discountEl) discountEl.textContent = format(discount);
  if (grandEl) grandEl.textContent = format(grand);

  // attach remove handlers
  document.querySelectorAll('.removeBtn').forEach(btn=>btn.onclick = e=>{
    const idx = +e.target.dataset.i;
    state.cart.splice(idx,1);
    renderCart();
  });
}

if (completeSaleBtn) completeSaleBtn.addEventListener('click', ()=>{
  if(state.cart.length === 0){ alert('Cart empty'); return; }
  const subtotal = state.cart.reduce((s,it)=>s + it.price*it.qty,0);
  const tax = +(subtotal*0.16).toFixed(2);
  const grand = +(subtotal + tax).toFixed(2);
  const tendered = paymentAmount ? parseFloat(paymentAmount.value) : NaN;
  if(isNaN(tendered) || tendered < grand){ if(!confirm('Tendered less than amount — continue as credit?')) return; }
  const sale = { id: Date.now(), items: state.cart.slice(), subtotal, tax, grand, tendered, date: new Date().toISOString() };
  // decrement stock
  sale.items.forEach(it=>{
    const p = state.products.find(px=>px.barcode === it.barcode);
    if(p) p.qty = Math.max(0, p.qty - it.qty);
  });
  state.sales.push(sale);
  state.cart = [];
  saveState();
  renderProducts();
  renderCart();
  showReceipt(sale);
  alert('Sale recorded.');
});

function ensureReceiptContainer(){
  let receipt = document.getElementById('receipt');
  if (!receipt) {
    receipt = document.createElement('div');
    receipt.id = 'receipt';
    receipt.className = 'hidden';
    document.body.appendChild(receipt);
  }
  return receipt;
}

function showReceipt(sale){
  const receipt = ensureReceiptContainer();
  // Build plain text receipt inside <pre> for monospace printing
  receipt.classList.remove('hidden');
  const itemsText = (sale.items || []).map(i=>`${i.name} x${i.qty} ${format(i.price*i.qty)}`).join('\n');
  receipt.innerHTML = `<pre style="font-family: monospace; white-space: pre-wrap;">
Receipt\n\nID: ${sale.id}\nDate: ${sale.date}\n\n${itemsText}\n\nGrand: ${format(sale.grand)}\n</pre>`;
}

// Print only the receipt content in a focused popup (avoids printing the whole app UI)
function printReceiptPopup(){
  const receipt = document.getElementById('receipt');
  if (!receipt || !receipt.innerHTML) {
    // fallback: try fetch latest spooled receipt from server endpoint
    if (window.fetch) {
      fetch('/api/printer/latest?format=text').then(r=>r.text()).then(text=>{
        const w = window.open('', '_blank', 'toolbar=0,scrollbars=1,location=0,statusbar=0,menubar=0,width=600,height=800');
        if (!w) { alert('Popup blocked. Please allow popups to print receipts.'); return; }
        w.document.open();
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>body{font-family:monospace;white-space:pre-wrap;margin:8px} @media print{ body{margin:0} }</style></head><body><pre>${escapeHtml(text)}</pre><script>window.onload=function(){window.print();setTimeout(()=>window.close(),500);}</script></body></html>`);
        w.document.close();
      }).catch(()=>{ alert('No receipt available to print.'); });
    } else {
      alert('No receipt available to print.');
    }
    return;
  }

  const w = window.open('', '_blank', 'toolbar=0,scrollbars=1,location=0,statusbar=0,menubar=0,width=600,height=800');
  if (!w) { alert('Popup blocked. Please allow popups to print receipts.'); return; }
  const content = receipt.innerHTML;
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>body{font-family:monospace;white-space:pre-wrap;margin:8px} @media print{ body{margin:0} }</style></head><body>${content}<script>window.onload=function(){window.print();setTimeout(()=>window.close(),500);}</script></body></html>`);
  w.document.close();
}

// Simple HTML escape for text inserted into the print popup
function escapeHtml(s){
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]);
}

if (printReceiptBtn) printReceiptBtn.addEventListener('click', ()=> printReceiptPopup());

if (openAdmin) openAdmin.addEventListener('click', ()=> { if (adminModal) adminModal.classList.remove('hidden'); });
if (closeAdmin) closeAdmin.addEventListener('click', ()=> { if (adminModal) adminModal.classList.add('hidden'); });

if (productForm) productForm.onsubmit = e=>{
  e.preventDefault();
  const name = document.getElementById('p_name') ? document.getElementById('p_name').value.trim() : '';
  const barcode = document.getElementById('p_barcode') ? document.getElementById('p_barcode').value.trim() : (String(Date.now()));
  const price = document.getElementById('p_price') ? parseFloat(document.getElementById('p_price').value) : 0;
  const qty = document.getElementById('p_qty') ? parseInt(document.getElementById('p_qty').value,10) : 0;
  const existing = state.products.find(p=>p.barcode === barcode);
  if(existing){
    existing.name = name; existing.price = price; existing.qty = qty;
  } else {
    state.products.push({ name, barcode, price, qty });
  }
  saveState();
  renderProducts();
  productForm.reset();
};

// Init
document.addEventListener('DOMContentLoaded', ()=>{ renderProducts(); renderCart();
  const clockEl = document.getElementById('clock');
  if (clockEl) setInterval(()=>clockEl.textContent = new Date().toLocaleString(),1000);
});
