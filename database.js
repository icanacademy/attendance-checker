const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'attendance.db'));

// Initialize database schema
function initializeDatabase() {
  // Create attendance table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_name TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      late_reason TEXT,
      absent_reason TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(teacher_id, date)
    )
  `);

  // Create class assignments table for substitute teachers
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attendance_id INTEGER NOT NULL,
      class_slot TEXT NOT NULL,
      no_class INTEGER DEFAULT 0,
      online_class INTEGER DEFAULT 0,
      substitute_teacher_id TEXT,
      substitute_teacher_name TEXT,
      students TEXT,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE
    )
  `);

  // Add no_class column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE class_assignments ADD COLUMN no_class INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add online_class column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE class_assignments ADD COLUMN online_class INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migrate existing attendance table to add late_reason and absent_reason columns
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN late_reason TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN absent_reason TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add is_active column (1 = active, 0 = deactivated/not applicable)
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN is_active INTEGER DEFAULT 1`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add minutes_late column to track how many minutes late
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN minutes_late INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add undertime columns
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN has_undertime INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN undertime_minutes INTEGER`);
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN undertime_reason TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add assignment_type column to class_assignments to distinguish between late/absent and undertime
  try {
    db.exec(`ALTER TABLE class_assignments ADD COLUMN assignment_type TEXT DEFAULT 'regular'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add official_leave_type column for tracking sick leave vs vacation leave
  try {
    db.exec(`ALTER TABLE attendance ADD COLUMN official_leave_type TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  console.log('Database initialized successfully');
}

// Mark attendance
function markAttendance(teacherId, teacherName, date, status, startTime, endTime, lateReason = null, absentReason = null, isActive = 1, minutesLate = null, hasUndertime = 0, undertimeMinutes = null, undertimeReason = null, officialLeaveType = null) {
  const stmt = db.prepare(`
    INSERT INTO attendance (teacher_id, teacher_name, date, status, start_time, end_time, late_reason, absent_reason, is_active, minutes_late, has_undertime, undertime_minutes, undertime_reason, official_leave_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(teacher_id, date) DO UPDATE SET
      status = excluded.status,
      late_reason = excluded.late_reason,
      absent_reason = excluded.absent_reason,
      is_active = excluded.is_active,
      minutes_late = excluded.minutes_late,
      has_undertime = excluded.has_undertime,
      undertime_minutes = excluded.undertime_minutes,
      undertime_reason = excluded.undertime_reason,
      official_leave_type = excluded.official_leave_type,
      timestamp = CURRENT_TIMESTAMP
  `);

  stmt.run(teacherId, teacherName, date, status, startTime, endTime, lateReason, absentReason, isActive, minutesLate, hasUndertime, undertimeMinutes, undertimeReason, officialLeaveType);

  // Get the actual ID of the record (whether inserted or updated)
  const getIdStmt = db.prepare(`
    SELECT id FROM attendance WHERE teacher_id = ? AND date = ?
  `);

  const record = getIdStmt.get(teacherId, date);
  return { id: record.id };
}

// Toggle teacher active status for a specific date
function toggleTeacherActiveStatus(teacherId, teacherName, date, isActive, startTime = '', endTime = '') {
  try {
    const stmt = db.prepare(`
      INSERT INTO attendance (teacher_id, teacher_name, date, status, start_time, end_time, is_active)
      VALUES (?, ?, ?, 'unmarked', ?, ?, ?)
      ON CONFLICT(teacher_id, date) DO UPDATE SET
        is_active = excluded.is_active
    `);

    stmt.run(teacherId, teacherName, date, startTime, endTime, isActive);
    return true;
  } catch (error) {
    console.error('Error toggling teacher active status:', error);
    throw error;
  }
}

// Save class assignments for absent/late teacher or undertime
function saveClassAssignments(attendanceId, classAssignments, assignmentType = 'regular') {
  // Delete existing assignments of this type only
  const deleteStmt = db.prepare(`DELETE FROM class_assignments WHERE attendance_id = ? AND assignment_type = ?`);
  deleteStmt.run(attendanceId, assignmentType);

  // Insert new assignments
  const insertStmt = db.prepare(`
    INSERT INTO class_assignments (attendance_id, class_slot, no_class, online_class, substitute_teacher_id, substitute_teacher_name, students, assignment_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const assignment of classAssignments) {
    insertStmt.run(
      attendanceId,
      assignment.classSlot,
      assignment.noClass ? 1 : 0,
      assignment.onlineClass ? 1 : 0,
      assignment.substituteTeacherId,
      assignment.substituteTeacherName,
      JSON.stringify(assignment.students || []),
      assignmentType
    );
  }
}

// Get class assignments for an attendance record
function getClassAssignments(attendanceId, assignmentType = null) {
  let stmt;
  let assignments;

  if (assignmentType) {
    stmt = db.prepare(`
      SELECT * FROM class_assignments WHERE attendance_id = ? AND assignment_type = ?
    `);
    assignments = stmt.all(attendanceId, assignmentType);
  } else {
    stmt = db.prepare(`
      SELECT * FROM class_assignments WHERE attendance_id = ?
    `);
    assignments = stmt.all(attendanceId);
  }

  return assignments.map(a => ({
    ...a,
    noClass: a.no_class === 1,
    onlineClass: a.online_class === 1,
    students: JSON.parse(a.students || '[]')
  }));
}

// Get attendance for a specific date
function getAttendanceByDate(date) {
  const stmt = db.prepare(`
    SELECT * FROM attendance WHERE date = ? ORDER BY teacher_name
  `);

  return stmt.all(date);
}

// Get attendance for date range
function getAttendanceByDateRange(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT * FROM attendance
    WHERE date BETWEEN ? AND ?
    ORDER BY date DESC, teacher_name
  `);

  return stmt.all(startDate, endDate);
}

// Get summary statistics
function getAttendanceSummary(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT
      date,
      COUNT(*) as total_teachers,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_count
    FROM attendance
    WHERE date BETWEEN ? AND ?
    GROUP BY date
    ORDER BY date DESC
  `);

  return stmt.all(startDate, endDate);
}

// Get teacher attendance history
function getTeacherHistory(teacherId, limit = 30) {
  const stmt = db.prepare(`
    SELECT * FROM attendance
    WHERE teacher_id = ?
    ORDER BY date DESC
    LIMIT ?
  `);

  return stmt.all(teacherId, limit);
}

// Delete all attendance records for a specific date
function deleteAttendanceByDate(date) {
  const stmt = db.prepare(`
    DELETE FROM attendance WHERE date = ?
  `);

  const result = stmt.run(date);
  return result.changes; // Returns number of deleted records
}

// Delete attendance for a specific teacher on a specific date
function deleteTeacherAttendance(teacherId, date) {
  const stmt = db.prepare(`
    DELETE FROM attendance WHERE teacher_id = ? AND date = ?
  `);

  const result = stmt.run(teacherId, date);
  return result.changes; // Returns number of deleted records
}

// Get all unique dates that have attendance data
function getAllDatesWithData() {
  const stmt = db.prepare(`
    SELECT DISTINCT date FROM attendance ORDER BY date DESC
  `);

  return stmt.all().map(row => row.date);
}

module.exports = {
  initializeDatabase,
  markAttendance,
  toggleTeacherActiveStatus,
  saveClassAssignments,
  getClassAssignments,
  getAttendanceByDate,
  getAttendanceByDateRange,
  getAttendanceSummary,
  getTeacherHistory,
  deleteAttendanceByDate,
  deleteTeacherAttendance,
  getAllDatesWithData,
  db
};
