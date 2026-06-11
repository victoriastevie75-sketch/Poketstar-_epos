// Simple client-side POS demo with Kenyan Shillings formatting and localStorage persistence.

const currency = new Intl.NumberFormat('en-KE',{ style:'currency', currency:'KES' });
const state = {
  products: JSON.parse(localStorage.getItem('pos_products') || '[]'),
  sales: JSON.parse(localStorage.getItem('pos_sales') || '[]'),
  cart: []
};

function saveState(){ localStorage.setItem('pos_products', JSON.stringify(state.products)); localStorage.setItem('pos_sales', JSON.stringify(state.sales)); }

function format(n){ return currency.format(n); }

// DOM refs
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
  return state.products.find(p => p.barcode === q || p.name.toLowerCase() === q.toLowerCase());
}

function addToCart(query){
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

addToCartBtn.onclick = ()=> addToCart(barcodeInput.value.trim());

function renderCart(){
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

  subtotalEl.textContent = format(subtotal);
  taxEl.textContent = format(tax);
  discountEl.textContent = format(discount);
  grandEl.textContent = format(grand);

  // attach remove handlers
  document.querySelectorAll('.removeBtn').forEach(btn=>btn.onclick = e=>{
    const idx = +e.target.dataset.i;
    state.cart.splice(idx,1);
    renderCart();
  });
}

completeSaleBtn.onclick = ()=>{
  if(state.cart.length === 0){ alert('Cart empty'); return; }
  const subtotal = state.cart.reduce((s,it)=>s + it.price*it.qty,0);
  const tax = +(subtotal*0.16).toFixed(2);
  const grand = +(subtotal + tax).toFixed(2);
  const tendered = parseFloat(paymentAmount.value);
  if(isNaN(tendered) || tendered < grand){ if(!confirm('Tendered less than amount — continue as credit?')) return; }
  const sale = { id: Date.now(), items: state.cart, subtotal, tax, grand, tendered, date: new Date().toISOString() };
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
};

function showReceipt(sale){
  const receipt = document.getElementById('receipt');
  receipt.classList.remove('hidden');
  receipt.innerHTML = `<pre>Receipt\n\nID: ${sale.id}\nDate: ${sale.date}\n\n${sale.items.map(i=>`${i.name} x${i.qty} ${format(i.price*i.qty)}`).join('\n')}\n\nGrand: ${format(sale.grand)}</pre>`;
}

printReceiptBtn.onclick = ()=> window.print();

openAdmin.onclick = ()=> adminModal.classList.remove('hidden');
closeAdmin.onclick = ()=> adminModal.classList.add('hidden');

productForm.onsubmit = e=>{
  e.preventDefault();
  const name = document.getElementById('p_name').value.trim();
  const barcode = document.getElementById('p_barcode').value.trim() || String(Date.now());
  const price = parseFloat(document.getElementById('p_price').value);
  const qty = parseInt(document.getElementById('p_qty').value,10);
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

document.addEventListener('DOMContentLoaded', ()=>{ renderProducts(); renderCart(); setInterval(()=>document.getElementById('clock').textContent = new Date().toLocaleString(),1000); });
