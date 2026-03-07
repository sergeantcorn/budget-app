// ============================================================
// STATE — shared across all modules
// ============================================================
const API = 'https://budget-app-worker.ben-j-mcdonagh.workers.dev';

let appData      = null;
let historyData  = null;
let currentPage  = 'budget';
let billsFilter  = 'all';
let budgetBills  = [];
let pendingConfirm = null;
let authToken    = localStorage.getItem('budget_token') || null;

const bankLogos = {
  'Starling': `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1543 1544"><style>.s0{fill:#6935d3}.s1{fill:#ffffff}</style><g><path fill-rule="evenodd" class="s0" d="m771.4 1543c-426.6 0-771.4-344.8-771.4-771.5 0-426.6 344.8-771.4 771.4-771.4 426.6 0 771.4 344.8 771.4 771.4 0 426.7-344.8 771.5-771.4 771.5z"/><path fill-rule="evenodd" class="s1" d="m464.5 771.6v-42.9c0-266.3 216.6-482.9 482.9-482.9h42.8v175.1h-42.8c-169.7 0-307.8 138.1-307.8 307.8v42.9z"/><path fill-rule="evenodd" class="s1" d="m1078.3 771.5v42.9c0 266.2-216.6 482.9-482.9 482.9h-42.8v-175.1h42.8c169.7 0 307.8-138.1 307.8-307.8v-42.9z"/></g></svg>`,
  'Monzo': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M63.997 45.16c0 .786-.31 1.54-.866 2.095l-13.27 13.27c-.34.337-.848.438-1.3.255s-.73-.614-.73-1.092V29.953l15.977-15.888H64z" fill="#e34b5f"/><path d="M53.407 3.475c-.463-.463-1.213-.463-1.676 0L32 23.205h-.274v22.27l.274.585 31.996-31.997z" fill="#e7ce9c"/><path d="M0 45.16c-.001.786.31 1.54.866 2.096l13.27 13.27c.34.337.848.438 1.3.255s-.73-.614-.73-1.092V29.953L.184 14.065H0z" fill="#1e7889"/><path d="M12.266 3.475c-.463-.463-1.213-.463-1.676 0L0 14.065l31.998 32V23.207z" fill="#97baa6"/></svg>`
};
