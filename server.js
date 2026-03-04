const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const {
  initializeDatabase,
  markAttendance,
  toggleTeacherActiveStatus,
  saveClassAssignments,
  getClassAssignments,
  getAttendanceByDate,
  getAttendanceByDateRange,
  getAttendanceSummary,
  deleteAttendanceByDate,
  deleteTeacherAttendance,
  getAllDatesWithData,
  db
} = require('./database');

const app = express();
const PORT = 3001;

// Notion setup
const NOTION_API_KEY = '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';
const DATABASE_ID = '1abd37d6663080ae9307ddbee22c48b1';
const STUDENT_DATABASE_ID = '1abd37d666308071bfe1e37d1d155035';

const notion = new Client({ auth: NOTION_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
initializeDatabase();

// Helper function to get today's date in YYYY-MM-DD format (timezone-safe)
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to convert time string to 24-hour number for sorting
function timeToSortValue(timeString) {
  if (!timeString) return 9999; // Put empty times at the end

  const match = timeString.match(/(\d+)(am|pm)/i);
  if (!match) return 9999;

  let hour = parseInt(match[1]);
  const period = match[2].toLowerCase();

  if (period === 'pm' && hour !== 12) {
    hour += 12;
  } else if (period === 'am' && hour === 12) {
    hour = 0;
  }

  return hour;
}

// API Routes

// Get all active teachers from Notion
app.get('/api/teachers', async (req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Status',
        select: {
          equals: 'Active'
        }
      }
    });

    const teachers = response.results.map(page => {
      const properties = page.properties;

      return {
        id: page.id,
        name: properties['Full Name']?.title?.[0]?.plain_text || 'Unknown',
        status: properties['Status']?.select?.name || 'Unknown',
        startTime: properties['Start Time']?.select?.name || '',
        endTime: properties['End Time']?.select?.name || ''
      };
    });

    // Sort by shift time (start time), then by name
    teachers.sort((a, b) => {
      const timeA = timeToSortValue(a.startTime);
      const timeB = timeToSortValue(b.startTime);

      if (timeA !== timeB) {
        return timeA - timeB;
      }

      // If same start time, sort by name
      return a.name.localeCompare(b.name);
    });

    res.json({ success: true, teachers });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all active students from Notion
app.get('/api/students', async (req, res) => {
  try {
    const response = await notion.databases.query({
      database_id: STUDENT_DATABASE_ID,
      filter: {
        property: 'Status',
        select: {
          equals: 'Active'
        }
      },
      sorts: [
        {
          property: 'Full Name',
          direction: 'ascending'
        }
      ]
    });

    const students = response.results.map(page => {
      const properties = page.properties;
      return {
        id: page.id,
        name: properties['Full Name']?.title?.[0]?.plain_text || 'Unknown',
        startTime: properties['Start Time']?.select?.name || '',
        endTime: properties['End Time']?.select?.name || ''
      };
    });

    res.json({ success: true, students });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit attendance for a specific date
app.post('/api/attendance', async (req, res) => {
  try {
    const { attendance, date } = req.body;
    const targetDate = date || getTodayDate();

    // Save each attendance record
    for (const record of attendance) {
      const result = markAttendance(
        record.teacherId,
        record.teacherName,
        targetDate,
        record.status,
        record.startTime,
        record.endTime,
        record.lateReason || null,
        record.absentReason || null,
        1, // isActive - default to active
        record.minutesLate || null,
        record.hasUndertime || 0,
        record.undertimeMinutes || null,
        record.undertimeReason || null,
        record.officialLeaveType || null
      );

      // If absent or late and has class assignments, save them
      if ((record.status === 'absent' || record.status === 'late') && record.classAssignments && record.classAssignments.length > 0) {
        saveClassAssignments(result.id, record.classAssignments, 'regular');
      }

      // If has undertime and has undertime class assignments, save them
      if (record.hasUndertime && record.undertimeClassAssignments && record.undertimeClassAssignments.length > 0) {
        saveClassAssignments(result.id, record.undertimeClassAssignments, 'undertime');
      }
    }

    res.json({ success: true, message: 'Attendance recorded successfully' });
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all attendance for a specific date
app.delete('/api/attendance/:date', (req, res) => {
  try {
    const { date } = req.params;
    const deletedCount = deleteAttendanceByDate(date);

    res.json({
      success: true,
      message: `Deleted ${deletedCount} attendance record(s) for ${date}`,
      deletedCount
    });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete attendance for a specific teacher on a specific date
app.delete('/api/attendance/:date/:teacherId', (req, res) => {
  try {
    const { date, teacherId } = req.params;
    const deletedCount = deleteTeacherAttendance(teacherId, date);

    res.json({
      success: true,
      message: `Deleted attendance for teacher ${teacherId} on ${date}`,
      deletedCount
    });
  } catch (error) {
    console.error('Error deleting teacher attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle teacher active status for a specific date
app.patch('/api/attendance/:date/:teacherId/active', (req, res) => {
  try {
    const { date, teacherId } = req.params;
    const { isActive, teacherName, startTime, endTime } = req.body;

    toggleTeacherActiveStatus(
      teacherId,
      teacherName,
      date,
      isActive ? 1 : 0,
      startTime || '',
      endTime || ''
    );

    res.json({
      success: true,
      message: `Teacher ${teacherName || teacherId} ${isActive ? 'activated' : 'deactivated'} for ${date}`
    });
  } catch (error) {
    console.error('Error toggling teacher active status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get attendance history for a specific teacher (must be before /api/attendance/:date)
app.get('/api/attendance/history/:teacherId', (req, res) => {
  try {
    const { teacherId } = req.params;
    const { startDate, endDate } = req.query;
    const limit = parseInt(req.query.limit) || 500;

    let query = `SELECT * FROM attendance WHERE teacher_id = ?`;
    const params = [teacherId];

    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY date DESC LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(query);
    const attendance = stmt.all(...params);

    // Add class assignments for late/absent records and undertime assignments
    const attendanceWithAssignments = attendance.map(record => {
      let additionalData = {};

      // Get class assignments for absent/late teachers
      if (record.status === 'absent' || record.status === 'late') {
        const classAssignments = getClassAssignments(record.id, 'regular');
        additionalData.classAssignments = classAssignments;
      }

      // Get undertime class assignments if teacher has undertime
      if (record.has_undertime === 1) {
        const undertimeClassAssignments = getClassAssignments(record.id, 'undertime');
        additionalData.undertimeClassAssignments = undertimeClassAssignments;
      }

      return { ...record, ...additionalData };
    });

    res.json({ success: true, attendance: attendanceWithAssignments });
  } catch (error) {
    console.error('Error fetching teacher history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get attendance for a specific date
app.get('/api/attendance/:date', (req, res) => {
  try {
    const { date } = req.params;
    const attendance = getAttendanceByDate(date);

    // Add class assignments for absent and late teachers, and undertime assignments
    const attendanceWithAssignments = attendance.map(record => {
      let additionalData = {};

      // Get class assignments for absent/late teachers
      if (record.status === 'absent' || record.status === 'late') {
        const classAssignments = getClassAssignments(record.id, 'regular');
        additionalData.classAssignments = classAssignments;
      }

      // Get undertime class assignments if teacher has undertime
      if (record.has_undertime === 1) {
        const undertimeClassAssignments = getClassAssignments(record.id, 'undertime');
        additionalData.undertimeClassAssignments = undertimeClassAssignments;
      }

      return { ...record, ...additionalData };
    });

    res.json({ success: true, attendance: attendanceWithAssignments });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get attendance details for a specific teacher on a specific date
app.get('/api/attendance/teacher/:teacherId', (req, res) => {
  try {
    const { teacherId } = req.params;
    const date = req.query.date || getTodayDate();
    const { db } = require('./database');

    const stmt = db.prepare(`
      SELECT * FROM attendance WHERE teacher_id = ? AND date = ?
    `);
    const attendance = stmt.get(teacherId, date);

    if (!attendance) {
      return res.json({ success: true, attendance: null });
    }

    // Get class assignments if absent or late
    let classAssignments = [];
    if (attendance.status === 'absent' || attendance.status === 'late') {
      classAssignments = getClassAssignments(attendance.id);
    }

    res.json({
      success: true,
      attendance: {
        ...attendance,
        classAssignments
      }
    });
  } catch (error) {
    console.error('Error fetching teacher attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get today's attendance
app.get('/api/attendance/today', (req, res) => {
  try {
    const date = getTodayDate();
    const attendance = getAttendanceByDate(date);
    res.json({ success: true, date, attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all dates that have attendance data
app.get('/api/attendance-dates', (req, res) => {
  try {
    const dates = getAllDatesWithData();
    res.json({ success: true, dates });
  } catch (error) {
    console.error('Error fetching attendance dates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get attendance report for date range
app.get('/api/reports/range', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const attendance = getAttendanceByDateRange(startDate, endDate);
    const summary = getAttendanceSummary(startDate, endDate);

    // Add class assignments for absent and late records
    const attendanceWithAssignments = attendance.map(record => {
      if (record.status === 'absent' || record.status === 'late') {
        const classAssignments = getClassAssignments(record.id);
        return { ...record, classAssignments };
      }
      return record;
    });

    res.json({ success: true, attendance: attendanceWithAssignments, summary });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export attendance to CSV
app.get('/api/export/csv', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const attendance = getAttendanceByDateRange(startDate, endDate);

    // Create CSV content
    const headers = ['Date', 'Teacher Name', 'Status', 'Start Time', 'End Time', 'Timestamp'];
    const csvRows = [headers.join(',')];

    attendance.forEach(record => {
      const row = [
        record.date,
        `"${record.teacher_name}"`,
        record.status,
        record.start_time || '',
        record.end_time || '',
        record.timestamp
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${startDate}_to_${endDate}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get teachers already assigned as substitutes for a specific date/time slot
app.get('/api/substitute-assignments/:date/:timeSlot', (req, res) => {
  try {
    const { date, timeSlot } = req.params;

    // Query class_assignments table joined with attendance to get date
    const stmt = db.prepare(`
      SELECT DISTINCT ca.substitute_teacher_name
      FROM class_assignments ca
      INNER JOIN attendance a ON ca.attendance_id = a.id
      WHERE a.date = ? AND ca.class_slot = ? AND ca.substitute_teacher_id IS NOT NULL
    `);

    const assignments = stmt.all(date, timeSlot);

    // Extract and normalize teacher names
    const substituteTeachers = assignments
      .map(a => a.substitute_teacher_name)
      .filter(name => name) // Remove nulls
      .map(name => {
        // Extract nickname from "[Nickname] Full Name" format
        const nicknameMatch = name.match(/\[([^\]]+)\]/);
        return nicknameMatch ? nicknameMatch[1].trim().toLowerCase() : name.trim().toLowerCase();
      });

    console.log(`[Substitute Assignments] Date: ${date}, Slot: ${timeSlot}`);
    console.log(`[Substitute Assignments] Already assigned: ${substituteTeachers.join(', ')}`);

    res.json({
      success: true,
      substituteTeachers,
      date,
      timeSlot
    });
  } catch (error) {
    console.error('Error fetching substitute assignments:', error);
    res.json({
      success: true,
      substituteTeachers: [],
      error: error.message
    });
  }
});

// Get students assigned to a specific teacher at a specific time slot from scheduling app
app.get('/api/teacher-students/:date/:timeSlot/:teacherName', async (req, res) => {
  try {
    const { date, timeSlot, teacherName } = req.params;

    // Query the scheduling app API
    const schedulingAppUrl = `http://localhost:5555/api/assignments?date=${date}`;
    const response = await fetch(schedulingAppUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch schedule data');
    }

    const scheduleData = await response.json();

    // Map time slots from attendance checker (2-hour blocks) to scheduling app (1-hour slot IDs)
    const timeSlotMapping = {
      '8am - 10am': [1, 2],
      '10am - 12pm': [3, 4],
      '1pm - 3pm': [5, 6],
      '3pm - 5pm': [7, 8],
      '5pm - 7pm': [9, 10],
      '7pm - 9pm': [11, 12]
    };

    const relevantSlotIds = timeSlotMapping[timeSlot] || [];

    // Extract teacher nickname from "[Nickname] Full Name" format
    const nicknameMatch = decodeURIComponent(teacherName).match(/\[([^\]]+)\]/);
    const nickname = nicknameMatch ? nicknameMatch[1].trim().toLowerCase() : decodeURIComponent(teacherName).trim().toLowerCase();

    // Find students assigned to this teacher at this time slot
    const students = [];
    const assignments = Array.isArray(scheduleData) ? scheduleData : scheduleData.assignments || [];

    assignments.forEach(assignment => {
      const slotId = assignment.time_slot_id;
      if (relevantSlotIds.includes(slotId)) {
        // Check if this assignment has the teacher
        if (assignment.teachers) {
          const hasTeacher = assignment.teachers.some(teacher =>
            teacher.name && teacher.name.trim().toLowerCase() === nickname
          );

          if (hasTeacher && assignment.students) {
            // Add all students from this assignment
            assignment.students.forEach(student => {
              // Avoid duplicates
              if (!students.some(s => s.id === student.id)) {
                students.push({
                  id: student.id,
                  name: student.name
                });
              }
            });
          }
        }
      }
    });

    console.log(`[Teacher Students] Date: ${date}, Slot: ${timeSlot}, Teacher: ${nickname}`);
    console.log(`[Teacher Students] Found ${students.length} students`);

    res.json({
      success: true,
      students,
      date,
      timeSlot,
      teacherName: nickname
    });
  } catch (error) {
    console.error('Error fetching teacher students:', error);
    res.json({
      success: true,
      students: [],
      error: error.message
    });
  }
});

// Get teacher schedule availability from scheduling app
app.get('/api/teacher-schedule/:date/:timeSlot', async (req, res) => {
  try {
    const { date, timeSlot } = req.params;

    // Query the scheduling app API
    const schedulingAppUrl = `http://localhost:5555/api/assignments?date=${date}`;
    const response = await fetch(schedulingAppUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch schedule data');
    }

    const scheduleData = await response.json();

    // Map time slots from attendance checker (2-hour blocks) to scheduling app (1-hour slot IDs)
    const timeSlotMapping = {
      '8am - 10am': [1, 2],    // 8AM to 9AM, 9AM to 10AM
      '10am - 12pm': [3, 4],   // 10AM to 11AM, 11AM to 12PM
      '1pm - 3pm': [5, 6],     // 1PM to 2PM, 2PM to 3PM
      '3pm - 5pm': [7, 8],     // 3PM to 4PM, 4PM to 5PM
      '5pm - 7pm': [9, 10],    // 5PM to 6PM, 6PM to 7PM
      '7pm - 9pm': [11, 12]    // 7PM to 8PM, 8PM to 9PM
    };

    const relevantSlotIds = timeSlotMapping[timeSlot] || [];

    // Extract teacher names who are assigned to classes during this time slot
    const busyTeacherNames = new Set();

    // scheduleData is an array of assignments
    const assignments = Array.isArray(scheduleData) ? scheduleData : scheduleData.assignments || [];

    // Process each assignment and check student absences
    for (const assignment of assignments) {
      const slotId = assignment.time_slot_id;
      if (relevantSlotIds.includes(slotId)) {
        // Get student names from this assignment
        const studentNames = assignment.students ? assignment.students.map(s => s.name) : [];

        // Check if ALL students are absent - if so, teacher is FREE
        const allStudentsAbsent = studentNames.length > 0 ? await areAllStudentsAbsent(studentNames, date) : false;

        if (allStudentsAbsent) {
          console.log(`[Teacher Schedule] All students absent for assignment, teachers are FREE`);
          // Don't add these teachers to busy list
        } else {
          // Add all teachers assigned to this slot (match by name)
          if (assignment.teachers) {
            assignment.teachers.forEach(teacher => {
              if (teacher.name) {
                // Normalize teacher name for matching
                busyTeacherNames.add(teacher.name.trim().toLowerCase());
              }
            });
          }
        }
      }
    }

    console.log(`[Teacher Schedule] Date: ${date}, Slot: ${timeSlot}`);
    console.log(`[Teacher Schedule] Relevant slot IDs: ${relevantSlotIds}`);
    console.log(`[Teacher Schedule] Total assignments: ${assignments.length}`);
    console.log(`[Teacher Schedule] Busy teachers: ${Array.from(busyTeacherNames).join(', ')}`);

    res.json({
      success: true,
      busyTeacherNames: Array.from(busyTeacherNames),
      date,
      timeSlot
    });
  } catch (error) {
    console.error('Error fetching teacher schedule:', error);
    // Return empty array on error to avoid breaking the UI
    res.json({
      success: true,
      busyTeacherNames: [],
      error: error.message
    });
  }
});

// AI Auto-fill substitute endpoint
app.post('/api/ai-auto-fill-substitute', async (req, res) => {
  try {
    const { date, teacherId, teacherName, classSlots, availableTeachers } = req.body;

    console.log(`[AI Auto-fill] Processing for teacher: ${teacherName}, date: ${date}`);

    const recommendations = [];

    for (const slot of classSlots) {
      console.log(`[AI Auto-fill] Analyzing slot: ${slot.label}`);

      // Get students scheduled with this teacher for this slot
      const scheduledStudents = await getScheduledStudentsForSlot(date, slot.label, teacherName);

      // Score each available teacher
      const scoredTeachers = [];

      for (const teacher of availableTeachers) {
        let score = 0;
        const breakdown = {
          historyScore: 0,
          studentFamiliarityScore: 0,
          fairnessScore: 0
        };

        // 50% - Has subbed for this teacher before
        const subHistory = getSubstituteHistory(teacherId, teacher.id, slot.label);
        breakdown.historyScore = subHistory * 0.5;

        // 40% - Has taught these students before
        const studentFamiliarity = await getStudentFamiliarityScore(teacher.name, scheduledStudents);
        breakdown.studentFamiliarityScore = studentFamiliarity * 0.4;

        // 10% - Lowest substitute count (fairness)
        const fairnessScore = getFairnessScore(teacher.id, date);
        breakdown.fairnessScore = fairnessScore * 0.1;

        score = breakdown.historyScore + breakdown.studentFamiliarityScore + breakdown.fairnessScore;

        scoredTeachers.push({
          teacher,
          score,
          breakdown
        });
      }

      // Sort by score (highest first)
      scoredTeachers.sort((a, b) => b.score - a.score);

      const bestMatch = scoredTeachers[0];

      recommendations.push({
        classSlot: slot.label,
        substituteTeacherId: bestMatch?.teacher.id || null,
        substituteTeacherName: bestMatch?.teacher.name || null,
        students: scheduledStudents,
        score: bestMatch?.score || 0,
        breakdown: bestMatch?.breakdown || null,
        allScores: scoredTeachers.slice(0, 3) // Top 3 for debugging
      });
    }

    console.log(`[AI Auto-fill] Recommendations:`, recommendations);

    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('Error in AI auto-fill:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper: Get scheduled students for a specific slot
async function getScheduledStudentsForSlot(date, timeSlot, teacherName) {
  try {
    const timeSlotMapping = {
      '8am - 10am': [1, 2],
      '10am - 12pm': [3, 4],
      '1pm - 3pm': [5, 6],
      '3pm - 5pm': [7, 8],
      '5pm - 7pm': [9, 10],
      '7pm - 9pm': [11, 12]
    };

    const relevantSlotIds = timeSlotMapping[timeSlot] || [];
    const students = [];

    const response = await fetch(`http://localhost:5555/api/schedule/${date}`);
    const scheduleData = await response.json();
    const assignments = Array.isArray(scheduleData) ? scheduleData : scheduleData.assignments || [];

    assignments.forEach(assignment => {
      const slotId = assignment.time_slot_id;
      if (relevantSlotIds.includes(slotId)) {
        if (assignment.teachers) {
          const hasTeacher = assignment.teachers.some(t =>
            t.name && t.name.trim().toLowerCase() === teacherName.trim().toLowerCase()
          );

          if (hasTeacher && assignment.students) {
            assignment.students.forEach(student => {
              if (!students.some(s => s.id === student.id)) {
                students.push({ id: student.id, name: student.name });
              }
            });
          }
        }
      }
    });

    return students;
  } catch (error) {
    console.error('Error getting scheduled students:', error);
    return [];
  }
}

// Helper: Get substitute history score (0-1)
function getSubstituteHistory(absentTeacherId, substituteTeacherId, timeSlot) {
  try {
    // Query attendance database for past substitute assignments
    const query = `
      SELECT COUNT(*) as count
      FROM attendance a
      JOIN class_assignments ca ON a.id = ca.attendance_id
      WHERE a.teacher_id = ?
      AND ca.substitute_teacher_id = ?
      AND ca.class_slot = ?
    `;

    const result = db.prepare(query).get(absentTeacherId, substituteTeacherId, timeSlot);
    const count = result?.count || 0;

    // Normalize: 0 times = 0, 1 time = 0.5, 2+ times = 1.0
    if (count === 0) return 0;
    if (count === 1) return 0.5;
    return 1.0;
  } catch (error) {
    console.error('Error getting substitute history:', error);
    return 0;
  }
}

// Helper: Get student familiarity score (0-1)
async function getStudentFamiliarityScore(teacherName, students) {
  if (students.length === 0) return 0;

  try {
    // Query scheduling app to see how many of these students this teacher has taught
    const studentIds = students.map(s => s.id);
    let familiarStudentCount = 0;

    // Get historical schedule data (last 30 days)
    const today = new Date();
    const endDate = getTodayDate();
    const startDateObj = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const startDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;

    const response = await fetch(`http://localhost:5555/api/schedule-range?start=${startDate}&end=${endDate}`);
    const scheduleData = await response.json();
    const assignments = Array.isArray(scheduleData) ? scheduleData : scheduleData.assignments || [];

    for (const student of students) {
      const hasTaughtBefore = assignments.some(assignment => {
        const hasTeacher = assignment.teachers?.some(t =>
          t.name && t.name.trim().toLowerCase() === teacherName.trim().toLowerCase()
        );
        const hasStudent = assignment.students?.some(s =>
          s.name && s.name.trim().toLowerCase() === student.name.trim().toLowerCase()
        );
        return hasTeacher && hasStudent;
      });

      if (hasTaughtBefore) {
        familiarStudentCount++;
      }
    }

    // Return ratio of familiar students
    return familiarStudentCount / students.length;
  } catch (error) {
    console.error('Error getting student familiarity:', error);
    return 0;
  }
}

// Helper: Get fairness score (0-1) - lower sub count = higher score
function getFairnessScore(teacherId, currentDate) {
  try {
    // Count how many times this teacher has been a substitute in the current month
    const year = currentDate.split('-')[0];
    const month = currentDate.split('-')[1];
    const monthStart = `${year}-${month}-01`;

    const query = `
      SELECT COUNT(DISTINCT ca.id) as count
      FROM class_assignments ca
      JOIN attendance a ON ca.attendance_id = a.id
      WHERE ca.substitute_teacher_id = ?
      AND a.date >= ?
      AND a.date <= ?
    `;

    const result = db.prepare(query).get(teacherId, monthStart, currentDate);
    const count = result?.count || 0;

    // Normalize: 0 times = 1.0, 1 time = 0.75, 2 times = 0.5, 3+ times = 0.25
    if (count === 0) return 1.0;
    if (count === 1) return 0.75;
    if (count === 2) return 0.5;
    return 0.25;
  } catch (error) {
    console.error('Error getting fairness score:', error);
    return 0.5; // Default middle score
  }
}

// Helper: Check if all students in a class are absent (not just late)
async function areAllStudentsAbsent(studentNames, date) {
  try {
    // Query student attendance tracker
    const response = await fetch(`http://localhost:3002/api/attendance/${date}`);
    const data = await response.json();

    if (!data.success || !data.attendance) {
      return false; // If can't check, assume students are present
    }

    // Only count students marked as ABSENT (not late, not present)
    const absentStudents = data.attendance
      .filter(att => att.status === 'absent') // Only absent, NOT late
      .map(att => att.student_name.trim().toLowerCase());

    // Check if ALL students in the class are fully absent
    const allAbsent = studentNames.every(name =>
      absentStudents.includes(name.trim().toLowerCase())
    );

    // Log details for debugging
    const studentStatuses = studentNames.map(name => {
      const attendance = data.attendance.find(att =>
        att.student_name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      return `${name}: ${attendance?.status || 'unmarked'}`;
    });

    console.log(`[Student Absence Check] ${studentStatuses.join(', ')} → All absent: ${allAbsent}`);
    return allAbsent;
  } catch (error) {
    console.error('Error checking student absences:', error);
    return false; // If error, assume students are present (teacher is busy)
  }
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Attendance Checker running on http://localhost:${PORT}`);
  console.log(`Server is accessible from other devices on your network`);
  console.log(`Connected to Notion database: ${DATABASE_ID}`);
});
