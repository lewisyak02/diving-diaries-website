/**
 * The cart lives in the browser and holds nothing but slugs and quantities.
 * Prices, stock and minimum orders are all re-checked on the server when
 * checkout starts, so a tampered cart cannot buy a $5 sticker for a cent.
 */
export interface CartLine {
  /** "<slug>" or "<slug>:ds" for the drop shadow finish. */
  id: string;
  qty: number;
  /** Display only, so the drawer does not need the content collection. */
  name: string;
  price: number;
  thumb?: string;
  /** Pack only: the chosen variant keys, and their labels for the drawer. */
  pack?: string[];
  packLabels?: string[];
}

const KEY = 'dd-cart-v1';
const EVENT = 'dd-cart-change';

export function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode: the cart just will not survive a reload */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: lines }));
}

export function cartCount(lines = readCart()) {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export function cartTotal(lines = readCart()) {
  return lines.reduce((n, l) => n + l.qty * l.price, 0);
}

/**
 * Packs never merge, because two packs can hold different stickers. Everything
 * else merges by id, capped at whatever is left in the drawer.
 */
export function addToCart(line: CartLine, stock?: number) {
  const lines = readCart();
  if (line.pack) {
    lines.push({ ...line });
  } else {
    const found = lines.find((l) => l.id === line.id && !l.pack);
    if (found) {
      found.qty += line.qty;
      if (stock !== undefined) found.qty = Math.min(found.qty, stock);
    } else {
      lines.push({ ...line, qty: stock !== undefined ? Math.min(line.qty, stock) : line.qty });
    }
  }
  writeCart(lines);
}

export function setQty(index: number, qty: number, stock?: number, minOrder = 1) {
  const lines = readCart();
  const line = lines[index];
  if (!line) return;
  let next = Math.max(minOrder, Math.floor(qty));
  if (stock !== undefined) next = Math.min(next, stock);
  line.qty = next;
  writeCart(lines);
}

export function removeLine(index: number) {
  const lines = readCart();
  lines.splice(index, 1);
  writeCart(lines);
}

export function clearCart() {
  writeCart([]);
}

export function onCartChange(fn: (lines: CartLine[]) => void) {
  window.addEventListener(EVENT, (e) => fn((e as CustomEvent).detail ?? readCart()));
  // Another tab may have changed it.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) fn(readCart());
  });
}

export const money = (n: number) =>
  '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
