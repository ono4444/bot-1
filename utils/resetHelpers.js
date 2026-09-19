const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function resetIfNeeded(doc, field, resetAtField, now = new Date(), periodMs = 86400000) {
  if (!doc) return false;
  const last = doc[resetAtField] ? new Date(doc[resetAtField]).getTime() : 0;
  if (now.getTime() - last >= periodMs) {
    doc[field] = 0;
    doc[resetAtField] = startOfDay(now);
    return true;
  }
  return false;
}

module.exports = { resetIfNeeded };
