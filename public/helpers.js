// Helper functions for attendance app

// Convert time string like "8am" to hour number
function timeStringToHour(timeStr) {
  if (!timeStr) return null;

  const match = timeStr.match(/(\d+)(am|pm)/i);
  if (!match) return null;

  let hour = parseInt(match[1]);
  const period = match[2].toLowerCase();

  if (period === 'pm' && hour !== 12) {
    hour += 12;
  } else if (period === 'am' && hour === 12) {
    hour = 0;
  }

  return hour;
}

// Calculate class slots based on start and end time
// Class slots: 8-10, 10-12, 1-3, 3-5, 5-7, 7-9
function calculateClassSlots(startTime, endTime) {
  const startHour = timeStringToHour(startTime);
  const endHour = timeStringToHour(endTime);

  if (startHour === null || endHour === null) return [];

  const classSlots = [
    { label: '8am - 10am', start: 8, end: 10 },
    { label: '10am - 12pm', start: 10, end: 12 },
    { label: '1pm - 3pm', start: 13, end: 15 },
    { label: '3pm - 5pm', start: 15, end: 17 },
    { label: '5pm - 7pm', start: 17, end: 19 },
    { label: '7pm - 9pm', start: 19, end: 21 }
  ];

  // Filter slots that fall within the teacher's shift
  return classSlots.filter(slot => {
    return slot.start >= startHour && slot.end <= endHour;
  });
}

// Get class slot details by label (for checking teacher availability)
function getClassSlotByLabel(slotLabel) {
  const allSlots = [
    { label: '8am - 10am', start: 8, end: 10 },
    { label: '10am - 12pm', start: 10, end: 12 },
    { label: '1pm - 3pm', start: 13, end: 15 },
    { label: '3pm - 5pm', start: 15, end: 17 },
    { label: '5pm - 7pm', start: 17, end: 19 },
    { label: '7pm - 9pm', start: 19, end: 21 }
  ];

  return allSlots.find(slot => slot.label === slotLabel);
}

// Check if a teacher's shift covers a specific time slot
function isTeacherAvailableForSlot(teacher, slotLabel) {
  const slot = getClassSlotByLabel(slotLabel);
  if (!slot) return false;

  const teacherStartHour = timeStringToHour(teacher.startTime);
  const teacherEndHour = timeStringToHour(teacher.endTime);

  if (teacherStartHour === null || teacherEndHour === null) return false;

  // Teacher is available if their shift completely covers the slot
  return teacherStartHour <= slot.start && teacherEndHour >= slot.end;
}

// Check if a late teacher will be available for a specific time slot
// Late teachers can cover slots that start after their expected arrival time
function isLateTeacherAvailableForSlot(teacher, slotLabel, attendanceData) {
  const attendance = attendanceData[teacher.id];

  // If not late, use regular availability check
  if (!attendance || attendance.status !== 'late') {
    return isTeacherAvailableForSlot(teacher, slotLabel);
  }

  const slot = getClassSlotByLabel(slotLabel);
  if (!slot) return false;

  const teacherStartHour = timeStringToHour(teacher.startTime);
  const teacherEndHour = timeStringToHour(teacher.endTime);

  if (teacherStartHour === null || teacherEndHour === null) return false;

  // Calculate expected arrival time (shift start + minutes late)
  const minutesLate = attendance.minutes_late || 0;
  const expectedArrivalHour = teacherStartHour + (minutesLate / 60);

  // Teacher can cover this slot if:
  // 1. They will arrive before or at the start of the slot
  // 2. Their shift end time covers the slot end
  const willArriveInTime = expectedArrivalHour <= slot.start;
  const shiftCoversEnd = teacherEndHour >= slot.end;

  return willArriveInTime && shiftCoversEnd;
}

// Calculate which class slots a late teacher will miss (need substitute for)
function getSlotsNeedingSubstitute(teacher, minutesLate) {
  const teacherStartHour = timeStringToHour(teacher.startTime);
  if (teacherStartHour === null || minutesLate === null || minutesLate === 0) {
    return []; // No slots need substitute if not late
  }

  const expectedArrivalHour = teacherStartHour + (minutesLate / 60);

  const allSlots = [
    { label: '8am - 10am', start: 8, end: 10 },
    { label: '10am - 12pm', start: 10, end: 12 },
    { label: '1pm - 3pm', start: 13, end: 15 },
    { label: '3pm - 5pm', start: 15, end: 17 },
    { label: '5pm - 7pm', start: 17, end: 19 },
    { label: '7pm - 9pm', start: 19, end: 21 }
  ];

  // Teacher will miss slots where they arrive after the slot has started
  return allSlots.filter(slot => {
    // Will miss this slot if they arrive after it starts
    return expectedArrivalHour > slot.start;
  }).map(slot => slot.label);
}

