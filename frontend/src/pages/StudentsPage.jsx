import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, Users, Search, ChevronLeft, ChevronRight,
  X, AlertCircle, BookOpen, CheckSquare, ArrowRight, Filter,
  LayoutGrid, List, UserCheck, RefreshCw
} from 'lucide-react';
import { studentsAPI, classesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useActiveYear } from '../contexts/ActiveYearContext';
import { useConfirm } from '../hooks/useConfirm';
import { useMutationSubmit } from '../hooks/useSubmit';
import toast from 'react-hot-toast';

const GRADES = ['PreKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const GRADE_LABELS = { PreKG: 'Pre-KG', LKG: 'LKG', UKG: 'UKG' };
const gradeLabel = g => GRADE_LABELS[g] || `Grade ${g}`;

const GRADE_TO_CATEGORY = {
  PreKG: 'Beginner', LKG: 'Beginner', UKG: 'Beginner', '1': 'Beginner', '2': 'Beginner',
  '3': 'Primary', '4': 'Primary', '5': 'Primary',
  '6': 'Junior', '7': 'Junior', '8': 'Junior',
  '9': 'Inter', '10': 'Inter', '11': 'Inter', '12': 'Inter',
};
const RELIGIONS = ['Christian', 'Hindu', 'Muslim', 'Other'];
const DENOMINATIONS = ['Pentecostal', 'CSI', 'RC', 'Other'];
const CATEGORY_COLOR = { Beginner: 'cat-Beginner', Primary: 'cat-Primary', Junior: 'cat-Junior', Inter: 'cat-Inter' };
const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };

const defaultForm = {
  name: '', gender: '', grade: '',
  religion: 'Christian', christianDenomination: '',
  contactNumber: '', sameAsContact: false, whatsappNumber: '',
  parentName: '', village: '', schoolName: '',
};

