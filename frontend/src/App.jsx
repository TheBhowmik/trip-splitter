import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = "https://trip-splitter.onrender.com";

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ totalTripSpent: 0, individualPaid: {}, transactions: [] });
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const INITIAL_MEMBERS = ["Niladri", "chayan", "pinak"];

  const [friends, setFriends] = useState(INITIAL_MEMBERS);
  const [newFriendName, setNewFriendName] = useState('');
  const [paidBy, setPaidBy] = useState(INITIAL_MEMBERS[0]);
  const [splitWith, setSplitWith] = useState(INITIAL_MEMBERS);
  const [loading, setLoading] = useState(false);

  // Refs so async handlers always read the LATEST values — kills stale closures
  const friendsRef  = useRef(INITIAL_MEMBERS);
  const splitWithRef = useRef(INITIAL_MEMBERS);

  // Keep refs in sync with state
  useEffect(() => { friendsRef.current  = friends;   }, [friends]);
  useEffect(() => { splitWithRef.current = splitWith; }, [splitWith]);

  useEffect(() => {
    fetchData(friendsRef.current);
  }, []);

  const fetchData = useCallback(async (currentFriendsList) => {
    try {
      const resExp = await fetch(`${API_BASE_URL}/api/expenses`);
      const dataExp = await resExp.json();
      setExpenses(dataExp);

      const memberParams = encodeURIComponent(JSON.stringify(currentFriendsList));
      const resSum = await fetch(`${API_BASE_URL}/api/settlement?members=${memberParams}`);
      const dataSum = await resSum.json();
      setSummary(dataSum);
    } catch (err) {
      console.error("Error fetching data from API:", err);
    }
  }, []);

  const handleAddFriend = (e) => {
    e.preventDefault();
    const name = newFriendName.trim();
    if (!name) return;
    if (friendsRef.current.includes(name)) { alert("Member already added!"); return; }
    const updated = [...friendsRef.current, name];
    setFriends(updated);
    setSplitWith(updated);
    setNewFriendName('');
    fetchData(updated);
  };

  const handleRemoveFriend = (nameToRemove) => {
    if (friendsRef.current.length <= 1) { alert("Need at least one member!"); return; }
    const updated = friendsRef.current.filter(f => f !== nameToRemove);
    setFriends(updated);
    setSplitWith(prev => prev.filter(f => f !== nameToRemove));
    if (paidBy === nameToRemove) setPaidBy(updated[0]);
    fetchData(updated);
  };

  const handleCheckboxToggle = (name) => {
    setSplitWith(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount) return;

    // ✅ Always read from the REF — never stale, even in async context
    const finalSplitGroup = splitWithRef.current.length > 0
      ? [...splitWithRef.current]
      : [...friendsRef.current];

    if (finalSplitGroup.length === 0) {
      alert("Please select at least one member to split with.");
      return;
    }

    // Debug log so you can verify in browser console what's being sent
    console.log("Submitting expense:", {
      description: description.trim(),
      amount: parseFloat(amount),
      paidBy,
      splitAmong: finalSplitGroup
    });

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          amount: parseFloat(amount),
          paidBy,
          splitAmong: finalSplitGroup
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        alert(`Error: ${errData.error}`);
        return;
      }

      const saved = await response.json();
      console.log("Saved to DB:", saved); // verify splitAmong stored correctly

      setDescription('');
      setAmount('');
      const latestFriends = [...friendsRef.current];
      setSplitWith(latestFriends);
      await fetchData(latestFriends);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Clear all trip records?")) return;
    await fetch(`${API_BASE_URL}/api/expenses/clear`, { method: 'DELETE' });
    await fetchData(friendsRef.current);
  };

  const theme = {
    bg: '#0c0f12', cardBg: '#161b22', inputBg: '#1f2631',
    textMain: '#ffffff', textMuted: '#8b949e',
    mint: '#00cc88', cyan: '#38bdf8', orange: '#ffaa00',
    danger: '#f85149', border: '#21262d'
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '500px', margin: '0 auto', padding: '20px 15px', backgroundColor: theme.bg, minHeight: '100vh', color: theme.textMain }}>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: theme.mint, boxShadow: `0 0 10px ${theme.mint}` }}></div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>Trip Dashboard</h2>
        </div>
        <button onClick={handleReset} style={{ backgroundColor: 'transparent', color: theme.danger, border: `1px solid ${theme.danger}`, padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Reset Data</button>
      </header>

      {/* Total Spent */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '22px' }}>
        <small style={{ textTransform: 'uppercase', fontSize: '11px', color: theme.textMuted, fontWeight: '700', letterSpacing: '0.5px' }}>TOTAL TRIP SPENT</small>
        <h3 style={{ margin: '8px 0 0 0', fontSize: '28px', color: theme.mint, fontWeight: '700' }}>₹{summary.totalTripSpent || 0}</h3>
      </div>

      {/* Active Members */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, padding: '16px', borderRadius: '12px', marginBottom: '22px' }}>
        <h4 style={{ margin: '0 0 14px 0', color: theme.textMain, fontSize: '14px', fontWeight: '600' }}>👥 Active Members</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          {friends.map(f => (
            <span key={f} style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.border}`, padding: '6px 12px', borderRadius: '8px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <strong>{f}</strong>
              <span onClick={() => handleRemoveFriend(f)} style={{ color: theme.danger, cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', lineHeight: '1' }}>×</span>
            </span>
          ))}
        </div>
        <form onSubmit={handleAddFriend} style={{ display: 'flex', gap: '8px' }}>
          <input type="text" placeholder="Add members..." value={newFriendName} onChange={e => setNewFriendName(e.target.value)} style={{ flex: 1, padding: '10px 12px', background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '6px', color: theme.textMain, fontSize: '14px' }} />
          <button type="submit" style={{ background: theme.mint, color: theme.bg, border: 'none', padding: '0 16px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>+ Add</button>
        </form>
      </div>

      {/* Log Expense Form */}
      <form onSubmit={handleSubmit} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, padding: '16px', borderRadius: '12px', marginBottom: '22px' }}>
        <h4 style={{ margin: '0 0 14px 0', color: theme.textMain, fontSize: '14px', fontWeight: '600' }}>📝 Log New Expense</h4>
        <input type="text" placeholder="Description (e.g., Fuel, Airbnb, Cafe)" value={description} onChange={e => setDescription(e.target.value)}
          style={{ width: '100%', padding: '11px 12px', marginBottom: '12px', boxSizing: 'border-box', background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '6px', color: theme.textMain, fontSize: '14px' }} required />
        <input type="number" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)}
          style={{ width: '100%', padding: '11px 12px', marginBottom: '14px', boxSizing: 'border-box', background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '6px', color: theme.textMain, fontSize: '14px' }} required />

        <label style={{ fontSize: '12px', color: theme.textMuted, display: 'block', marginBottom: '6px', fontWeight: '600' }}>PAID BY</label>
        <select value={paidBy} onChange={e => setPaidBy(e.target.value)}
          style={{ width: '100%', padding: '11px 12px', marginBottom: '16px', boxSizing: 'border-box', background: theme.inputBg, border: `1px solid ${theme.border}`, borderRadius: '6px', color: theme.textMain, fontSize: '14px', outline: 'none' }}>
          {friends.map(f => <option key={f} value={f} style={{ background: theme.cardBg }}>{f}</option>)}
        </select>

        <label style={{ fontSize: '12px', color: theme.textMuted, display: 'block', marginBottom: '8px', fontWeight: '600' }}>
          SPLIT EQUALLY AMONG: <span style={{ color: theme.mint }}>({splitWith.length} selected)</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: theme.inputBg, padding: '12px', borderRadius: '6px', marginBottom: '18px', border: `1px solid ${theme.border}` }}>
          {friends.map(f => (
            <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={splitWith.includes(f)} onChange={() => handleCheckboxToggle(f)}
                style={{ width: '16px', height: '16px', accentColor: theme.mint }} />
              <span style={{ color: splitWith.includes(f) ? theme.textMain : theme.textMuted }}>{f}</span>
              {splitWith.includes(f) && amount && splitWith.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: theme.mint }}>
                  ₹{(parseFloat(amount) / splitWith.length).toFixed(2)}
                </span>
              )}
            </label>
          ))}
        </div>

        <button type="submit" disabled={loading || splitWith.length === 0}
          style={{ width: '100%', padding: '13px', background: splitWith.length === 0 ? theme.border : theme.cyan, color: theme.bg, border: 'none', borderRadius: '6px', fontWeight: '700', cursor: splitWith.length === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
          {loading ? 'Logging...' : splitWith.length === 0 ? 'Select at least one member' : 'Submit Transaction'}
        </button>
      </form>

      {/* Who Owes Whom — per-person cards */}
      <div style={{ marginBottom: '22px' }}>
        <h4 style={{ margin: '0 0 14px 0', color: theme.textMain, fontSize: '14px', fontWeight: '600' }}>💸 Who Owes Whom</h4>

        {!summary.transactions || summary.transactions.length === 0 ? (
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, padding: '18px 16px', borderRadius: '12px', textAlign: 'center' }}>
            <p style={{ color: theme.mint, fontSize: '13px', margin: 0, fontWeight: '600' }}>🎉 All members are completely even!</p>
          </div>
        ) : (
          (() => {
            const grouped = {};
            summary.transactions.forEach(t => {
              if (!grouped[t.from]) grouped[t.from] = [];
              grouped[t.from].push(t);
            });
            return Object.entries(grouped).map(([debtor, txns]) => {
              const totalOwed = txns.reduce((s, t) => s + t.amount, 0);
              return (
                <div key={debtor} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, background: theme.inputBg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `linear-gradient(135deg, ${theme.danger}33, ${theme.danger}11)`, border: `1px solid ${theme.danger}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: theme.danger }}>
                        {debtor.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: theme.textMain }}>{debtor}</div>
                        <div style={{ fontSize: '11px', color: theme.textMuted }}>needs to pay</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: theme.danger }}>₹{totalOwed.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', color: theme.textMuted }}>total</div>
                    </div>
                  </div>
                  <div style={{ padding: '8px 16px' }}>
                    {txns.map((t, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: idx !== txns.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: theme.orange, fontSize: '16px' }}>→</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: `linear-gradient(135deg, ${theme.mint}33, ${theme.mint}11)`, border: `1px solid ${theme.mint}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: theme.mint }}>
                              {t.to.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '14px', color: theme.textMain, fontWeight: '500' }}>{t.to}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: theme.orange, background: `${theme.orange}18`, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${theme.orange}33` }}>
                          ₹{Number(t.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>

      {/* Contribution History */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, padding: '16px', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 14px 0', color: theme.textMain, fontSize: '14px', fontWeight: '600' }}>📋 Contribution History</h4>
        <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
          {expenses.length === 0 ? (
            <p style={{ color: theme.textMuted, fontSize: '13px', margin: 0, textAlign: 'center', padding: '12px 0' }}>No history items logged yet.</p>
          ) : (
            expenses.map(exp => (
              <div key={exp._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${theme.border}`, fontSize: '14px' }}>
                <div>
                  <strong style={{ color: theme.textMain, fontWeight: '600' }}>{exp.description}</strong>
                  <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '3px' }}>
                    Paid by <span style={{ color: theme.cyan }}>{exp.paidBy}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: theme.mint, marginTop: '2px' }}>
                    Split: {exp.splitAmong && exp.splitAmong.length > 0
                      ? exp.splitAmong.join(', ')
                      : <span style={{ color: theme.danger }}>⚠ not recorded</span>}
                  </div>
                </div>
                <span style={{ fontWeight: '700', color: theme.mint }}>₹{Number(exp.amount).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
