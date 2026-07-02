// Balance & debt-simplification math. Pure functions, no Supabase dependency,
// so they're easy to test against fixture data independent of the UI.

const EPSILON = 0.01;

/**
 * @param {Array<{id:string}>} members
 * @param {Array<{id:string, paidBy:string}>} expenses
 * @param {Array<{expenseId:string, tripMemberId:string, shareAmount:number}>} splits
 * @param {Array<{fromMember:string, toMember:string, amount:number}>} settlements
 * @returns {Record<string, number>} tripMemberId -> net balance (positive = owed money, negative = owes money)
 */
export function computeBalances(members, expenses, splits, settlements) {
  const balances = {};
  members.forEach(m => { balances[m.id] = 0; });

  const expenseAmount = {};
  expenses.forEach(e => { expenseAmount[e.id] = e; });

  // Paid: full expense amount credited to whoever paid.
  expenses.forEach(e => {
    if (balances[e.paidBy] === undefined) return;
    balances[e.paidBy] += e.amount;
  });

  // Owed: each member's share is debited from them.
  splits.forEach(s => {
    if (balances[s.tripMemberId] === undefined) return;
    balances[s.tripMemberId] -= s.shareAmount;
  });

  // Settlements: payer's debt decreases (credited), receiver's credit decreases (debited).
  settlements.forEach(st => {
    if (balances[st.fromMember] !== undefined) balances[st.fromMember] += st.amount;
    if (balances[st.toMember]   !== undefined) balances[st.toMember]   -= st.amount;
  });

  Object.keys(balances).forEach(id => {
    balances[id] = Math.round(balances[id] * 100) / 100;
  });

  return balances;
}

/**
 * Greedy min-cash-flow debt simplification: repeatedly matches the largest
 * creditor with the largest debtor until all balances are ~0. Same heuristic
 * Splitwise itself uses — optimal-or-near-optimal for typical group sizes,
 * not proven-minimal (true minimum-transaction simplification is NP-hard).
 *
 * @param {Record<string, number>} balances - tripMemberId -> net balance
 * @returns {Array<{ from: string, to: string, amount: number }>}
 */
export function simplifyDebts(balances) {
  const entries = Object.entries(balances)
    .map(([id, amount]) => ({ id, amount }))
    .filter(e => Math.abs(e.amount) > EPSILON);

  const transactions = [];
  let guard = entries.length * entries.length + 10; // safety valve against infinite loops

  while (guard-- > 0) {
    let creditor = null, debtor = null;
    for (const e of entries) {
      if (e.amount > EPSILON && (!creditor || e.amount > creditor.amount)) creditor = e;
      if (e.amount < -EPSILON && (!debtor || e.amount < debtor.amount)) debtor = e;
    }
    if (!creditor || !debtor) break;

    const amount = Math.min(creditor.amount, -debtor.amount);
    const rounded = Math.round(amount * 100) / 100;
    transactions.push({ from: debtor.id, to: creditor.id, amount: rounded });

    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;
    debtor.amount   = Math.round((debtor.amount + amount) * 100) / 100;
  }

  return transactions;
}