// ─── Student Form Modal ────────────────────────────────────────────
function StudentFormModal({ isOpen, onClose, editStudent, classes = [], onSuccess, userRole, loading }) {
  const [form, setForm] = useState(() => editStudent ? {
    name: editStudent.name || '',
    gender: editStudent.gender || '',
    grade: editStudent.grade || '',
    religion: editStudent.religion || 'Christian',
    christianDenomination: editStudent.christianDenomination || '',
    contactNumber: editStudent.contactNumber || '',
    sameAsContact: editStudent.sameAsContact || false,
    whatsappNumber: editStudent.whatsappNumber || '',
    parentName: editStudent.parentName || '',
    village: editStudent.village || '',
    schoolName: editStudent.schoolName || '',
  } : defaultForm);
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.gender) errs.gender = 'Gender is required';
    if (!form.grade) errs.grade = 'Grade is required';
    if (form.contactNumber && !/^\d{10}$/.test(form.contactNumber)) errs.contactNumber = 'Must be 10 digits';
    if (!form.sameAsContact && form.whatsappNumber && !/^\d{10}$/.test(form.whatsappNumber)) errs.whatsappNumber = 'Must be 10 digits';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const category = GRADE_TO_CATEGORY[form.grade];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div className="modal modal-lg" onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}>
        <div className="modal-header">
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {editStudent ? 'Edit Student' : 'Add New Student'}
          </span>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Required fields */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Required Information
            </div>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Full Name <span className="required">*</span></label>
                <input className={`form-input ${errors.name ? 'error' : ''}`}
                  value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Student's full name" />
                {errors.name && <div className="form-error">{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Gender <span className="required">*</span></label>
                <div className="radio-group">
                  {['male', 'female', 'other'].map(g => (
                    <label key={g} className={`radio-option ${form.gender === g ? 'selected' : ''}`}>
                      <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => set('gender', g)} />
                      {GENDER_LABELS[g]}
                    </label>
                  ))}
                </div>
                {errors.gender && <div className="form-error">{errors.gender}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Grade <span className="required">*</span></label>
                <select className={`form-select ${errors.grade ? 'error' : ''}`}
                  value={form.grade} onChange={e => set('grade', e.target.value)}>
                  <option value="">Select grade</option>
                  {GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                </select>
                {form.grade && (
                  <div style={{ marginTop: 5 }}>
                    <span className={`badge ${CATEGORY_COLOR[category]}`}>{category}</span>
                  </div>
                )}
                {errors.grade && <div className="form-error">{errors.grade}</div>}
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* Religion */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Religion <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Religion</label>
                <select className="form-select" value={form.religion} onChange={e => set('religion', e.target.value)}>
                  {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.religion === 'Christian' && (
                <div className="form-group">
                  <label className="form-label">Denomination</label>
                  <select className="form-select" value={form.christianDenomination} onChange={e => set('christianDenomination', e.target.value)}>
                    <option value="">Select denomination</option>
                    {DENOMINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <hr className="divider" />

          {/* Contact */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Contact <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Contact Number</label>
                <input className={`form-input ${errors.contactNumber ? 'error' : ''}`}
                  value={form.contactNumber} onChange={e => set('contactNumber', e.target.value)}
                  placeholder="10-digit mobile number" maxLength={10} inputMode="numeric" />
                {errors.contactNumber && <div className="form-error">{errors.contactNumber}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp Number</label>
                {form.contactNumber && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.sameAsContact}
                      onChange={e => { set('sameAsContact', e.target.checked); if (e.target.checked) set('whatsappNumber', form.contactNumber); }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Same as contact number</span>
                  </label>
                )}
                {!form.sameAsContact ? (
                  <>
                    <input className={`form-input ${errors.whatsappNumber ? 'error' : ''}`}
                      value={form.whatsappNumber} onChange={e => set('whatsappNumber', e.target.value)}
                      placeholder="10-digit WhatsApp number" maxLength={10} inputMode="numeric" />
                    {errors.whatsappNumber && <div className="form-error">{errors.whatsappNumber}</div>}
                  </>
                ) : (
                  <div className="form-input" style={{ background: 'var(--color-bg)', color: 'var(--color-text-secondary)', cursor: 'not-allowed' }}>
                    {form.contactNumber || '—'}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Parent / Guardian Name</label>
                <input className="form-input" value={form.parentName} onChange={e => set('parentName', e.target.value)} placeholder="Parent's name" />
              </div>
              <div className="form-group">
                <label className="form-label">Village / Location</label>
                <input className="form-input" value={form.village} onChange={e => set('village', e.target.value)} placeholder="Village or area name" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">School Name</label>
                <input className="form-input" value={form.schoolName} onChange={e => set('schoolName', e.target.value)} placeholder="School name (optional)" />
              </div>
            </div>
          </div>

          {userRole === 'editor' && (
            <div className="alert alert-info mt-3">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <div>This entry will be submitted for admin approval before being added to the system.</div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" disabled={loading} onClick={() => { if (validate()) onSuccess(form); }}>
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</>
              : userRole === 'editor' ? 'Submit for Approval' : editStudent ? 'Save Changes' : 'Create Student'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Class Allocation Modal ────────────────────────────────────────
function ClassAllocationModal({ isOpen, onClose, student, classes, onSuccess }) {
  const [selectedClass, setSelectedClass] = useState(student?.classAssigned?._id || student?.classAssigned || '');
  const studentCategory = GRADE_TO_CATEGORY[student?.grade];
  const compatibleClasses = classes.filter(c => c.category === studentCategory);
  const otherClasses = classes.filter(c => c.category !== studentCategory);

  if (!isOpen || !student) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div className="modal modal-sm" onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
        <div className="modal-header">
          <div>
            <span style={{ fontWeight: 700 }}>Assign Class</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{student.name}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Compatible ({studentCategory})
            </div>
            {compatibleClasses.length === 0 && (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', padding: '8px 0' }}>No compatible classes found</div>
            )}
            {compatibleClasses.map(cls => (
              <button key={cls._id} onClick={() => setSelectedClass(cls._id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                  border: `2px solid ${selectedClass === cls._id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: selectedClass === cls._id ? 'rgba(26,47,94,0.06)' : 'white',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s'
                }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{cls.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                    {cls.studentCount || 0} / {cls.capacity} students
                  </div>
                </div>
                <span className={`badge ${CATEGORY_COLOR[cls.category]}`}>{cls.category}</span>
              </button>
            ))}

            {otherClasses.length > 0 && (
              <>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', margin: '12px 0 8px' }}>
                  Other Classes
                </div>
                {otherClasses.map(cls => (
                  <button key={cls._id} onClick={() => setSelectedClass(cls._id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                      border: `2px solid ${selectedClass === cls._id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: selectedClass === cls._id ? 'rgba(26,47,94,0.06)' : 'white',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', opacity: 0.7
                    }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{cls.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-warning)' }}>
                        ⚠️ Grade mismatch — {cls.category} class
                      </div>
                    </div>
                    <span className={`badge ${CATEGORY_COLOR[cls.category]}`}>{cls.category}</span>
                  </button>
                ))}
              </>
            )}

            <button onClick={() => setSelectedClass('')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                border: `2px solid ${selectedClass === '' ? '#ef4444' : 'var(--color-border)'}`,
                background: selectedClass === '' ? '#fef2f2' : 'white',
                cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s'
              }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ef4444' }}>Remove from Class</span>
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSuccess(student._id, selectedClass)}>
            Save Assignment
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Bulk Allocate Modal ───────────────────────────────────────────
function BulkAllocateModal({ isOpen, onClose, selectedStudents, classes, onSuccess }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [preview, setPreview] = useState(null);

  const categoryGroups = selectedStudents.reduce((acc, s) => {
    const cat = GRADE_TO_CATEGORY[s.grade];
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const dominantCategory = Object.entries(categoryGroups).sort((a, b) => b[1] - a[1])[0]?.[0];
  const compatibleClasses = classes.filter(c => c.category === dominantCategory);

  const handleSelectClass = cls => {
    setSelectedClass(cls._id);
    const incompatible = selectedStudents.filter(s => GRADE_TO_CATEGORY[s.grade] !== cls.category);
    setPreview({ cls, incompatible });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div className="modal modal-lg" onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
        <div className="modal-header">
          <div>
            <span style={{ fontWeight: 700 }}>Bulk Class Allocation</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {selectedStudents.length} students selected
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {Object.entries(categoryGroups).map(([cat, count]) => (
              <span key={cat} className={`badge ${CATEGORY_COLOR[cat]}`}>{count} {cat}</span>
            ))}
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Select a class to allocate the selected students. Students with incompatible grades will be flagged.
          </div>

          {compatibleClasses.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-success)', marginBottom: 8 }}>
                ✓ Recommended — {dominantCategory} Classes
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {compatibleClasses.map(cls => (
                  <button key={cls._id} onClick={() => handleSelectClass(cls)}
                    style={{
                      padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                      border: `2px solid ${selectedClass === cls._id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: selectedClass === cls._id ? 'rgba(26,47,94,0.06)' : 'white',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s'
                    }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{cls.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {cls.studentCount || 0}/{cls.capacity} · {cls.category}
                      {cls.teacher?.name && <> · {cls.teacher.name}</>}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(((cls.studentCount || 0) / cls.capacity) * 100, 100)}%`, background: (cls.studentCount || 0) >= cls.capacity ? '#ef4444' : 'var(--color-primary)' }} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {classes.filter(c => c.category !== dominantCategory).length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-warning)', marginBottom: 8 }}>
                ⚠️ Other Classes (Grade Mismatch)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {classes.filter(c => c.category !== dominantCategory).map(cls => (
                  <button key={cls._id} onClick={() => handleSelectClass(cls)}
                    style={{
                      padding: '12px 14px', borderRadius: 10, textAlign: 'left', opacity: 0.75,
                      border: `2px solid ${selectedClass === cls._id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: selectedClass === cls._id ? 'rgba(26,47,94,0.06)' : 'white',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s'
                    }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{cls.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {cls.studentCount || 0}/{cls.capacity} · {cls.category}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {preview && preview.incompatible.length > 0 && (
            <div className="alert alert-warning" style={{ marginTop: 16 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <div>
                <strong>{preview.incompatible.length} student(s)</strong> have grades incompatible with{' '}
                <strong>{preview.cls.name}</strong> ({preview.cls.category}).
                They will still be allocated but may need to be reassigned.
                <div style={{ marginTop: 4, fontSize: '0.75rem' }}>
                  {preview.incompatible.map(s => `${s.name} (${gradeLabel(s.grade)})`).join(', ')}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selectedClass}
            onClick={() => onSuccess(selectedStudents.map(s => s._id), selectedClass)}>
            <ArrowRight size={15} /> Allocate {selectedStudents.length} Students
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Class Roster Panel ────────────────────────────────────────────
function ClassRosterView({ classes, students, onAllocate, onBulkAllocate, isAdmin }) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?._id || '');
  const [search, setSearch] = useState('');

  const selectedClass = classes.find(c => c._id === selectedClassId);
  const classStudents = students.filter(s =>
    s.classAssigned?._id === selectedClassId || s.classAssigned === selectedClassId
  );
  const unallocatedStudents = students.filter(s => !s.classAssigned);
  const filteredUnallocated = unallocatedStudents.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.grade?.includes(search)
  );

  const [selectedIds, setSelectedIds] = useState([]);
  const toggleId = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const selectedStudentObjs = filteredUnallocated.filter(s => selectedIds.includes(s._id));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18, height: '70vh' }}>
      {/* Class list */}
      <div className="card" style={{ overflow: 'auto' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.85rem' }}>
          Classes
        </div>
        <div style={{ padding: '8px' }}>
          {classes.map(cls => (
            <button key={cls._id} onClick={() => setSelectedClassId(cls._id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 12px', borderRadius: 9, marginBottom: 2,
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                background: selectedClassId === cls._id ? 'rgba(26,47,94,0.08)' : 'transparent',
                borderLeft: `3px solid ${selectedClassId === cls._id ? 'var(--color-primary)' : 'transparent'}`,
                transition: 'all 0.15s', textAlign: 'left'
              }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.835rem', color: 'var(--color-text)' }}>{cls.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{cls.category}</div>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
                {students.filter(s => s.classAssigned?._id === cls._id || s.classAssigned === cls._id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
        {selectedClass && (
          <div className="card" style={{ padding: '14px 18px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{selectedClass.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {classStudents.length}/{selectedClass.capacity} students ·{' '}
                  {selectedClass.teacher?.name || 'No teacher assigned'} ·{' '}
                  <span className={`badge ${CATEGORY_COLOR[selectedClass.category]}`}>{selectedClass.category}</span>
                </div>
              </div>
              <div style={{ height: 40, width: 40, borderRadius: '50%', position: 'relative' }}>
                <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="16" fill="none"
                    stroke={classStudents.length >= selectedClass.capacity ? '#ef4444' : 'var(--color-primary)'}
                    strokeWidth="3"
                    strokeDasharray={`${(classStudents.length / selectedClass.capacity) * 100} 100`} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800 }}>
                  {Math.round((classStudents.length / selectedClass.capacity) * 100)}%
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1, overflow: 'hidden' }}>
          {/* Class students */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0 }}>
              In This Class ({classStudents.length})
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {classStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>No students in this class</div>
              ) : (
                <table style={{ width: '100%' }}>
                  <thead><tr>
                    <th style={{ padding: '8px 12px', fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, textAlign: 'left', background: 'var(--color-bg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, textAlign: 'left', background: 'var(--color-bg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grade</th>
                    {isAdmin && <th style={{ padding: '8px 12px', background: 'var(--color-bg)' }}></th>}
                  </tr></thead>
                  <tbody>
                    {classStudents.map(s => (
                      <tr key={s._id} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: '0.82rem' }}>{s.name}</td>
                        <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{gradeLabel(s.grade)}</td>
                        {isAdmin && (
                          <td style={{ padding: '8px 12px' }}>
                            <button onClick={() => onAllocate(s, '')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                              title="Remove from class">
                              <X size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Unallocated students */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Unallocated ({unallocatedStudents.length})</span>
                {isAdmin && selectedIds.length > 0 && (
                  <button className="btn btn-primary btn-sm"
                    onClick={() => onBulkAllocate(selectedStudentObjs, selectedClassId)}>
                    Assign {selectedIds.length} →
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search unallocated..." style={{ width: '100%', paddingLeft: 28, padding: '6px 8px 6px 28px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: '0.8rem', outline: 'none', fontFamily: 'var(--font-sans)' }} />
              </div>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {filteredUnallocated.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                  {search ? 'No results' : 'All students are allocated!'}
                </div>
              ) : (
                <table style={{ width: '100%' }}>
                  <thead><tr>
                    {isAdmin && <th style={{ padding: '8px 12px', background: 'var(--color-bg)' }}>
                      <input type="checkbox"
                        checked={selectedIds.length === filteredUnallocated.length && filteredUnallocated.length > 0}
                        onChange={() => setSelectedIds(selectedIds.length === filteredUnallocated.length ? [] : filteredUnallocated.map(s => s._id))} />
                    </th>}
                    <th style={{ padding: '8px 12px', fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, textAlign: 'left', background: 'var(--color-bg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                    <th style={{ padding: '8px 12px', fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, textAlign: 'left', background: 'var(--color-bg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grade</th>
                    {isAdmin && <th style={{ padding: '8px 12px', background: 'var(--color-bg)' }}></th>}
                  </tr></thead>
                  <tbody>
                    {filteredUnallocated.map(s => {
                      const isCompatible = !selectedClass || GRADE_TO_CATEGORY[s.grade] === selectedClass.category;
                      return (
                        <tr key={s._id} style={{ borderTop: '1px solid var(--color-border-light)', background: selectedIds.includes(s._id) ? 'rgba(26,47,94,0.04)' : undefined }}>
                          {isAdmin && <td style={{ padding: '8px 12px' }}>
                            <input type="checkbox" checked={selectedIds.includes(s._id)} onChange={() => toggleId(s._id)} />
                          </td>}
                          <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: '0.82rem' }}>
                            {s.name}
                            {!isCompatible && <span style={{ marginLeft: 4, color: 'var(--color-warning)', fontSize: '0.65rem' }}>⚠️</span>}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{gradeLabel(s.grade)}</td>
                          {isAdmin && (
                            <td style={{ padding: '8px 12px' }}>
                              <button onClick={() => onAllocate(s, selectedClassId)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 4 }}
                                title="Add to this class">
                                <ArrowRight size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Students Page ────────────────────────────────────────────
export default function StudentsPage() {
  const { user } = useAuth();
  const { vbsYear } = useActiveYear();
  const qc = useQueryClient();
  const { confirm, ConfirmModal } = useConfirm();
  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor';
  const isTeacher = user?.role === 'teacher';
  const isReadOnly = user?.role === 'viewer' || isTeacher;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'allocation'
  const [showForm, setShowForm] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [allocateStudent, setAllocateStudent] = useState(null);
  const [bulkAllocateStudents, setBulkAllocateStudents] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['students', page, search, filterGrade, filterCategory, filterClass, vbsYear],
    queryFn: () => studentsAPI.getAll({
      page, limit: 50, search, grade: filterGrade,
      category: filterCategory, classAssigned: filterClass, vbsYear,
    }),
    select: d => d.data,
    keepPreviousData: true,
    enabled: !!vbsYear,
  });

  // For allocation view, fetch all students (no pagination)
  const { data: allStudentsData } = useQuery({
    queryKey: ['all-students-allocation', vbsYear],
    queryFn: () => studentsAPI.getAll({ limit: 500, vbsYear }),
    select: d => d.data?.data || [],
    enabled: viewMode === 'allocation' && isAdmin && !!vbsYear,
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes', vbsYear],
    queryFn: () => classesAPI.getAll({ year: vbsYear }),
    select: d => d.data?.data || [],
    enabled: (isAdmin || isEditor) && !!vbsYear,
  });

  const createMut = useMutation({
    mutationFn: data => studentsAPI.create(data),
    onSuccess: res => {
      qc.invalidateQueries(['students']);
      qc.invalidateQueries(['all-students-allocation']);
      const msg = res.data?.staged ? 'Student submitted for approval' : `Student created! ID: ${res.data?.data?.studentId}`;
      toast.success(msg);
      setShowForm(false);
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleCreate, loading: createLoading } = useMutationSubmit(createMut);

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => studentsAPI.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries(['students']);
      qc.invalidateQueries(['all-students-allocation']);
      toast.success('Student updated');
      setEditStudent(null);
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });
  const { submit: handleUpdate, loading: updateLoading } = useMutationSubmit(updateMut);

  const deleteMut = useMutation({
    mutationFn: id => studentsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['students']);
      qc.invalidateQueries(['all-students-allocation']);
      toast.success('Student deleted');
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed'),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: ids => studentsAPI.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries(['students']);
      qc.invalidateQueries(['all-students-allocation']);
      toast.success(`${selectedIds.length} students deleted`);
      setSelectedIds([]);
    },
  });
  const { submit: handleBulkDelete, loading: bulkDeleteLoading } = useMutationSubmit(bulkDeleteMut);

  const allocateMut = useMutation({
    mutationFn: ({ studentId, classId }) => classId
      ? studentsAPI.bulkAllocate({ studentIds: [studentId], classId })
      : studentsAPI.update(studentId, { classAssigned: null }),
    onSuccess: () => {
      qc.invalidateQueries(['students']);
      qc.invalidateQueries(['all-students-allocation']);
      qc.invalidateQueries(['classes']);
      toast.success('Class assignment updated');
      setAllocateStudent(null);
    },
    onError: err => toast.error(err.response?.data?.message || 'Assignment failed'),
  });

  const bulkAllocateMut = useMutation({
    mutationFn: ({ studentIds, classId }) => studentsAPI.bulkAllocate({ studentIds, classId }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries(['students']);
      qc.invalidateQueries(['all-students-allocation']);
      qc.invalidateQueries(['classes']);
      toast.success(`${vars.studentIds.length} students allocated`);
      setBulkAllocateStudents(null);
      setSelectedIds([]);
    },
    onError: err => toast.error(err.response?.data?.message || 'Bulk allocation failed'),
  });

  const students = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.pages || 1;
  const classes = classesData || [];

  const toggleSelect = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === students.length ? [] : students.map(s => s._id));

  const handleDelete = async s => {
    const ok = await confirm({
      title: `Delete "${s.name}"?`,
      message: 'This will permanently remove the student and cannot be undone.',
      confirmLabel: 'Delete Student',
      type: 'danger',
    });
    if (ok) deleteMut.mutate(s._id);
  };

  const handleBulkDeleteConfirm = async () => {
    const ok = await confirm({
      title: `Delete ${selectedIds.length} Students?`,
      message: 'All selected students will be permanently removed. This cannot be undone.',
      confirmLabel: `Delete ${selectedIds.length} Students`,
      type: 'danger',
    });
    if (ok) handleBulkDelete(selectedIds);
  };

  if (!vbsYear) return (
    <div className="empty-state">
      <Users size={36} style={{ color: 'var(--color-text-muted)' }} />
      <h3>No Active VBS Year</h3>
      <p>Please select or create a VBS year in Settings first.</p>
    </div>
  );

  return (
    <div>
      {ConfirmModal}
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{total} students registered · VBS {vbsYear}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          {isAdmin && (
            <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: 8, padding: 3, border: '1px solid var(--color-border)' }}>
              <button onClick={() => setViewMode('list')}
                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 600, background: viewMode === 'list' ? 'white' : 'transparent', boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}>
                <List size={14} /> List
              </button>
              <button onClick={() => setViewMode('allocation')}
                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.78rem', fontWeight: 600, background: viewMode === 'allocation' ? 'white' : 'transparent', boxShadow: viewMode === 'allocation' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5 }}>
                <BookOpen size={14} /> Allocate
              </button>
            </div>
          )}

          {isAdmin && selectedIds.length > 0 && viewMode === 'list' && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setBulkAllocateStudents(students.filter(s => selectedIds.includes(s._id)))}>
                <UserCheck size={14} /> Assign to Class ({selectedIds.length})
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleBulkDeleteConfirm} disabled={bulkDeleteLoading}>
                <Trash2 size={14} /> Delete ({selectedIds.length})
              </button>
            </>
          )}

          {!isReadOnly && (
            <button className="btn btn-primary" onClick={() => { setEditStudent(null); setShowForm(true); }}>
              <Plus size={16} /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* Allocation View */}
      {viewMode === 'allocation' && isAdmin && (
        <ClassRosterView
          classes={classes}
          students={allStudentsData || []}
          onAllocate={(student, classId) => {
            if (classId !== undefined) {
              allocateMut.mutate({ studentId: student._id, classId });
            } else {
              setAllocateStudent(student);
            }
          }}
          onBulkAllocate={(studs, classId) => {
            if (classId) {
              bulkAllocateMut.mutate({ studentIds: studs.map(s => s._id), classId });
            }
          }}
          isAdmin={isAdmin}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: 16, padding: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                <input className="form-input"
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name, ID, village, contact..."
                  style={{ paddingLeft: 36 }} />
              </div>

              {!isTeacher && (
                <>
                  <select className="form-select" style={{ width: 130 }} value={filterGrade}
                    onChange={e => { setFilterGrade(e.target.value); setFilterCategory(''); setPage(1); }}>
                    <option value="">All Grades</option>
                    {GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                  </select>
                  <select className="form-select" style={{ width: 140 }} value={filterCategory}
                    onChange={e => { setFilterCategory(e.target.value); setFilterGrade(''); setPage(1); }}>
                    <option value="">All Categories</option>
                    {['Beginner', 'Primary', 'Junior', 'Inter'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {isAdmin && (
                    <select className="form-select" style={{ width: 160 }} value={filterClass}
                      onChange={e => { setFilterClass(e.target.value); setPage(1); }}>
                      <option value="">All Classes</option>
                      <option value="unassigned">Unassigned</option>
                      {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  )}
                </>
              )}

              {(search || filterGrade || filterCategory || filterClass) && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterGrade(''); setFilterCategory(''); setFilterClass(''); setPage(1); }}>
                  <X size={14} /> Clear
                </button>
              )}
              {isFetching && <div className="spinner spinner-sm" />}
            </div>
          </div>

          {/* Table */}
          <div className="card">
            {isLoading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : students.length === 0 ? (
              <div className="empty-state">
                <Users size={36} style={{ color: 'var(--color-text-muted)' }} />
                <h3>No students found</h3>
                <p>{search || filterGrade || filterCategory ? 'Try adjusting your filters' : `No students registered for VBS ${vbsYear}`}</p>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        {isAdmin && <th style={{ width: 36 }}><input type="checkbox" checked={selectedIds.length === students.length && students.length > 0} onChange={toggleAll} /></th>}
                        <th>Student ID</th>
                        <th>Name</th>
                        <th>Grade</th>
                        {!isTeacher && <th>Category</th>}
                        <th>Religion</th>
                        <th>Village</th>
                        {!isTeacher && <th>Class</th>}
                        <th>Contact</th>
                        {!isReadOnly && <th style={{ width: 100 }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {students.map(s => (
                          <motion.tr key={s._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} layout>
                            {isAdmin && (
                              <td><input type="checkbox" checked={selectedIds.includes(s._id)} onChange={() => toggleSelect(s._id)} /></td>
                            )}
                            <td><span className="code">{s.studentId || '—'}</span></td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{s.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{s.gender}</div>
                            </td>
                            <td style={{ fontWeight: 600 }}>{gradeLabel(s.grade)}</td>
                            {!isTeacher && (
                              <td><span className={`badge ${CATEGORY_COLOR[s.category]}`}>{s.category}</span></td>
                            )}
                            <td style={{ fontSize: '0.82rem' }}>
                              {s.religion}
                              {s.christianDenomination && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>{s.christianDenomination}</div>}
                            </td>
                            <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>{s.village || '—'}</td>
                            {!isTeacher && (
                              <td>
                                {s.classAssigned?.name
                                  ? <span className="badge badge-navy">{s.classAssigned.name}</span>
                                  : isAdmin
                                    ? <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', padding: '2px 8px' }}
                                      onClick={() => setAllocateStudent(s)}>
                                      + Assign
                                    </button>
                                    : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>Unassigned</span>
                                }
                              </td>
                            )}
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{s.contactNumber || '—'}</td>
                            {!isReadOnly && (
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {isAdmin && (
                                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setAllocateStudent(s)} title="Assign class">
                                      <BookOpen size={13} />
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setEditStudent(s)} title="Edit">
                                      <Edit2 size={13} />
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(s)} title="Delete" style={{ color: 'var(--color-danger)' }}>
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <span className="page-info">
                      Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total}
                    </span>
                    <div className="page-btns">
                      <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                        <ChevronLeft size={15} />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                        <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setPage(p)} style={{ minWidth: 32, justifyContent: 'center' }}>{p}</button>
                      ))}
                      <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showForm || editStudent) && (
          <StudentFormModal
            isOpen={true}
            onClose={() => { setShowForm(false); setEditStudent(null); }}
            editStudent={editStudent}
            classes={classes}
            userRole={user?.role}
            loading={createLoading || updateLoading}
            onSuccess={form => {
              if (editStudent) handleUpdate({ id: editStudent._id, data: form });
              else handleCreate(form);
            }}
          />
        )}
      </AnimatePresence>

      {allocateStudent && (
        <ClassAllocationModal
          isOpen={true}
          onClose={() => setAllocateStudent(null)}
          student={allocateStudent}
          classes={classes}
          onSuccess={(studentId, classId) => {
            if (classId) {
              allocateMut.mutate({ studentId, classId });
            } else {
              updateMut.mutate({ id: studentId, data: { classAssigned: null } });
              setAllocateStudent(null);
            }
          }}
        />
      )}

      {bulkAllocateStudents && (
        <BulkAllocateModal
          isOpen={true}
          onClose={() => setBulkAllocateStudents(null)}
          selectedStudents={bulkAllocateStudents}
          classes={classes}
          onSuccess={(studentIds, classId) => bulkAllocateMut.mutate({ studentIds, classId })}
        />
      )}
    </div>
  );
}