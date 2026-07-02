// Resolves a split-type + inputs into concrete expense_splits rows.
// All split types normalize to a `shareAmount` (money), so balance math is
// always a plain sum regardless of split type. Amounts are in "cents" style
// integers internally to avoid floating-point drift, then converted back.

function toCents(n) { return Math.round(n * 100); }
function toMoney(c) { return Math.round(c) / 100; }

// Distribute `totalCents` across `n` shares as evenly as possible, giving
// any leftover cents (from integer division) to the first N shares in order —
// deterministic and always sums exactly to totalCents.
function distributeCents(totalCents, weights) {
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) throw new Error('Split weights must sum to more than zero');

  const raw = weights.map(w => (totalCents * w) / totalWeight);
  const floored = raw.map(Math.floor);
  let remainder = totalCents - floored.reduce((s, v) => s + v, 0);

  // Give leftover cents to the entries with the largest fractional remainder first.
  const order = raw
    .map((v, i) => ({ i, frac: v - floored[i] }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floored];
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].i] += 1;
  }
  return result;
}

/**
 * @param {number} amount - total expense amount (money, e.g. 30.13)
 * @param {'equal'|'exact'|'percentage'|'shares'} splitType
 * @param {Array<{ tripMemberId: string, value?: number }>} members - selected members;
 *   `value` is required for exact/percentage/shares, ignored for equal.
 * @returns {Array<{ tripMemberId: string, shareAmount: number, shareValue: number|null }>}
 */
export function calculateSplits(amount, splitType, members) {
  if (!members.length) throw new Error('Select at least one member to split with');
  const totalCents = toCents(amount);

  if (splitType === 'equal') {
    const cents = distributeCents(totalCents, members.map(() => 1));
    return members.map((m, i) => ({ tripMemberId: m.tripMemberId, shareAmount: toMoney(cents[i]), shareValue: null }));
  }

  if (splitType === 'exact') {
    const sum = members.reduce((s, m) => s + (Number(m.value) || 0), 0);
    if (Math.abs(sum - amount) > 0.01) {
      throw new Error(`Exact amounts (${sum.toFixed(2)}) must add up to the total (${amount.toFixed(2)})`);
    }
    return members.map(m => ({ tripMemberId: m.tripMemberId, shareAmount: Number(m.value) || 0, shareValue: null }));
  }

  if (splitType === 'percentage') {
    const sum = members.reduce((s, m) => s + (Number(m.value) || 0), 0);
    if (Math.abs(sum - 100) > 0.01) {
      throw new Error(`Percentages (${sum.toFixed(1)}%) must add up to 100%`);
    }
    const cents = distributeCents(totalCents, members.map(m => Number(m.value) || 0));
    return members.map((m, i) => ({ tripMemberId: m.tripMemberId, shareAmount: toMoney(cents[i]), shareValue: Number(m.value) }));
  }

  if (splitType === 'shares') {
    const totalShares = members.reduce((s, m) => s + (Number(m.value) || 0), 0);
    if (totalShares <= 0) throw new Error('Shares must add up to more than zero');
    const cents = distributeCents(totalCents, members.map(m => Number(m.value) || 0));
    return members.map((m, i) => ({ tripMemberId: m.tripMemberId, shareAmount: toMoney(cents[i]), shareValue: Number(m.value) }));
  }

  throw new Error(`Unknown split type: ${splitType}`);
}
