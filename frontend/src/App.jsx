import React, { useState, useEffect } from 'react';
import { 
  Activity, ArrowUpRight, Shield, AlertCircle, 
  RotateCw, Sparkles, CheckCircle2, XCircle, FileText, Bot, Play 
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [health, setHealth] = useState({ status: 'ok', gemini_configured: false });
  const [transactions, setTransactions] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractionNotes, setExtractionNotes] = useState([]);

  const [auditGoal, setAuditGoal] = useState('Audit my transactions for subscription traps and silent price hikes.');
  const [auditSession, setAuditSession] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    checkHealth();
    loadSampleData(true);
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealth({ status: 'offline', gemini_configured: false });
    }
  };

  const loadSampleData = async (isInitial = false) => {
    setLoadingSample(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/sample`);
      if (!res.ok) throw new Error('Failed to load sample data');
      const data = await res.json();
      setTransactions(data.transactions);
      setExtractionNotes([]);
      setAuditSession(null);
    } catch (err) {
      if (!isInitial) {
        setErrorMsg('Could not load sample data. Is the backend running?');
      }
    } finally {
      setLoadingSample(false);
    }
  };

  const handleExtract = async () => {
    if (!rawText.trim() && !selectedFile) {
      setErrorMsg('Paste transaction text or choose a file.');
      return;
    }
    setExtracting(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      if (rawText.trim()) formData.append('text', rawText);
      if (selectedFile) formData.append('file', selectedFile);

      const res = await fetch(`${API_BASE}/api/extract`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Extraction failed');

      setTransactions(data.transactions);
      setExtractionNotes(data.notes || []);
      setAuditSession(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const runAudit = async () => {
    if (transactions.length === 0) {
      setErrorMsg('Add transactions before starting an audit.');
      return;
    }
    setAuditing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/audits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, goal: auditGoal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Audit failed');
      setAuditSession(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setAuditing(false);
    }
  };

  const handleApproval = async (decision) => {
    if (!auditSession) return;
    setApproving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/audits/${auditSession.session_id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Approval failed');
      setAuditSession(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setApproving(false);
    }
  };

  const totalTransactions = transactions.length;
  const uniqueMerchants = new Set(transactions.map(t => t.merchant)).size;
  const totalOutflow = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const subscriptionCharges = transactions.filter(t => t.category === 'Subscriptions' && t.amount > 0).reduce((acc, t) => acc + t.amount, 0);

  const monthlyMap = {};
  transactions.forEach(t => {
    if (t.date && t.amount > 0) {
      const [year, month] = t.date.split('-');
      const d = new Date(year, month - 1);
      const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      monthlyMap[key] = (monthlyMap[key] || 0) + t.amount;
    }
  });
  const chartData = Object.keys(monthlyMap).map(k => ({ month: k, amount: parseFloat(monthlyMap[k].toFixed(2)) }));

  const categoryMap = {};
  transactions.filter(t => t.amount > 0).forEach(t => {
    categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
  });
  const categoriesList = Object.keys(categoryMap)
    .map(c => ({ name: c, amount: categoryMap[c] }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
  const maxCategoryAmount = Math.max(...categoriesList.map(c => c.amount), 1);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-icon">
            <Activity size={20} />
          </div>
          <div className="brand-info">
            <div className="brand-title">Finwise</div>
            <div className="brand-subtitle">INTELLIGENCE AGENT</div>
          </div>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>
        <div className="sidebar-nav">
          <a href="#" className="nav-item active">
            <span>Overview</span>
            <span className="badge">{totalTransactions}</span>
          </a>
          <a href="#transactions" className="nav-item">
            <span>Transactions</span>
          </a>
          <a href="#audit" className="nav-item">
            <span>Agent audit</span>
          </a>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} color="var(--primary)" />
              <strong>Demo-safe mode</strong>
            </div>
            <span>Sample data is fictional. Approval actions are simulated and never sent.</span>
            <span style={{ fontSize: '10px', marginTop: '4px' }}>WORKSHOP BUILD · v1.0.0</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-titles">
            <span className="eyebrow">Personal finance / Overview</span>
            <h1>Finance overview</h1>
            <p>Understand your spending. Let your agent investigate the details.</p>
          </div>
          <div className="top-bar-actions">
            <div className="status-pill">
              <span className={`status-dot ${health.gemini_configured ? 'connected' : 'demo'}`}></span>
              <span>{health.gemini_configured ? 'Gemini connected' : 'Demo mode available'}</span>
            </div>
            <button className="icon-btn" onClick={() => loadSampleData(false)} title="Reload sample data">
              <RotateCw size={16} />
            </button>
            <div className="avatar">N</div>
          </div>
        </header>

        <div className="content-container">
          {errorMsg && (
            <div className="error-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)}><XCircle size={18} /></button>
            </div>
          )}

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Total transactions</span>
                <div className="metric-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                  <Activity size={18} />
                </div>
              </div>
              <div className="metric-value">{totalTransactions}</div>
              <div className="metric-sub">{uniqueMerchants} unique merchants</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Total outflow</span>
                <div className="metric-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                  <ArrowUpRight size={18} />
                </div>
              </div>
              <div className="metric-value">${totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="metric-sub">Across loaded transactions</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Subscription charges</span>
                <div className="metric-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                  <FileText size={18} />
                </div>
              </div>
              <div className="metric-value">${subscriptionCharges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="metric-sub">All visible periods combined</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Potential price hikes</span>
                <div className="metric-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                  <Sparkles size={18} />
                </div>
              </div>
              <div className="metric-value">
                {auditSession && auditSession.findings ? auditSession.findings.length : '—'}
              </div>
              <div className="metric-sub">Run an agent audit</div>
            </div>
          </div>

          <div className="two-col-grid">
            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <h3>Spending activity</h3>
                  <p>Monthly transaction outflow</p>
                </div>
                <span className="pill">Sample data</span>
              </div>
              {chartData.length > 0 ? (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6d78e8" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6d78e8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                      <Tooltip formatter={(val) => [`$${val.toFixed(2)}`, 'Outflow']} />
                      <Area type="monotone" dataKey="amount" stroke="#6d78e8" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <p>Add dated transactions to see spending activity.</p>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <h3>Spending by category</h3>
                  <p>Positive charges only</p>
                </div>
              </div>
              {categoriesList.length > 0 ? (
                <div className="category-list">
                  {categoriesList.map((cat, idx) => {
                    const pct = Math.max((cat.amount / maxCategoryAmount) * 100, 3);
                    return (
                      <div key={idx} className="category-item">
                        <div className="category-row-info">
                          <div className="category-left">
                            <div className="category-icon-box">{cat.name.charAt(0)}</div>
                            <span>{cat.name}</span>
                          </div>
                          <span>${cat.amount.toFixed(2)}</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <p>Category totals appear after transactions are loaded.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="eyebrow">GenAI extraction</span>
                <h3>Bring in financial data</h3>
              </div>
              <span className="pill">01 Extract & validate</span>
            </div>

            <div className="import-grid">
              <div 
                className="dropzone"
                onClick={() => document.getElementById('file-input').click()}
              >
                <FileText size={24} color="var(--primary)" />
                {selectedFile ? (
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <div className="dropzone-sub">({Math.round(selectedFile.size / 1024)} KB)</div>
                  </div>
                ) : (
                  <div>
                    <strong>Choose a receipt or statement</strong>
                    <div className="dropzone-sub">PNG, JPG, PDF, CSV or TXT · max 12 MB</div>
                  </div>
                )}
                <input 
                  id="file-input" 
                  type="file" 
                  style={{ display: 'none' }} 
                  accept="image/*,.pdf,.csv,.txt"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
                {selectedFile && (
                  <button 
                    className="text-link" 
                    style={{ color: 'var(--danger)', marginTop: '6px' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  >
                    Remove file
                  </button>
                )}
              </div>

              <div className="divider-or">OR</div>

              <div className="textarea-wrap">
                <textarea 
                  rows={4}
                  placeholder="2026-09-14 TST* SPOTIFY USA 11.99\n2026-09-18 UPI/FOOD DELIVERY/8231 18.75"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <div className="helper-row">
                  <span>Raw text is sent to Gemini when configured.</span>
                  <button 
                    className="text-link"
                    onClick={() => setRawText("2026-09-14 TST* SPOTIFY USA 11.99\n2026-09-18 UPI/FOOD DELIVERY/8231 18.75\n2026-09-20 POS HPCL FUEL HYD 25.00")}
                  >
                    Use example
                  </button>
                </div>
              </div>
            </div>

            {extractionNotes.length > 0 && (
              <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                <strong>Extraction notes:</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                  {extractionNotes.map((note, idx) => <li key={idx}>{note}</li>)}
                </ul>
              </div>
            )}

            <div className="import-footer">
              <span className="import-note">
                Structured output + Pydantic validation. Unclear fields should stay null, not guessed.
              </span>
              <div className="btn-group">
                <button className="btn btn-secondary" onClick={() => loadSampleData(false)} disabled={loadingSample || extracting}>
                  {loadingSample ? 'Loading...' : 'Load sample data'}
                </button>
                <button className="btn btn-primary" onClick={handleExtract} disabled={extracting || (!rawText.trim() && !selectedFile)}>
                  <Sparkles size={16} />
                  {extracting ? 'Extracting...' : 'Extract transactions'}
                </button>
              </div>
            </div>
          </div>

          <div className="card" id="transactions">
            <div className="card-header">
              <div className="card-title-group">
                <h3>Transactions</h3>
                <p>Validated, typed records feeding your dashboard</p>
              </div>
              <span className="pill">{totalTransactions} records</span>
            </div>

            {transactions.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Merchant</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Raw source</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .slice()
                      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                      .map((t, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="merchant-cell">
                              <div className="merchant-avatar">{t.merchant.charAt(0)}</div>
                              <span>{t.merchant}</span>
                            </div>
                          </td>
                          <td>{t.date || 'Date unclear'}</td>
                          <td>
                            <span className="category-chip">{t.category}</span>
                          </td>
                          <td><span className="raw-source">{t.raw_line || '—'}</span></td>
                          <td className={`amount-cell ${t.amount < 0 ? 'negative' : 'positive'}`}>
                            {t.amount < 0 ? `-$${Math.abs(t.amount).toFixed(2)}` : `$${t.amount.toFixed(2)}`}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No transactions yet. Load sample data or extract a statement above.</p>
              </div>
            )}
          </div>

          <div className="card" id="audit">
            <div className="card-header">
              <div className="card-title-group">
                <span className="eyebrow">Autonomous agent</span>
                <h3>Run a finance audit</h3>
                <p>The agent investigates with Python tools, then asks before any consequential action.</p>
              </div>
            </div>

            <div className="agent-grid">
              <div className="agent-goal-card">
                <div className="textarea-wrap">
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Your audit goal</label>
                  <textarea 
                    rows={3}
                    value={auditGoal}
                    onChange={(e) => setAuditGoal(e.target.value)}
                  />
                </div>
                <div className="safety-note">
                  Read-only analysis runs automatically. Cancellation / dispute actions are drafts and require your approval. Nothing is sent.
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={runAudit}
                  disabled={auditing || transactions.length === 0}
                >
                  <Play size={16} />
                  {auditing ? 'Running agent audit...' : 'Run agent audit'}
                </button>
              </div>

              <div className="agent-trace-card">
                <div className="card-header" style={{ padding: 0 }}>
                  <h4>Agent trace</h4>
                  <span className="pill" style={{ textTransform: 'uppercase' }}>
                    {auditSession ? auditSession.status : 'idle'}
                  </span>
                </div>

                {auditSession ? (
                  <div className="trace-timeline">
                    {auditSession.audit_log.map((log, idx) => {
                      let dotColor = 'blue';
                      if (log.type === 'tool') dotColor = 'green';
                      if (log.type === 'approval_required' || log.type === 'approved_simulation' || log.type === 'rejected') dotColor = 'amber';
                      if (log.type === 'error') dotColor = 'red';

                      return (
                        <div key={idx} className="timeline-item">
                          <div className={`timeline-dot ${dotColor}`}></div>
                          <div className="timeline-content">
                            <div className="timeline-header-row">
                              <span className="timeline-msg">{log.message}</span>
                              <span className="timeline-time">{log.type} · {log.time}</span>
                            </div>
                            {log.details && log.details.tool && (
                              <div className="timeline-code">
                                {log.details.tool}({JSON.stringify(log.details.arguments || {})})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '20px' }}>
                    <Bot size={32} />
                    <p>Your audit trace will appear here</p>
                    <span style={{ fontSize: '11px' }}>Inspect → Calculate → Ask first</span>
                  </div>
                )}
              </div>
            </div>

            {auditSession && auditSession.findings && auditSession.findings.map((f, idx) => (
              <div key={idx} className="finding-card">
                <div className="finding-header">
                  <strong>{f.merchant}</strong>
                  <span className="finding-badge">Price increase detected (+{f.change_pct}%)</span>
                </div>
                <div className="finding-details">
                  <div className="finding-amounts">
                    ${f.old_amount.toFixed(2)} → <strong>${f.new_amount.toFixed(2)}</strong> / month
                  </div>
                </div>
                <div className="finding-footer">
                  <span>Detected {f.date || 'recently'}</span>
                  <strong>+${f.monthly_increase.toFixed(2)} / month</strong>
                </div>
              </div>
            ))}

            {auditSession && auditSession.pending_action && (
              <div className="approval-card">
                <div className="approval-header">
                  <div>
                    <span className="eyebrow">Human-in-the-loop</span>
                    <h4 style={{ fontSize: '18px', marginTop: '2px' }}>
                      {auditSession.status === 'awaiting_approval' ? 'Action needs your approval' : 'Action approved (simulation)'}
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {auditSession.pending_action.merchant} · Subscription change review
                    </p>
                  </div>
                  <span className="badge" style={{ background: auditSession.status === 'awaiting_approval' ? '#fef3c7' : '#ecfdf5', color: auditSession.status === 'awaiting_approval' ? '#b45309' : '#047857' }}>
                    {auditSession.status === 'awaiting_approval' ? 'Awaiting decision' : 'Decision recorded'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '13px' }}>
                  <div style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Price increase</span>
                    <div style={{ fontweight: 700, marginTop: '2px' }}>+${auditSession.pending_action.monthly_increase} / mo</div>
                  </div>
                  <div style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Annualized cost now</span>
                    <div style={{ fontWeight: 700, marginTop: '2px' }}>${auditSession.pending_action.annual_cost} / yr</div>
                  </div>
                  <div style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Percentage change</span>
                    <div style={{ fontWeight: 700, marginTop: '2px' }}>+{auditSession.pending_action.change_pct}%</div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px', fontWeight: 600 }}>
                    <span>CANCELLATION / DISPUTE DRAFT</span>
                    <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>NOT SENT</span>
                  </div>
                  <div className="draft-box">
                    {auditSession.pending_action.draft}
                  </div>
                </div>

                {auditSession.status === 'awaiting_approval' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                    <button className="btn btn-secondary" onClick={() => handleApproval('reject')} disabled={approving}>
                      <XCircle size={16} /> Reject
                    </button>
                    <button className="btn btn-primary" onClick={() => handleApproval('approve')} disabled={approving}>
                      <CheckCircle2 size={16} /> Approve simulation
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <footer style={{ padding: '24px 32px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--card-bg)', marginTop: 'auto' }}>
          <span>FINWISE · FINANCE INTELLIGENCE AGENT</span>
          <span>Built for learning · Not financial advice</span>
        </footer>
      </main>
    </div>
  );
}
