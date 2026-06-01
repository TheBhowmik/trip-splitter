import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB Atlas successfully!"))
  .catch((err) => console.error("Database connection error:", err));

const expenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount:      { type: Number, required: true },
  paidBy:      { type: String, required: true },
  splitAmong:  [String],
  date:        { type: Date, default: Date.now }
});

const Expense = mongoose.model('Expense', expenseSchema);

// ─── Helper: normalize a name so "Niladri ", "niladri", "NILADRI" all match ───
const norm = (name) => name.trim().toLowerCase();

// GET all expenses
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new expense  — normalize names before saving
app.post('/api/expenses', async (req, res) => {
  try {
    let { description, amount, paidBy, splitAmong } = req.body;

    if (!description || !amount || !paidBy || !splitAmong || splitAmong.length === 0) {
      return res.status(400).json({ error: "Missing fields or no members selected for split" });
    }

    // FIX: trim & normalize case on save so DB is always clean
    paidBy      = paidBy.trim();
    splitAmong  = splitAmong.map(m => m.trim()).filter(Boolean);

    const newExpense = new Expense({
      description: description.trim(),
      amount: parseFloat(amount),
      paidBy,
      splitAmong
    });

    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE all expenses
app.delete('/api/expenses/clear', async (req, res) => {
  try {
    await Expense.deleteMany({});
    res.json({ message: "Trip records cleared successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET settlement  — core fix is here
app.get('/api/settlement', async (req, res) => {
  try {
    const expenses = await Expense.find();

    // Parse members sent from frontend and normalize them
    const queryMembers = req.query.members
      ? JSON.parse(req.query.members).map(m => m.trim()).filter(Boolean)
      : [];

    // FIX: build a canonical name map  norm(name) → display name
    // This ensures "Niladri", "niladri ", "NILADRI" all resolve to the same key
    const canonicalMap = {}; // norm → original display name

    queryMembers.forEach(m => {
      canonicalMap[norm(m)] = m;  // frontend names are source of truth for display
    });

    expenses.forEach(exp => {
      const pn = norm(exp.paidBy);
      if (!canonicalMap[pn]) canonicalMap[pn] = exp.paidBy.trim();

      (exp.splitAmong || []).forEach(m => {
        const mn = norm(m);
        if (!canonicalMap[mn]) canonicalMap[mn] = m.trim();
      });
    });

    const currentMembers = Object.keys(canonicalMap); // normalized keys

    if (expenses.length === 0 || currentMembers.length === 0) {
      return res.json({ totalTripSpent: 0, individualPaid: {}, transactions: [] });
    }

    let totalTripSpent = 0;
    let balances      = {};  // keyed by norm(name)
    let individualPaid = {}; // keyed by norm(name)

    currentMembers.forEach(k => {
      balances[k]       = 0;
      individualPaid[k] = 0;
    });

    expenses.forEach(exp => {
      totalTripSpent += exp.amount;

      const payerKey = norm(exp.paidBy);

      if (balances[payerKey] !== undefined) {
        balances[payerKey]       += exp.amount;  // credit payer
        individualPaid[payerKey] += exp.amount;
      }

      const splitList = (exp.splitAmong && exp.splitAmong.length > 0)
        ? exp.splitAmong.map(norm)
        : currentMembers;

      // FIX: filter to only members that actually exist in balances
      const validSplit = splitList.filter(k => balances[k] !== undefined);

      if (validSplit.length === 0) return; // safety guard

      const costPerPerson = exp.amount / validSplit.length;

      validSplit.forEach(memberKey => {
        balances[memberKey] -= costPerPerson; // debit each member their share
      });
    });

    // Build creditors / debtors using normalized keys, display with canonical names
    let creditors = [];
    let debtors   = [];

    for (let key in balances) {
      const displayName = canonicalMap[key];
      if (balances[key] > 0.01) {
        creditors.push({ name: displayName, amount: balances[key] });
      } else if (balances[key] < -0.01) {
        debtors.push({ name: displayName, amount: Math.abs(balances[key]) });
      }
    }

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // Greedy transaction minimization
    let transactions = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor   = debtors[i];
      const creditor = creditors[j];
      const settled  = Math.min(debtor.amount, creditor.amount);

      transactions.push({
        from:   debtor.name,
        to:     creditor.name,
        amount: Math.round(settled * 100) / 100
      });

      debtor.amount   -= settled;
      creditor.amount -= settled;

      if (debtor.amount   < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    // Build individualPaid with display names for frontend
    const individualPaidDisplay = {};
    for (let key in individualPaid) {
      individualPaidDisplay[canonicalMap[key]] = Math.round(individualPaid[key] * 100) / 100;
    }

    res.json({
      totalTripSpent: Math.round(totalTripSpent * 100) / 100,
      individualPaid: individualPaidDisplay,
      transactions
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
