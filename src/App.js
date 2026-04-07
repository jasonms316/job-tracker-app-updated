import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const STATUS_CONFIG = {
  applied: { label: "Applied", color: "#4A9EFF", bg: "rgba(74,158,255,0.12)", icon: "📤" },
  response: { label: "Response", color: "#A78BFA", bg: "rgba(167,139,250,0.12)", icon: "📬" },
  interview_1: { label: "Round 1 · Recruiter", color: "#34D399", bg: "rgba(52,211,153,0.12)", icon: "🗣️" },
  interview_2: { label: "Round 2 · Hiring Mgr", color: "#2DD4BF", bg: "rgba(45,212,191,0.12)", icon: "👔" },
  interview_3: { label: "Round 3 · Panel/Final", color: "#818CF8", bg: "rgba(129,140,248,0.12)", icon: "🏛️" },
  offer: { label: "Offer", color: "#FBBF24", bg: "rgba(251,191,36,0.12)", icon: "🏆" },
  rejected: { label: "Rejected", color: "#F87171", bg: "rgba(248,113,113,0.12)", icon: "✗" },
  rejected_after_interview: { label: "Rejected After Interview", color: "#E11D48", bg: "rgba(225,29,72,0.12)", icon: "💔" },
  followup: { label: "Follow Up", color: "#FB923C", bg: "rgba(251,146,60,0.12)", icon: "🔔" },
};

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchVal, setSearchVal] = useState("");
  const [sortBy, setSortBy] = useState("appliedDate_desc");

  const defaultForm = {
    id: "",
    company: "",
    role: "",
    location: "",
    salary: "",
    applied_date: "",
    status: "applied",
    contact_name: "",
    contact_email: "",
    resume_version: "",
    job_url: "",
    next_action: "",
    next_action_date: "",
    notes: ""
  };

  const [form, setForm] = useState(defaultForm);

  // Load jobs from Supabase
  useEffect(() => {
    loadJobs();
    const subscription = supabase
      .channel('jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        loadJobs();
      })
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('jobs').select('*').order('applied_date', { ascending: false });
    if (error) {
      console.error('Error loading jobs:', error);
    } else {
      setJobs(data || []);
    }
    setLoading(false);
  };

  const setF = (k) => (v) => {
    setForm(prev => ({ ...prev, [k]: v }));
  };

  const saveForm = async () => {
    if (!form.company || !form.role) return;
    
    try {
      if (editJob) {
        await supabase.from('jobs').update(form).eq('id', form.id);
      } else {
        await supabase.from('jobs').insert([{ ...form, id: 'g' + Date.now() }]);
      }
      setForm(defaultForm);
      setEditJob(null);
      setModalOpen(false);
      await loadJobs();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const deleteJob = async (id) => {
    try {
      await supabase.from('jobs').delete().eq('id', id);
      setDeleteConfirm(null);
      await loadJobs();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const openEdit = (job) => {
    setEditJob(job);
    setForm(job);
    setModalOpen(true);
  };

  let filtered = jobs.filter(j =>
    !searchVal ||
    j.company.toLowerCase().includes(searchVal.toLowerCase()) ||
    j.role.toLowerCase().includes(searchVal.toLowerCase()) ||
    (j.contact_name && j.contact_name.toLowerCase().includes(searchVal.toLowerCase()))
  );

  if (sortBy === "appliedDate_desc") {
    filtered = filtered.sort((a, b) => new Date(b.applied_date) - new Date(a.applied_date));
  } else if (sortBy === "status") {
    const order = { interview_3: 0, interview_2: 1, interview_1: 2, response: 3, applied: 4, offer: 5, followup: 6, rejected: 7, rejected_after_interview: 8 };
    filtered = filtered.sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
  }

  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <div>
            <h1>Job Tracker</h1>
            <p>Last updated: {new Date().toLocaleDateString()} · {jobs.length} applications</p>
          </div>
          <button className="btn-primary" onClick={() => { setForm(defaultForm); setEditJob(null); setModalOpen(true); }}>
            + NEW APPLICATION
          </button>
        </div>

        <div className="controls">
          <input
            type="text"
            placeholder="Search by company, role, contact..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            className="search-input"
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="sort-select">
            <option value="appliedDate_desc">Recently Applied</option>
            <option value="status">By Status</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading jobs...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div>No applications found</div>
            <p>Try adjusting your search or apply to new roles</p>
          </div>
        ) : (
          <div className="jobs-grid">
            {filtered.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onEdit={openEdit}
                onDelete={id => setDeleteConfirm(id)}
              />
            ))}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)}>
          <div className="modal-confirm">
            <div className="confirm-icon">⚠️</div>
            <div className="confirm-title">Delete this application?</div>
            <div className="confirm-text">This can't be undone.</div>
            <div className="modal-buttons">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteJob(deleteConfirm)} className="btn-danger">Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)}>
          <div className="modal-form">
            <h2>{editJob ? "EDIT APPLICATION" : "ADD APPLICATION"}</h2>
            <div className="form-grid">
              <Input label="Company *" value={form.company} onChange={setF("company")} placeholder="Acme Corp" style={{ gridColumn: "1/-1" }} />
              <Input label="Role *" value={form.role} onChange={setF("role")} placeholder="Senior Engineer" style={{ gridColumn: "1/-1" }} />
              <Input label="Location" value={form.location} onChange={setF("location")} placeholder="Boston, MA" />
              <Input label="Salary" value={form.salary} onChange={setF("salary")} placeholder="$120k" />
              <Input label="Date Applied" value={form.applied_date} onChange={setF("applied_date")} type="date" />
              <Select label="Status" value={form.status} onChange={setF("status")} options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))} />
              <Input label="Resume Version" value={form.resume_version} onChange={setF("resume_version")} placeholder="v3" />
              <Input label="Job URL" value={form.job_url} onChange={setF("job_url")} placeholder="https://..." />
              <Input label="Contact Name" value={form.contact_name} onChange={setF("contact_name")} placeholder="Recruiter name" />
              <Input label="Contact Email" value={form.contact_email} onChange={setF("contact_email")} placeholder="recruiter@co.com" />
            </div>
            <Input label="Next Action" value={form.next_action} onChange={setF("next_action")} placeholder="Prepare for interview" />
            <Input label="Next Action Date" value={form.next_action_date} onChange={setF("next_action_date")} type="date" />
            <Textarea label="Notes" value={form.notes} onChange={setF("notes")} placeholder="Interview notes, impressions…" rows={3} />
            <div className="modal-buttons">
              <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveForm} disabled={!form.company || !form.role} className="btn-primary">{editJob ? "SAVE CHANGES" : "ADD APPLICATION"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function JobCard({ job, onEdit, onDelete }) {
  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.applied;
  return (
    <div className="job-card" onClick={() => onEdit(job)}>
      <div className="card-header">
        <div>
          <div className="company-name">{job.company}</div>
          <div className="role-name">{job.role}</div>
          <StatusBadge status={job.status} />
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(job.id); }} className="btn-delete">×</button>
      </div>
      {job.location && <div className="card-meta">📍 {job.location}</div>}
      {job.salary && <div className="card-meta">💰 {job.salary}</div>}
      {job.contact_name && <div className="card-meta">👤 {job.contact_name}</div>}
      {job.next_action && <div className="card-next-action">{job.next_action}{job.next_action_date ? ` · ${job.next_action_date}` : ""}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.applied;
  return <span className="status-badge" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.icon} {cfg.label}</span>;
}

function Modal({ onClose, children }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button onClick={onClose} className="modal-close">×</button>
        {children}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", ...props }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} {...props} />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange, rows = 3, ...props }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} {...props} />
    </div>
  );
}
