const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qwqszedggvefzkpqsihu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_uF-mM8mh9wUHwaogjSjwKg__4N4j_we';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234@@';

function genToken() { return crypto.randomBytes(32).toString('hex'); }

const adminTokens = new Set();

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = genToken();
    adminTokens.add(token);
    return res.json({ success: true, token });
  }
  res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
});

// Admin auth check
function isAdmin(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return adminTokens.has(auth.slice(7));
  }
  return false;
}

// Save order
app.post('/api/orders', async (req, res) => {
  try {
    const { name, phone, email, wilaya, address, watch_color, watch_index } = req.body;
    if (!name || !phone || !email || !wilaya || !address) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    const { error } = await supabase.from('orders').insert({
      name, phone, email, wilaya, address, watch_color,
      watch_index: watch_index !== undefined ? watch_index : null,
      current_page: 'order',
      status: 'pending',
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update visitor page tracking
app.post('/api/track-page', async (req, res) => {
  try {
    const { session_id, current_page } = req.body;
    if (!session_id) return res.json({ ok: false });
    const { data: existing } = await supabase.from('orders').select('id, redirect_to').eq('session_id', session_id).maybeSingle();
    if (existing) {
      await supabase.from('orders').update({ current_page }).eq('session_id', session_id);
      if (existing.redirect_to) {
        await supabase.from('orders').update({ redirect_to: null }).eq('session_id', session_id);
        return res.json({ ok: true, redirectTo: existing.redirect_to });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false });
  }
});

// Get orders (admin)
app.get('/api/orders', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ orders: [] });
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data || [] });
  } catch (err) {
    res.status(500).json({ orders: [], message: err.message });
  }
});

// Update order status
app.patch('/api/orders/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ success: false });
    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.redirect_to !== undefined) updates.redirect_to = req.body.redirect_to;
    const { error } = await supabase.from('orders').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(401).json({ success: false });
    const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