// Calculate which class slots a teacher who left early will miss (need substitute for)
function getSlotsNeedingSubstituteForUndertime(teacher, minutesEarly) {
  const teacherEndHour = timeStringToHour(teacher.endTime);
  if (teacherEndHour === null || minutesEarly === null || minutesEarly === 0) {
    return []; // No slots need substitute if didn't leave early
  }

  const actualDepartureHour = teacherEndHour - (minutesEarly / 60);

  const allSlots = [
    { label: '8am - 10am', start: 8, end: 10 },
    { label: '10am - 12pm', start: 10, end: 12 },
    { label: '1pm - 3pm', start: 13, end: 15 },
    { label: '3pm - 5pm', start: 15, end: 17 },
    { label: '5pm - 7pm', start: 17, end: 19 },
    { label: '7pm - 9pm', start: 19, end: 21 }
  ];

  // Teacher will miss slots where they left before the slot ends
  return allSlots.filter(slot => {
    // Will miss this slot if they left before it ends
    return actualDepartureHour < slot.end;
  }).map(slot => slot.label);
}

// Get teachers who are already scheduled for a specific time slot
async function getBusyTeachers(date, slotLabel) {
  try {
    console.log(`[getBusyTeachers] Fetching for date: ${date}, slot: ${slotLabel}`);
    const response = await fetch(`${API_URL}/teacher-schedule/${date}/${slotLabel}`);
    const data = await response.json();

    console.log(`[getBusyTeachers] Response:`, data);

    if (data.success) {
      console.log(`[getBusyTeachers] Busy teachers: ${data.busyTeacherNames.join(', ')}`);
      return data.busyTeacherNames || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching busy teachers:', error);
    return [];
  }
}

// Get teachers already assigned as substitutes for a specific time slot
async function getAssignedSubstitutes(date, slotLabel) {
  try {
    console.log(`[getAssignedSubstitutes] Fetching for date: ${date}, slot: ${slotLabel}`);
    const response = await fetch(`${API_URL}/substitute-assignments/${date}/${slotLabel}`);
    const data = await response.json();

    console.log(`[getAssignedSubstitutes] Response:`, data);

    if (data.success) {
      console.log(`[getAssignedSubstitutes] Already assigned substitutes: ${data.substituteTeachers.join(', ')}`);
      return data.substituteTeachers || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching assigned substitutes:', error);
    return [];
  }
}

// Get students scheduled with a specific teacher at a specific time slot
async function getScheduledStudents(date, slotLabel, teacherName) {
  try {
    console.log(`[getScheduledStudents] Fetching for date: ${date}, slot: ${slotLabel}, teacher: ${teacherName}`);
    const encodedTeacherName = encodeURIComponent(teacherName);
    const response = await fetch(`${API_URL}/teacher-students/${date}/${slotLabel}/${encodedTeacherName}`);
    const data = await response.json();

    console.log(`[getScheduledStudents] Response:`, data);

    if (data.success) {
      console.log(`[getScheduledStudents] Found ${data.students.length} students`);
      return data.students || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching scheduled students:', error);
    return [];
  }
}

// Check if teacher is not busy with scheduled classes or substitute assignments
function isTeacherNotBusy(teacher, busyTeacherNames, assignedSubstitutes = []) {
  // Extract nickname from format "[Nickname] Full Name"
  const nicknameMatch = teacher.name.match(/\[([^\]]+)\]/);
  const nickname = nicknameMatch ? nicknameMatch[1].trim().toLowerCase() : teacher.name.trim().toLowerCase();

  // Check if busy with scheduled class
  if (busyTeacherNames && busyTeacherNames.length > 0) {
    const isBusyWithClass = busyTeacherNames.includes(nickname);
    if (isBusyWithClass) {
      console.log(`[isTeacherNotBusy] ${teacher.name} is BUSY with scheduled class (nickname: ${nickname})`);
      return false;
    }
  }

  // Check if already assigned as substitute
  if (assignedSubstitutes && assignedSubstitutes.length > 0) {
    const isAlreadySubstitute = assignedSubstitutes.includes(nickname);
    if (isAlreadySubstitute) {
      console.log(`[isTeacherNotBusy] ${teacher.name} is already assigned as SUBSTITUTE (nickname: ${nickname})`);
      return false;
    }
  }

  return true;
}

// Late reasons
const LATE_REASONS = [
  'Didn\'t disclose',
  'Traffic/Transportation delay',
  'Medical appointment',
  'Government appointment',
  'Family emergency',
  'Personal matter',
  'Overslept',
  'Public transportation issue',
  'Weather conditions',
  'Vehicle problem',
  'Childcare issue',
  'Previous appointment ran late',
  'Other (specify)'
];

// Absent reasons
const ABSENT_REASONS = [
  'Didn\'t disclose',
  'AWOL',
  'Sick/Medical',
  'Official vacation leave',
  'Official sick leave',
  'Government appointment',
  'Family emergency',
  'Personal emergency',
  'Bereavement',
  'Medical appointment',
  'Personal day',
  'Family matter',
  'Transportation issue',
  'Weather/Natural disaster',
  'Other (specify)'
];

// Undertime/Left Early reasons
const UNDERTIME_REASONS = [
  'Personal emergency',
  'Family emergency',
  'Medical appointment',
  'Feeling unwell',
  'Transportation issue',
  'Personal matter',
  'Family matter',
  'Scheduled appointment',
  'Government appointment',
  'Other (specify)'
];
