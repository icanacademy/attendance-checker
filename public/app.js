// Use dynamic API URL so it works from other computers on the network, ngrok, and Cloudflare
const isProxied = window.location.hostname.includes('ngrok') || window.location.hostname.includes('icanacademy.work');
const API_URL = isProxied
  ? `${window.location.protocol}//${window.location.hostname}/api`
  : `${window.location.protocol}//${window.location.hostname}:3001/api`;

let teachers = [];
let attendanceData = {};
let selectedDate = null;
let fullDailyReportData = null;
let currentReportDate = null;
let datesWithData = [];
let flatpickrInstance = null;

// Helper function to get local date in YYYY-MM-DD format (timezone-safe)
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to get the selected date (used by modal-handler.js)
function getSelectedDate() {
  return selectedDate;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  initializeDateDisplays();
  initializeTabs();
  initializeEventListeners();
  initializeModals();
  await fetchDatesWithData();
  initializeDateNavigation();
});

// Fetch all dates that have attendance data
async function fetchDatesWithData() {
  try {
    const response = await fetch(`${API_URL}/attendance-dates`);
    const data = await response.json();
    if (data.success) {
      datesWithData = data.dates;
      console.log('📅 Dates with attendance data:', datesWithData);
    }
  } catch (error) {
    console.error('Error fetching dates with data:', error);
    datesWithData = [];
  }
}

// Refresh the calendar to update date indicators
async function refreshCalendarDates() {
  await fetchDatesWithData();
  if (flatpickrInstance) {
    // Destroy and recreate the instance to properly refresh dots
    const currentDate = selectedDate;
    flatpickrInstance.destroy();

    flatpickrInstance = flatpickr('#selectedDate', {
      defaultDate: currentDate,
      dateFormat: 'Y-m-d',
      onDayCreate: function(dObj, dStr, fp, dayElem) {
        // Fix timezone issue - use local date formatting instead of UTC
        const date = dayElem.dateObj;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (datesWithData.includes(dateStr)) {
          // Add a dot indicator to dates with data
          dayElem.innerHTML += '<span class="flatpickr-day-dot"></span>';
          console.log('✅ Adding dot to:', dateStr);
        }
      },
      onChange: function(selectedDates, dateStr, instance) {
        selectedDate = dateStr;
        updateDateContext();
        checkAndLoadExistingData();
        syncReportDate();
      }
    });
  }
}

// Initialize date displays
function initializeDateDisplays() {
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  document.getElementById('currentDate').textContent = dateString;
  document.getElementById('footerYear').textContent = today.getFullYear();

  // Set default dates for reports (using local timezone)
  const todayISO = getLocalDateString(today);
  document.getElementById('reportDate').value = todayISO;
  document.getElementById('overviewEndDate').value = todayISO;

  // Set start date to 7 days ago
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  document.getElementById('overviewStartDate').value = getLocalDateString(weekAgo);
}

// Initialize tabs
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Remove active class from all
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked
      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Auto-load daily report when switching to reports tab
      if (tabName === 'reports' && selectedDate) {
        const reportDate = document.getElementById('reportDate');
        if (reportDate && reportDate.value === selectedDate) {
          // Silently refresh the report if it's for the same date
          refreshDailyReportSilently();
        }
      }
    });
  });
}

// Initialize date navigation
function initializeDateNavigation() {
  const today = new Date();
  const todayISO = getLocalDateString(today);

  // Set default date to today
  selectedDate = todayISO;

  // Initialize Flatpickr
  flatpickrInstance = flatpickr('#selectedDate', {
    defaultDate: todayISO,
    dateFormat: 'Y-m-d',
    onDayCreate: function(dObj, dStr, fp, dayElem) {
      // Fix timezone issue - use local date formatting instead of UTC
      const date = dayElem.dateObj;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      if (datesWithData.includes(dateStr)) {
        // Add a dot indicator to dates with data
        dayElem.innerHTML += '<span class="flatpickr-day-dot"></span>';
        console.log('✅ Adding dot to:', dateStr);
      }
    },
    onChange: function(selectedDates, dateStr, instance) {
      selectedDate = dateStr;
      updateDateContext();
      checkAndLoadExistingData();
      syncReportDate();
    }
  });

  // Update date context and try to load existing data
  updateDateContext();
  checkAndLoadExistingData();
  syncReportDate();

  // Add event listeners for prev/next buttons
  document.getElementById('prevDayBtn').addEventListener('click', () => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() - 1);
    const newDate = getLocalDateString(current);
    flatpickrInstance.setDate(newDate);
    selectedDate = newDate;
    updateDateContext();
    checkAndLoadExistingData();
    syncReportDate();
  });

  document.getElementById('nextDayBtn').addEventListener('click', () => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + 1);
    const newDate = getLocalDateString(current);
    flatpickrInstance.setDate(newDate);
    selectedDate = newDate;
    updateDateContext();
    checkAndLoadExistingData();
    syncReportDate();
  });
}

// Check if attendance data exists for the selected date and load it
async function checkAndLoadExistingData() {
  const teachersList = document.getElementById('teachersList');

  try {
    const response = await fetch(`${API_URL}/attendance/${selectedDate}`);
    const data = await response.json();

    if (data.success && data.attendance && data.attendance.length > 0) {
      // Data exists - load teachers and populate with existing attendance
      teachersList.innerHTML = '<div class="loading">Loading saved attendance data...</div>';
      await loadTeachersWithExistingData(data.attendance);
    } else {
      // No data exists, show import message
      teachersList.innerHTML = '<div class="info-text">No attendance data for this date. Click "Import from Notion" to load teachers.</div>';
      teachers = [];
      attendanceData = {};
    }
  } catch (error) {
    console.error('Error checking existing data:', error);
    teachersList.innerHTML = '<div class="info-text">Click "Import from Notion" to load teachers for this date</div>';
    teachers = [];
    attendanceData = {};
  }
}

// Load teachers with existing attendance data
async function loadTeachersWithExistingData(existingAttendance) {
  const teachersList = document.getElementById('teachersList');

  try {
    // Fetch teachers from Notion
    const response = await fetch(`${API_URL}/teachers`);
    const data = await response.json();

    if (data.success) {
      teachers = data.teachers;
      attendanceData = {};

      // Load the existing attendance data with all details
      existingAttendance.forEach(record => {
        console.log('Loading existing attendance:', {
          teacher: record.teacher_name,
          status: record.status,
          has_undertime: record.has_undertime,
          undertime_reason: record.undertime_reason
        });
        attendanceData[record.teacher_id] = {
          teacherId: record.teacher_id,
          teacherName: record.teacher_name,
          startTime: record.start_time,
          endTime: record.end_time,
          status: record.status,
          lateReason: record.late_reason || null,
          absentReason: record.absent_reason || null,
          minutesLate: record.minutes_late || null,
          has_undertime: record.has_undertime || 0,
          undertime_minutes: record.undertime_minutes || null,
          undertime_reason: record.undertime_reason || null,
          classAssignments: record.classAssignments || [],
          is_active: record.is_active,
          officialLeaveType: record.official_leave_type
        };
      });

      renderTeachersList();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error loading teachers with existing data:', error);
    teachersList.innerHTML = `<div class="error-message">Error loading teachers: ${error.message}</div>`;
  }
}

// Update date context message
function updateDateContext() {
  const dateContextEl = document.getElementById('dateContext');
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateString = selectedDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (selectedDateObj.getTime() === today.getTime()) {
    dateContextEl.textContent = `Viewing Today's Attendance (${dateString})`;
  } else if (selectedDateObj < today) {
    dateContextEl.textContent = `Viewing Past Attendance (${dateString})`;
  } else {
    dateContextEl.textContent = `Viewing Future Date (${dateString})`;
  }
}

// Sync report date with selected attendance date
function syncReportDate() {
  if (selectedDate) {
    document.getElementById('reportDate').value = selectedDate;
  }
}

// Initialize event listeners
function initializeEventListeners() {
  document.getElementById('loadTeachersBtn').addEventListener('click', loadTeachers);
  document.getElementById('clearDataBtn').addEventListener('click', clearData);
  document.getElementById('submitAttendanceBtn').addEventListener('click', submitAttendance);
  document.getElementById('loadDailyReportBtn').addEventListener('click', loadDailyReport);
  document.getElementById('loadOverviewBtn').addEventListener('click', loadOverview);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
  document.getElementById('downloadReportBtn').addEventListener('click', downloadDailyReportAsImage);
  document.getElementById('downloadAnalyticsBtn').addEventListener('click', downloadAnalytics);

  // Status filter checkboxes
  document.getElementById('filterAll').addEventListener('change', handleFilterAllChange);
  document.getElementById('filterPresent').addEventListener('change', handleStatusFilterChange);
  document.getElementById('filterLate').addEventListener('change', handleStatusFilterChange);
  document.getElementById('filterAbsent').addEventListener('change', handleStatusFilterChange);

  // Shift filter checkboxes
  document.getElementById('filterAllShifts').addEventListener('change', handleFilterAllShiftsChange);
  document.getElementById('filterShift8am').addEventListener('change', handleShiftFilterChange);
  document.getElementById('filterShift10am').addEventListener('change', handleShiftFilterChange);
  document.getElementById('filterShift1pm').addEventListener('change', handleShiftFilterChange);
  document.getElementById('filterShift3pm').addEventListener('change', handleShiftFilterChange);
  document.getElementById('filterShift5pm').addEventListener('change', handleShiftFilterChange);
  document.getElementById('filterShift7pm').addEventListener('change', handleShiftFilterChange);

  // Individual Records tab
  document.getElementById('loadIndividualRecordsBtn').addEventListener('click', loadIndividualRecords);
  document.getElementById('downloadIndividualRecordsBtn').addEventListener('click', downloadIndividualRecordsAsImage);

  // Load teachers for dropdown when switching to Individual tab
  document.querySelector('[data-tab="individual"]').addEventListener('click', loadTeachersForDropdown);
}

// Load teachers from Notion
async function loadTeachers() {
  if (!selectedDate) {
    alert('Please select a date first');
    return;
  }

  const teachersList = document.getElementById('teachersList');

  try {
    // First, check if attendance data already exists for this date
    const checkResponse = await fetch(`${API_URL}/attendance/${selectedDate}`);
    const checkData = await checkResponse.json();

    if (checkData.success && checkData.attendance && checkData.attendance.length > 0) {
      // Data exists - show warning
      const existingCount = checkData.attendance.length;
      const confirmMessage = `⚠️ WARNING: Attendance data already exists for this date!\n\n` +
        `Found ${existingCount} existing attendance record(s) for ${selectedDate}.\n\n` +
        `Importing from Notion will DELETE all existing attendance data for this date, including:\n` +
        `• All attendance records (Present/Late/Absent)\n` +
        `• All late/absent reasons\n` +
        `• All class assignments and substitute coverage\n\n` +
        `This action CANNOT be undone.\n\n` +
        `Do you want to continue and DELETE the existing data?`;

      const userConfirmed = confirm(confirmMessage);

      if (!userConfirmed) {
        // User cancelled - don't proceed
        teachersList.innerHTML = '<div class="info-text">Import cancelled. Existing data preserved.</div>';
        return;
      }

      // User confirmed - delete existing data
      teachersList.innerHTML = '<div class="loading">Deleting existing data...</div>';

      const deleteResponse = await fetch(`${API_URL}/attendance/${selectedDate}`, {
        method: 'DELETE'
      });

      const deleteData = await deleteResponse.json();

      if (!deleteData.success) {
        throw new Error('Failed to delete existing data: ' + deleteData.error);
      }

      console.log(`Deleted ${deleteData.deletedCount} existing record(s)`);
    }

    // Proceed with loading teachers from Notion
    teachersList.innerHTML = '<div class="loading">Loading teachers from Notion...</div>';

    const response = await fetch(`${API_URL}/teachers`);
    const data = await response.json();

    if (data.success) {
      teachers = data.teachers;
      attendanceData = {};
      // Don't load existing attendance - start with a blank slate
      renderTeachersList();

      // Refresh calendar date indicators (in case we deleted data)
      refreshCalendarDates();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error loading teachers:', error);
    teachersList.innerHTML = `<div class="error-message">Error loading teachers: ${error.message}</div>`;
  }
}

// Clear all data for the current date (both UI and database)
async function clearData() {
  if (!selectedDate) {
    alert('Please select a date first');
    return;
  }

  if (teachers.length === 0) {
    alert('No teachers loaded. Please import from Notion first.');
    return;
  }

  // First check if there's any saved data for this date
  try {
    const checkResponse = await fetch(`${API_URL}/attendance/${selectedDate}`);
    const checkData = await checkResponse.json();

    const hasSavedData = checkData.success && checkData.attendance && checkData.attendance.length > 0;
    const savedCount = hasSavedData ? checkData.attendance.length : 0;

    let confirmMessage;
    if (hasSavedData) {
      confirmMessage = `⚠️ WARNING: This will permanently delete all attendance data for ${selectedDate}!\n\n` +
        `Found ${savedCount} saved attendance record(s) including:\n` +
        `• All attendance records (Present/Late/Absent)\n` +
        `• All late/absent reasons\n` +
        `• All class assignments and substitute coverage\n\n` +
        `This action CANNOT be undone.\n\n` +
        `Do you want to continue and DELETE all data for this date?`;
    } else {
      confirmMessage = `Are you sure you want to clear all checkmarks?\n\n` +
        `This will uncheck all boxes on the screen.\n` +
        `(No saved data found in the database for this date)`;
    }

    const confirmation = confirm(confirmMessage);

    if (!confirmation) {
      return;
    }

    // Delete from database if there's saved data
    if (hasSavedData) {
      const deleteResponse = await fetch(`${API_URL}/attendance/${selectedDate}`, {
        method: 'DELETE'
      });

      const deleteData = await deleteResponse.json();

      if (!deleteData.success) {
        throw new Error('Failed to delete data from database: ' + deleteData.error);
      }

      console.log(`Deleted ${deleteData.deletedCount} record(s) from database`);
    }

    // Clear the UI
    attendanceData = {};

    // Uncheck all checkboxes
    const allCheckboxes = document.querySelectorAll('.present-checkbox, .late-checkbox, .absent-checkbox');
    allCheckboxes.forEach(checkbox => {
      checkbox.checked = false;
    });

    // Clear all status indicators
    const allStatusElements = document.querySelectorAll('.save-status');
    allStatusElements.forEach(status => {
      status.textContent = '';
      status.className = 'save-status';
    });

    // Refresh calendar date indicators
    refreshCalendarDates();

    if (hasSavedData) {
      alert(`Successfully deleted ${savedCount} attendance record(s) for ${selectedDate}.\n\nTeachers list is still loaded. You can re-enter attendance if needed.`);
    } else {
      alert('All checkmarks cleared. Teachers list is still loaded.');
    }

  } catch (error) {
    console.error('Error clearing data:', error);
    alert(`Error clearing data: ${error.message}`);
  }
}

// Load attendance for a specific date
async function loadDateAttendance(date) {
  try {
    const response = await fetch(`${API_URL}/attendance/${date}`);
    const data = await response.json();

    if (data.success && data.attendance) {
      data.attendance.forEach(record => {
        console.log('Loading attendance record:', {
          teacher: record.teacher_name,
          status: record.status,
          has_undertime: record.has_undertime,
          undertime_reason: record.undertime_reason
        });
        attendanceData[record.teacher_id] = {
          teacherId: record.teacher_id,
          teacherName: record.teacher_name,
          startTime: record.start_time,
          endTime: record.end_time,
          status: record.status,
          lateReason: record.late_reason,
          absentReason: record.absent_reason,
          minutesLate: record.minutes_late,
          has_undertime: record.has_undertime,
          undertime_minutes: record.undertime_minutes,
          undertime_reason: record.undertime_reason,
          is_active: record.is_active,
          officialLeaveType: record.official_leave_type
        };
      });
    }
  } catch (error) {
    console.error('Error loading attendance for date:', error);
  }
}

// Render teachers list grouped by shift
function renderTeachersList() {
  const teachersList = document.getElementById('teachersList');

  if (teachers.length === 0) {
    teachersList.innerHTML = '<div class="info-text">No active teachers found.</div>';
    return;
  }

  // Group teachers by start time
  const shiftGroups = {};
  const shiftLabels = {
    '8am': '8am Shift',
    '10am': '10am Shift',
    '1pm': '1pm Shift',
    '3pm': '3pm Shift',
    '5pm': '5pm Shift',
    '7pm': '7pm Shift'
  };

  teachers.forEach(teacher => {
    const startTime = teacher.startTime || 'No Shift';
    if (!shiftGroups[startTime]) {
      shiftGroups[startTime] = [];
    }
    shiftGroups[startTime].push(teacher);
  });

  // Order shifts
  const orderedShifts = ['8am', '10am', '1pm', '3pm', '5pm', '7pm'];
  let html = '';

  orderedShifts.forEach(shift => {
    if (shiftGroups[shift] && shiftGroups[shift].length > 0) {
      html += `<div class="shift-section">
        <div class="shift-header">${shiftLabels[shift]}</div>
        <div class="shift-teachers">`;

      shiftGroups[shift].forEach(teacher => {
        const attendance = attendanceData[teacher.id];
        const isPresent = attendance?.status === 'present';
        const isLate = attendance?.status === 'late';
        const isAbsent = attendance?.status === 'absent';
        const hasUndertime = attendance?.has_undertime === 1;
        const isActive = attendance?.is_active !== 0; // Default to active if not set

        if (attendance && attendance.has_undertime) {
          console.log('Rendering teacher with undertime:', {
            teacher: teacher.name,
            has_undertime: attendance.has_undertime,
            hasUndertime,
            attendance
          });
        }

        html += `
        <div class="teacher-card ${!isActive ? 'deactivated' : ''}" id="card-${teacher.id}" data-teacher-id="${teacher.id}">
          <div class="teacher-info">
            <div class="teacher-name">${teacher.name}</div>
            <div class="teacher-time">
              ${teacher.startTime ? `Start: ${teacher.startTime}` : ''}
              ${teacher.endTime ? ` | End: ${teacher.endTime}` : ''}
            </div>
            <button class="toggle-active-btn"
                    data-teacher-id="${teacher.id}"
                    data-teacher-name="${teacher.name}"
                    data-start-time="${teacher.startTime}"
                    data-end-time="${teacher.endTime}"
                    data-is-active="${isActive}"
                    title="${isActive ? 'Mark as Not Applicable' : 'Mark as Active'}">
              ${isActive ? '🚫 NA' : '✓ Activate'}
            </button>
          </div>
          <div class="attendance-controls">
            <div class="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  class="present-checkbox"
                  data-teacher-id="${teacher.id}"
                  data-teacher-name="${teacher.name}"
                  data-start-time="${teacher.startTime}"
                  data-end-time="${teacher.endTime}"
                  data-status="present"
                  onchange="handleAttendanceChange(this)"
                  ${isPresent ? 'checked' : ''}
                />
                Present
              </label>
              <label>
                <input
                  type="checkbox"
                  class="late-checkbox"
                  data-teacher-id="${teacher.id}"
                  data-teacher-name="${teacher.name}"
                  data-start-time="${teacher.startTime}"
                  data-end-time="${teacher.endTime}"
                  data-status="late"
                  onchange="handleAttendanceChange(this)"
                  ${isLate ? 'checked' : ''}
                />
                Late
              </label>
              <label>
                <input
                  type="checkbox"
                  class="absent-checkbox"
                  data-teacher-id="${teacher.id}"
                  data-teacher-name="${teacher.name}"
                  data-start-time="${teacher.startTime}"
                  data-end-time="${teacher.endTime}"
                  data-status="absent"
                  onchange="handleAttendanceChange(this)"
                  ${isAbsent ? 'checked' : ''}
                />
                Absent
              </label>
            </div>
            <div class="checkbox-group" style="margin-top: 8px;">
              <label>
                <input
                  type="checkbox"
                  class="undertime-checkbox"
                  data-teacher-id="${teacher.id}"
                  data-teacher-name="${teacher.name}"
                  data-start-time="${teacher.startTime}"
                  data-end-time="${teacher.endTime}"
                  onchange="handleUndertimeChange(this)"
                  ${hasUndertime ? 'checked' : ''}
                  ${isAbsent || (!isPresent && !isLate) ? 'disabled' : ''}
                />
                Left Early/Undertime
              </label>
            </div>
            <span class="save-status" id="status-${teacher.id}"></span>
          </div>
        </div>`;
      });

      html += '</div></div>';
    }
  });

  // Add teachers with no shift or unrecognized shifts
  const otherTeachers = Object.keys(shiftGroups).filter(shift => !orderedShifts.includes(shift));
  if (otherTeachers.length > 0) {
    otherTeachers.forEach(shift => {
      html += `<div class="shift-section">
        <div class="shift-header">${shift}</div>
        <div class="shift-teachers">`;

      shiftGroups[shift].forEach(teacher => {
        const attendance = attendanceData[teacher.id];
        const isPresent = attendance?.status === 'present';
        const isLate = attendance?.status === 'late';
        const isAbsent = attendance?.status === 'absent';
        const hasUndertime = attendance?.has_undertime === 1;
        const isActive = attendance?.is_active !== 0; // Default to active if not set

        html += `
        <div class="teacher-card ${!isActive ? 'deactivated' : ''}" id="card-${teacher.id}" data-teacher-id="${teacher.id}">
          <div class="teacher-info">
            <div class="teacher-name">${teacher.name}</div>
            <div class="teacher-time">
              ${teacher.startTime ? `Start: ${teacher.startTime}` : ''}
              ${teacher.endTime ? ` | End: ${teacher.endTime}` : ''}
            </div>
            <button class="toggle-active-btn"
                    data-teacher-id="${teacher.id}"
                    data-teacher-name="${teacher.name}"
                    data-start-time="${teacher.startTime}"
                    data-end-time="${teacher.endTime}"
                    data-is-active="${isActive}"
                    title="${isActive ? 'Mark as Not Applicable' : 'Mark as Active'}">
              ${isActive ? '🚫 NA' : '✓ Activate'}
            </button>
          </div>
          <div class="attendance-controls">
            <div class="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  class="present-checkbox"
                  data-teacher-id="${teacher.id}"
                  data-teacher-name="${teacher.name}"
                  data-start-time="${teacher.startTime}"
                  data-end-time="${teacher.endTime}"
                  data-status="present"
                  onchange="handleAttendanceChange(this)"
                  ${isPresent ? 'checked' : ''}
                />
                Present
              </label>
              <label>
                <input
                  type="checkbox"
                  class="late-checkbox"
                  data-teacher-id="${teacher.id}"
                  data-teacher-name="${teacher.name}"
                  data-start-time="${teacher.startTime}"
                  data-end-time="${teacher.endTime}"
                  data-status="late"
                  onchange="handleAttendanceChange(this)"
                  ${isLate ? 'checked' : ''}
                />
                Late
              </label>
              <label>
                <input
                  type="checkbox"
                  class="absent-checkbox"
                  data-teacher-id="${teacher.id}"
                  data-teacher-name="${teacher.name}"
                  data-start-time="${teacher.startTime}"
                  data-end-time="${teacher.endTime}"
                  data-status="absent"
                  onchange="handleAttendanceChange(this)"
                  ${isAbsent ? 'checked' : ''}
                />
                Absent
              </label>
            </div>
            <div class="checkbox-group" style="margin-top: 8px;">
              <label>
                <input
                  type="checkbox"
                  class="undertime-checkbox"
                  data-teacher-id="${teacher.id}"
                  data-teacher-name="${teacher.name}"
                  data-start-time="${teacher.startTime}"
                  data-end-time="${teacher.endTime}"
                  onchange="handleUndertimeChange(this)"
                  ${hasUndertime ? 'checked' : ''}
                  ${isAbsent || (!isPresent && !isLate) ? 'disabled' : ''}
                />
                Left Early/Undertime
              </label>
            </div>
            <span class="save-status" id="status-${teacher.id}"></span>
          </div>
        </div>`;
      });

      html += '</div></div>';
    });
  }

  teachersList.innerHTML = html;
  document.getElementById('submitAttendanceBtn').style.display = 'none';

  // Attach event listeners to all toggle-active buttons
  document.querySelectorAll('.toggle-active-btn').forEach(button => {
    button.addEventListener('click', function() {
      const teacherId = this.getAttribute('data-teacher-id');
      const teacherName = this.getAttribute('data-teacher-name');
      const startTime = this.getAttribute('data-start-time');
      const endTime = this.getAttribute('data-end-time');
      const isActive = this.getAttribute('data-is-active') === 'true';

      toggleTeacherActive(teacherId, teacherName, startTime, endTime, isActive);
    });
  });
}

// Handle attendance checkbox change
async function handleAttendanceChange(checkbox) {
  const teacherId = checkbox.getAttribute('data-teacher-id');
  const teacherName = checkbox.getAttribute('data-teacher-name');
  const startTime = checkbox.getAttribute('data-start-time');
  const endTime = checkbox.getAttribute('data-end-time');
  const status = checkbox.getAttribute('data-status');

  // Get all checkboxes for this teacher
  const presentCheckbox = document.querySelector(
    `input[data-teacher-id="${teacherId}"][data-status="present"]`
  );
  const lateCheckbox = document.querySelector(
    `input[data-teacher-id="${teacherId}"][data-status="late"]`
  );
  const absentCheckbox = document.querySelector(
    `input[data-teacher-id="${teacherId}"][data-status="absent"]`
  );
  const undertimeCheckbox = document.querySelector(
    `input.undertime-checkbox[data-teacher-id="${teacherId}"]`
  );

  // Ensure only one main status is checked
  if (checkbox.checked) {
    // Uncheck the other two
    if (status === 'present') {
      lateCheckbox.checked = false;
      absentCheckbox.checked = false;
    } else if (status === 'late') {
      presentCheckbox.checked = false;
      absentCheckbox.checked = false;
    } else {
      presentCheckbox.checked = false;
      lateCheckbox.checked = false;
    }

    // Enable/disable undertime checkbox based on status
    if (undertimeCheckbox) {
      if (status === 'absent') {
        // Disable undertime for absent
        undertimeCheckbox.disabled = true;
        undertimeCheckbox.checked = false;
      } else {
        // Enable undertime for present or late
        undertimeCheckbox.disabled = false;
      }
    }

    attendanceData[teacherId] = {
      teacherId,
      teacherName,
      startTime,
      endTime,
      status
    };

    // Handle different statuses
    if (status === 'late') {
      // Open modal for late reason
      openLateModal({ teacherId, teacherName, startTime, endTime });
    } else if (status === 'absent') {
      // Open modal for absent details
      openAbsentModal({ teacherId, teacherName, startTime, endTime });
    } else {
      // Present status - auto-save immediately
      await saveAttendance(teacherId, teacherName, startTime, endTime, status);
    }
  } else {
    // Unchecked - delete from database
    delete attendanceData[teacherId];
    await deleteTeacherAttendance(teacherId);
  }
}

// Delete teacher attendance from database
async function deleteTeacherAttendance(teacherId) {
  const statusElement = document.getElementById(`status-${teacherId}`);

  try {
    statusElement.textContent = 'Deleting...';
    statusElement.className = 'save-status saving';

    const response = await fetch(`${API_URL}/attendance/${selectedDate}/${teacherId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      statusElement.textContent = '✓ Deleted';
      statusElement.className = 'save-status saved';

      // Refresh the daily report to keep it in sync
      refreshDailyReportSilently();

      // Refresh calendar date indicators
      refreshCalendarDates();

      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'save-status';
      }, 2000);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error deleting attendance:', error);
    statusElement.textContent = '✗ Error';
    statusElement.className = 'save-status error';

    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'save-status';
    }, 3000);
  }
}

// Auto-save individual attendance
async function saveAttendance(teacherId, teacherName, startTime, endTime, status) {
  const statusElement = document.getElementById(`status-${teacherId}`);

  try {
    statusElement.textContent = 'Saving...';
    statusElement.className = 'save-status saving';

    const response = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: selectedDate,
        attendance: [{
          teacherId,
          teacherName,
          startTime,
          endTime,
          status
        }]
      })
    });

    const data = await response.json();

    if (data.success) {
      statusElement.textContent = '✓ Saved';
      statusElement.className = 'save-status saved';

      // Refresh the daily report to keep it in sync
      refreshDailyReportSilently();

      // Refresh calendar date indicators
      refreshCalendarDates();

      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'save-status';
      }, 2000);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error saving attendance:', error);
    statusElement.textContent = '✗ Error';
    statusElement.className = 'save-status error';

    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'save-status';
    }, 3000);
  }
}

// Submit attendance
async function submitAttendance() {
  const attendance = Object.values(attendanceData);

  if (attendance.length === 0) {
    alert('Please mark attendance for at least one teacher.');
    return;
  }

  const submitBtn = document.getElementById('submitAttendanceBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const response = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ attendance })
    });

    const data = await response.json();

    if (data.success) {
      showMessage('success', 'Attendance submitted successfully!');
      // Reset after 2 seconds
      setTimeout(() => {
        loadTeachers();
      }, 2000);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error submitting attendance:', error);
    showMessage('error', `Error submitting attendance: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Attendance';
  }
}

// Load daily report
async function loadDailyReport() {
  const date = document.getElementById('reportDate').value;
  const reportContent = document.getElementById('dailyReportContent');

  if (!date) {
    alert('Please select a date.');
    return;
  }

  reportContent.innerHTML = '<div class="loading">Loading report...</div>';

  try {
    const response = await fetch(`${API_URL}/attendance/${date}`);
    const data = await response.json();

    if (data.success) {
      fullDailyReportData = data.attendance;
      currentReportDate = date;

      // Show filter controls if there's data
      if (data.attendance.length > 0) {
        document.getElementById('reportFilterControls').style.display = 'block';
      } else {
        document.getElementById('reportFilterControls').style.display = 'none';
      }

      renderDailyReport(data.attendance, date);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error loading report:', error);
    reportContent.innerHTML = `<div class="error-message">Error loading report: ${error.message}</div>`;
    document.getElementById('reportFilterControls').style.display = 'none';
  }
}

// Refresh daily report silently (called after attendance saves to keep in sync)
async function refreshDailyReportSilently() {
  // Only refresh if there's already report data loaded
  if (!currentReportDate) return;

  try {
    const response = await fetch(`${API_URL}/attendance/${currentReportDate}`);
    const data = await response.json();

    if (data.success) {
      fullDailyReportData = data.attendance;

      // Show filter controls if there's data
      if (data.attendance.length > 0) {
        document.getElementById('reportFilterControls').style.display = 'block';
      } else {
        document.getElementById('reportFilterControls').style.display = 'none';
      }

      renderDailyReport(data.attendance, currentReportDate);
    }
  } catch (error) {
    console.error('Error refreshing report:', error);
    // Silently fail - don't show error to user
  }
}

// Render daily report
function renderDailyReport(attendance, date) {
  const reportContent = document.getElementById('dailyReportContent');

  if (attendance.length === 0) {
    reportContent.innerHTML = `<div class="info-text">No attendance records found for ${date}.</div>`;
    return;
  }

  // Sort attendance by start time
  const sortedAttendance = [...attendance].sort((a, b) => {
    const timeA = timeStringToHour(a.start_time);
    const timeB = timeStringToHour(b.start_time);

    if (timeA === null && timeB === null) return 0;
    if (timeA === null) return 1;
    if (timeB === null) return -1;

    if (timeA !== timeB) return timeA - timeB;

    // If same time, sort by name
    return a.teacher_name.localeCompare(b.teacher_name);
  });

  const presentCount = sortedAttendance.filter(a => a.status === 'present').length;
  const lateCount = sortedAttendance.filter(a => a.status === 'late').length;
  const absentCount = sortedAttendance.filter(a => a.status === 'absent').length;

  reportContent.innerHTML = `
    <div class="summary-section">
      <div class="summary-card">
        <h3>Total Teachers</h3>
        <div class="value">${attendance.length}</div>
      </div>
      <div class="summary-card">
        <h3>Present</h3>
        <div class="value">${presentCount}</div>
      </div>
      <div class="summary-card">
        <h3>Late</h3>
        <div class="value">${lateCount}</div>
      </div>
      <div class="summary-card">
        <h3>Absent</h3>
        <div class="value">${absentCount}</div>
      </div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th>Teacher Name</th>
          <th>Status</th>
          <th>Shift</th>
          <th>Details</th>
          <th>Recorded At</th>
        </tr>
      </thead>
      <tbody>
        ${sortedAttendance.map(record => {
          let detailsHtml = '-';

          if (record.status === 'late' && record.late_reason) {
            detailsHtml = `<strong>Reason:</strong> ${record.late_reason}`;

            if (record.minutes_late) {
              detailsHtml += `<br><strong>⏱️ Minutes Late:</strong> ${record.minutes_late} minutes`;
            }

            if (record.classAssignments && record.classAssignments.length > 0) {
              detailsHtml += '<br><br><strong>Class Coverage:</strong><br>';
              record.classAssignments.forEach(assignment => {
                if (assignment.online_class || assignment.onlineClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #e3f2fd; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                  </div>`;
                } else if (assignment.no_class || assignment.noClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> N/A
                  </div>`;
                } else {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}</strong><br>
                    👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;

                  if (assignment.students) {
                    const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                    if (students && students.length > 0) {
                      detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                    }
                  }
                  detailsHtml += '</div>';
                }
              });
            }
          } else if (record.status === 'absent') {
            detailsHtml = `<strong>Reason:</strong> ${record.absent_reason || 'Not specified'}`;

            // Show official leave type with purple styling
            if (record.official_leave_type === 'sick') {
              detailsHtml += `<br><span style="color: #6f42c1; font-weight: bold;">🏥 Official Sick Leave</span>`;
            } else if (record.official_leave_type === 'vacation') {
              detailsHtml += `<br><span style="color: #6f42c1; font-weight: bold;">🏖️ Official Vacation Leave</span>`;
            }

            if (record.classAssignments && record.classAssignments.length > 0) {
              detailsHtml += '<br><br><strong>Class Coverage:</strong><br>';
              record.classAssignments.forEach(assignment => {
                if (assignment.online_class || assignment.onlineClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #e3f2fd; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                  </div>`;
                } else if (assignment.no_class || assignment.noClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> N/A
                  </div>`;
                } else {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}</strong><br>
                    👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;

                  if (assignment.students) {
                    const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                    if (students && students.length > 0) {
                      detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                    }
                  }
                  detailsHtml += '</div>';
                }
              });
            }
          }

          // Add undertime info if applicable
          if (record.has_undertime === 1 && record.undertime_reason) {
            detailsHtml += detailsHtml === '-' ? '' : '<br><br>';
            detailsHtml += `<strong>⏰ Left Early:</strong> ${record.undertime_reason}`;

            if (record.undertime_minutes) {
              detailsHtml += `<br><strong>⏱️ Minutes Early:</strong> ${record.undertime_minutes} minutes`;
            }

            // Show undertime class coverage
            if (record.undertimeClassAssignments && record.undertimeClassAssignments.length > 0) {
              detailsHtml += '<br><br><strong>Remaining Classes Coverage:</strong><br>';
              record.undertimeClassAssignments.forEach(assignment => {
                if (assignment.online_class || assignment.onlineClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #e3f2fd; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                  </div>`;
                } else if (assignment.no_class || assignment.noClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> N/A
                  </div>`;
                } else {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #fff3cd; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}</strong><br>
                    👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;

                  if (assignment.students) {
                    const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                    if (students && students.length > 0) {
                      detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                    }
                  }
                  detailsHtml += '</div>';
                }
              });
            }
          }

          return `
          <tr>
            <td>${record.teacher_name}</td>
            <td>
              <span class="status-badge status-${record.status}">
                ${record.status.toUpperCase()}
              </span>
            </td>
            <td>${record.start_time && record.end_time ? `${record.start_time} - ${record.end_time}` : '-'}</td>
            <td>${detailsHtml}</td>
            <td>${new Date(record.timestamp + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// Store chart instances
let chartInstances = {};

// Load overview with comprehensive analytics
async function loadOverview() {
  const startDate = document.getElementById('overviewStartDate').value;
  const endDate = document.getElementById('overviewEndDate').value;

  if (!startDate || !endDate) {
    alert('Please select both start and end dates.');
    return;
  }

  const overviewSummary = document.getElementById('overviewSummary');

  overviewSummary.innerHTML = '<div class="loading">Loading analytics...</div>';

  try {
    const response = await fetch(`${API_URL}/reports/range?startDate=${startDate}&endDate=${endDate}`);
    const data = await response.json();

    if (data.success) {
      await renderComprehensiveAnalytics(data.attendance, startDate, endDate);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error loading overview:', error);
    overviewSummary.innerHTML = `<div class="error-message">Error loading overview: ${error.message}</div>`;
  }
}

// Render overview - now handled by analytics.js
// Function kept for compatibility but functionality moved to renderComprehensiveAnalytics()

// Helper function to use timeStringToHour from helpers.js
// (Already defined in helpers.js, just making sure it's available)

// Export CSV
function exportCSV() {
  const startDate = document.getElementById('overviewStartDate').value;
  const endDate = document.getElementById('overviewEndDate').value;

  if (!startDate || !endDate) {
    alert('Please select both start and end dates before exporting.');
    return;
  }

  const url = `${API_URL}/export/csv?startDate=${startDate}&endDate=${endDate}`;
  window.open(url, '_blank');
}

// Show message
function showMessage(type, message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
  messageDiv.textContent = message;

  const teachersList = document.getElementById('teachersList');
  teachersList.insertBefore(messageDiv, teachersList.firstChild);

  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

// Handle "All" filter checkbox
function handleFilterAllChange() {
  const allCheckbox = document.getElementById('filterAll');
  const presentCheckbox = document.getElementById('filterPresent');
  const lateCheckbox = document.getElementById('filterLate');
  const absentCheckbox = document.getElementById('filterAbsent');

  if (allCheckbox.checked) {
    presentCheckbox.checked = true;
    lateCheckbox.checked = true;
    absentCheckbox.checked = true;
  } else {
    presentCheckbox.checked = false;
    lateCheckbox.checked = false;
    absentCheckbox.checked = false;
  }

  applyFiltersToReport();
}

// Handle individual status filter change
function handleStatusFilterChange() {
  const allCheckbox = document.getElementById('filterAll');
  const presentCheckbox = document.getElementById('filterPresent');
  const lateCheckbox = document.getElementById('filterLate');
  const absentCheckbox = document.getElementById('filterAbsent');

  // Update "All" checkbox based on individual checkboxes
  if (presentCheckbox.checked && lateCheckbox.checked && absentCheckbox.checked) {
    allCheckbox.checked = true;
  } else {
    allCheckbox.checked = false;
  }

  applyFiltersToReport();
}

// Apply filters to the daily report
function applyFiltersToReport() {
  if (!fullDailyReportData) return;

  const presentCheckbox = document.getElementById('filterPresent');
  const lateCheckbox = document.getElementById('filterLate');
  const absentCheckbox = document.getElementById('filterAbsent');

  const shift8amCheckbox = document.getElementById('filterShift8am');
  const shift10amCheckbox = document.getElementById('filterShift10am');
  const shift1pmCheckbox = document.getElementById('filterShift1pm');
  const shift3pmCheckbox = document.getElementById('filterShift3pm');
  const shift5pmCheckbox = document.getElementById('filterShift5pm');
  const shift7pmCheckbox = document.getElementById('filterShift7pm');

  let filteredData = fullDailyReportData.filter(record => {
    // Check status filter
    let statusMatch = false;
    if (record.status === 'present' && presentCheckbox.checked) statusMatch = true;
    if (record.status === 'late' && lateCheckbox.checked) statusMatch = true;
    if (record.status === 'absent' && absentCheckbox.checked) statusMatch = true;

    if (!statusMatch) return false;

    // Check shift filter
    let shiftMatch = false;
    if (record.start_time === '8am' && shift8amCheckbox.checked) shiftMatch = true;
    if (record.start_time === '10am' && shift10amCheckbox.checked) shiftMatch = true;
    if (record.start_time === '1pm' && shift1pmCheckbox.checked) shiftMatch = true;
    if (record.start_time === '3pm' && shift3pmCheckbox.checked) shiftMatch = true;
    if (record.start_time === '5pm' && shift5pmCheckbox.checked) shiftMatch = true;
    if (record.start_time === '7pm' && shift7pmCheckbox.checked) shiftMatch = true;

    return shiftMatch;
  });

  renderDailyReport(filteredData, currentReportDate);
}

// Handle "All Shifts" filter checkbox
function handleFilterAllShiftsChange() {
  const allShiftsCheckbox = document.getElementById('filterAllShifts');
  const shift8amCheckbox = document.getElementById('filterShift8am');
  const shift10amCheckbox = document.getElementById('filterShift10am');
  const shift1pmCheckbox = document.getElementById('filterShift1pm');
  const shift3pmCheckbox = document.getElementById('filterShift3pm');
  const shift5pmCheckbox = document.getElementById('filterShift5pm');
  const shift7pmCheckbox = document.getElementById('filterShift7pm');

  if (allShiftsCheckbox.checked) {
    shift8amCheckbox.checked = true;
    shift10amCheckbox.checked = true;
    shift1pmCheckbox.checked = true;
    shift3pmCheckbox.checked = true;
    shift5pmCheckbox.checked = true;
    shift7pmCheckbox.checked = true;
  } else {
    shift8amCheckbox.checked = false;
    shift10amCheckbox.checked = false;
    shift1pmCheckbox.checked = false;
    shift3pmCheckbox.checked = false;
    shift5pmCheckbox.checked = false;
    shift7pmCheckbox.checked = false;
  }

  applyFiltersToReport();
}

// Handle individual shift filter change
function handleShiftFilterChange() {
  const allShiftsCheckbox = document.getElementById('filterAllShifts');
  const shift8amCheckbox = document.getElementById('filterShift8am');
  const shift10amCheckbox = document.getElementById('filterShift10am');
  const shift1pmCheckbox = document.getElementById('filterShift1pm');
  const shift3pmCheckbox = document.getElementById('filterShift3pm');
  const shift5pmCheckbox = document.getElementById('filterShift5pm');
  const shift7pmCheckbox = document.getElementById('filterShift7pm');

  // Update "All Shifts" checkbox based on individual checkboxes
  if (shift8amCheckbox.checked && shift10amCheckbox.checked && shift1pmCheckbox.checked &&
      shift3pmCheckbox.checked && shift5pmCheckbox.checked && shift7pmCheckbox.checked) {
    allShiftsCheckbox.checked = true;
  } else {
    allShiftsCheckbox.checked = false;
  }

  applyFiltersToReport();
}

// Download daily report as image
async function downloadDailyReportAsImage() {
  const downloadBtn = document.getElementById('downloadReportBtn');

  if (!fullDailyReportData || fullDailyReportData.length === 0) {
    alert('No report data to download. Please load a report first.');
    return;
  }

  try {
    downloadBtn.disabled = true;
    downloadBtn.textContent = '📸 Generating...';

    // Get filtered data based on current filters
    const presentCheckbox = document.getElementById('filterPresent');
    const lateCheckbox = document.getElementById('filterLate');
    const absentCheckbox = document.getElementById('filterAbsent');

    const shift8amCheckbox = document.getElementById('filterShift8am');
    const shift10amCheckbox = document.getElementById('filterShift10am');
    const shift1pmCheckbox = document.getElementById('filterShift1pm');
    const shift3pmCheckbox = document.getElementById('filterShift3pm');
    const shift5pmCheckbox = document.getElementById('filterShift5pm');
    const shift7pmCheckbox = document.getElementById('filterShift7pm');

    let filteredData = fullDailyReportData.filter(record => {
      // Check status filter
      let statusMatch = false;
      if (record.status === 'present' && presentCheckbox.checked) statusMatch = true;
      if (record.status === 'late' && lateCheckbox.checked) statusMatch = true;
      if (record.status === 'absent' && absentCheckbox.checked) statusMatch = true;

      if (!statusMatch) return false;

      // Check shift filter
      let shiftMatch = false;
      if (record.start_time === '8am' && shift8amCheckbox.checked) shiftMatch = true;
      if (record.start_time === '10am' && shift10amCheckbox.checked) shiftMatch = true;
      if (record.start_time === '1pm' && shift1pmCheckbox.checked) shiftMatch = true;
      if (record.start_time === '3pm' && shift3pmCheckbox.checked) shiftMatch = true;
      if (record.start_time === '5pm' && shift5pmCheckbox.checked) shiftMatch = true;
      if (record.start_time === '7pm' && shift7pmCheckbox.checked) shiftMatch = true;

      return shiftMatch;
    });

    // Sort by time
    const sortedData = [...filteredData].sort((a, b) => {
      const timeA = timeStringToHour(a.start_time);
      const timeB = timeStringToHour(b.start_time);

      if (timeA === null && timeB === null) return 0;
      if (timeA === null) return 1;
      if (timeB === null) return -1;

      if (timeA !== timeB) return timeA - timeB;
      return a.teacher_name.localeCompare(b.teacher_name);
    });

    // Format the date nicely
    const dateObj = new Date(currentReportDate + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create a temporary container for download
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.background = '#ffffff';
    tempContainer.style.padding = '30px';
    tempContainer.style.width = '1200px';

    tempContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #001F3F; font-size: 2rem; margin-bottom: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.5px; font-weight: 700;">
          Teacher Attendance Report
        </h1>
        <p style="color: #64748B; font-size: 1.2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 500;">
          ${formattedDate}
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);">
        <thead>
          <tr>
            <th style="padding: 14px 18px; text-align: left; background: #001F3F; color: white; font-weight: 600; border-bottom: 1px solid #E2E8F0; letter-spacing: 0.3px;">Teacher Name</th>
            <th style="padding: 14px 18px; text-align: left; background: #001F3F; color: white; font-weight: 600; border-bottom: 1px solid #E2E8F0; letter-spacing: 0.3px;">Status</th>
            <th style="padding: 14px 18px; text-align: left; background: #001F3F; color: white; font-weight: 600; border-bottom: 1px solid #E2E8F0; letter-spacing: 0.3px;">Shift</th>
            <th style="padding: 14px 18px; text-align: left; background: #001F3F; color: white; font-weight: 600; border-bottom: 1px solid #E2E8F0; letter-spacing: 0.3px;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${sortedData.map(record => {
            let detailsHtml = '-';

            if (record.status === 'late' && record.late_reason) {
              detailsHtml = `<strong>Reason:</strong> ${record.late_reason}`;

              if (record.minutes_late) {
                detailsHtml += `<br><strong>⏱️ Minutes Late:</strong> ${record.minutes_late} minutes`;
              }

              // Class Coverage for late teachers
              if (record.classAssignments && record.classAssignments.length > 0) {
                detailsHtml += '<br><br><strong>Class Coverage:</strong><br>';
                record.classAssignments.forEach(assignment => {
                  if (assignment.online_class || assignment.onlineClass) {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #E3F2FD; border-radius: 8px; border: 1px solid #90CAF9;">
                      📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                    </div>`;
                  } else if (assignment.no_class || assignment.noClass) {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #F7F9FC; border-radius: 8px; border: 1px solid #E2E8F0;">
                      📅 <strong>${assignment.class_slot}:</strong> N/A
                    </div>`;
                  } else {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #F7F9FC; border-radius: 8px; border: 1px solid #E2E8F0;">
                      📅 <strong>${assignment.class_slot}</strong><br>
                      👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;

                    if (assignment.students) {
                      const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                      if (students && students.length > 0) {
                        detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                      }
                    }
                    detailsHtml += '</div>';
                  }
                });
              }
            } else if (record.status === 'absent') {
              detailsHtml = `<strong>Reason:</strong> ${record.absent_reason || 'Not specified'}`;

              // Show official leave type with purple styling
              if (record.official_leave_type === 'sick') {
                detailsHtml += `<br><span style="color: #6f42c1; font-weight: bold;">🏥 Official Sick Leave</span>`;
              } else if (record.official_leave_type === 'vacation') {
                detailsHtml += `<br><span style="color: #6f42c1; font-weight: bold;">🏖️ Official Vacation Leave</span>`;
              }

              if (record.classAssignments && record.classAssignments.length > 0) {
                detailsHtml += '<br><br><strong>Class Coverage:</strong><br>';
                record.classAssignments.forEach(assignment => {
                  if (assignment.online_class || assignment.onlineClass) {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #E3F2FD; border-radius: 8px; border: 1px solid #90CAF9;">
                      📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                    </div>`;
                  } else if (assignment.no_class || assignment.noClass) {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #F7F9FC; border-radius: 8px; border: 1px solid #E2E8F0;">
                      📅 <strong>${assignment.class_slot}:</strong> N/A
                    </div>`;
                  } else {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #F7F9FC; border-radius: 8px; border: 1px solid #E2E8F0;">
                      📅 <strong>${assignment.class_slot}</strong><br>
                      👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;

                    if (assignment.students) {
                      const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                      if (students && students.length > 0) {
                        detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                      }
                    }
                    detailsHtml += '</div>';
                  }
                });
              }
            }

            // Add undertime info if applicable
            if (record.has_undertime === 1 && record.undertime_reason) {
              detailsHtml += detailsHtml === '-' ? '' : '<br><br>';
              detailsHtml += `<strong>⏰ Left Early:</strong> ${record.undertime_reason}`;

              if (record.undertime_minutes) {
                detailsHtml += `<br><strong>⏱️ Minutes Early:</strong> ${record.undertime_minutes} minutes`;
              }

              // Show undertime class coverage
              if (record.undertimeClassAssignments && record.undertimeClassAssignments.length > 0) {
                detailsHtml += '<br><br><strong>Remaining Classes Coverage:</strong><br>';
                record.undertimeClassAssignments.forEach(assignment => {
                  if (assignment.online_class || assignment.onlineClass) {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #E3F2FD; border-radius: 8px; border: 1px solid #90CAF9;">
                      📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                    </div>`;
                  } else if (assignment.no_class || assignment.noClass) {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #F7F9FC; border-radius: 8px; border: 1px solid #E2E8F0;">
                      📅 <strong>${assignment.class_slot}:</strong> N/A
                    </div>`;
                  } else {
                    detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #FFF3CD; border-radius: 8px; border: 1px solid #FFECB5;">
                      📅 <strong>${assignment.class_slot}</strong><br>
                      👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;

                    if (assignment.students) {
                      const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                      if (students && students.length > 0) {
                        detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                      }
                    }
                    detailsHtml += '</div>';
                  }
                });
              }
            }

            let statusBgColor = '#D1FAE5';
            let statusTextColor = '#065F46';
            let statusBorderColor = '#10B981';
            if (record.status === 'late') {
              statusBgColor = '#FEF3C7';
              statusTextColor = '#92400E';
              statusBorderColor = '#F59E0B';
            } else if (record.status === 'absent') {
              statusBgColor = '#FEE2E2';
              statusTextColor = '#991B1B';
              statusBorderColor = '#EF4444';
            }

            return `
            <tr style="border-bottom: 1px solid #E2E8F0;">
              <td style="padding: 12px 15px; vertical-align: top; font-size: 0.95rem; color: #1A202C;">${record.teacher_name}</td>
              <td style="padding: 12px 15px; vertical-align: top;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; background: ${statusBgColor}; color: ${statusTextColor}; border: 1px solid ${statusBorderColor};">
                  ${record.status.toUpperCase()}
                </span>
              </td>
              <td style="padding: 12px 15px; vertical-align: top; font-size: 0.9rem; color: #64748B;">${record.start_time && record.end_time ? `${record.start_time} - ${record.end_time}` : '-'}</td>
              <td style="padding: 12px 15px; vertical-align: top; max-width: 400px; font-size: 0.9rem; line-height: 1.5; color: #1A202C;">${detailsHtml}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    `;

    document.body.appendChild(tempContainer);

    // Use html2canvas to convert to image
    const canvas = await html2canvas(tempContainer, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true
    });

    // Remove temp container
    document.body.removeChild(tempContainer);

    // Convert canvas to blob and download
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-report-${currentReportDate}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      downloadBtn.disabled = false;
      downloadBtn.textContent = '📷 Download as Image';
    });
  } catch (error) {
    console.error('Error generating image:', error);
    alert('Error generating image. Please try again.');
    downloadBtn.disabled = false;
    downloadBtn.textContent = '📷 Download as Image';
  }
}

// Toggle teacher active status (mark as NA or activate)
async function toggleTeacherActive(teacherId, teacherName, startTime, endTime, currentlyActive) {
  try {
    console.log('Toggle teacher active called with:', { teacherId, teacherName, startTime, endTime, currentlyActive, selectedDate });

    const newActiveStatus = !currentlyActive;

    // Update the database via API
    const response = await fetch(`${API_URL}/attendance/${selectedDate}/${teacherId}/active`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        isActive: newActiveStatus,
        teacherName: teacherName,
        startTime: startTime,
        endTime: endTime
      })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);

    if (data.success) {
      // Update or create the local attendanceData
      if (!attendanceData[teacherId]) {
        attendanceData[teacherId] = {
          teacherId: teacherId,
          teacherName: teacherName,
          status: 'unmarked',
          startTime: startTime,
          endTime: endTime,
          is_active: newActiveStatus ? 1 : 0
        };
      } else {
        attendanceData[teacherId].is_active = newActiveStatus ? 1 : 0;
      }

      // Re-render the teachers list to reflect the change
      renderTeachersList();

      // Also refresh the daily report if it's visible
      refreshDailyReportSilently();

      console.log('Successfully toggled teacher active status');
    } else {
      console.error('API returned error:', data.message);
      alert(`Error: ${data.message}`);
    }
  } catch (error) {
    console.error('Error toggling teacher active status:', error);
    console.error('Error details:', error.message, error.stack);
    alert(`Failed to update teacher status. Error: ${error.message}`);
  }
}

// Handle undertime checkbox change
function handleUndertimeChange(checkbox) {
  const teacherId = checkbox.getAttribute('data-teacher-id');
  const teacherName = checkbox.getAttribute('data-teacher-name');
  const startTime = checkbox.getAttribute('data-start-time');
  const endTime = checkbox.getAttribute('data-end-time');

  if (checkbox.checked) {
    // Open undertime modal
    openUndertimeModal({ teacherId, teacherName, startTime, endTime });
  } else {
    // Uncheck - remove undertime flag and clear undertime data
    if (attendanceData[teacherId]) {
      attendanceData[teacherId].has_undertime = 0;
      attendanceData[teacherId].undertime_minutes = null;
      attendanceData[teacherId].undertime_reason = null;

      // Save the updated attendance (without undertime)
      saveAttendanceWithUndertime(teacherId);
    }
  }
}

// Save attendance with undertime data (used when unchecking undertime)
async function saveAttendanceWithUndertime(teacherId) {
  const record = attendanceData[teacherId];
  if (!record) return;

  const statusElement = document.getElementById(`status-${teacherId}`);

  try {
    statusElement.textContent = 'Saving...';
    statusElement.className = 'save-status saving';

    const response = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: selectedDate,
        attendance: [{
          teacherId: record.teacherId,
          teacherName: record.teacherName,
          startTime: record.startTime,
          endTime: record.endTime,
          status: record.status,
          lateReason: record.lateReason || null,
          absentReason: record.absentReason || null,
          minutesLate: record.minutesLate || null,
          hasUndertime: record.has_undertime || 0,
          undertimeMinutes: record.undertime_minutes || null,
          undertimeReason: record.undertime_reason || null,
          officialLeaveType: record.officialLeaveType || null
        }]
      })
    });

    const data = await response.json();

    if (data.success) {
      statusElement.textContent = '✓ Saved';
      statusElement.className = 'save-status saved';

      refreshDailyReportSilently();

      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'save-status';
      }, 2000);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error saving attendance:', error);
    statusElement.textContent = '✗ Error';
    statusElement.className = 'save-status error';

    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = 'save-status';
    }, 3000);
  }
}

// ==================== INDIVIDUAL RECORDS TAB ====================

let individualTeachersLoaded = false;
let currentIndividualData = null; // Store loaded data for download

// Load teachers for dropdown
async function loadTeachersForDropdown() {
  if (individualTeachersLoaded) return;

  const select = document.getElementById('individualTeacherSelect');

  try {
    select.innerHTML = '<option value="">Loading teachers...</option>';

    const response = await fetch(`${API_URL}/teachers`);
    const data = await response.json();

    if (data.success) {
      select.innerHTML = '<option value="">-- Select a Teacher --</option>';

      data.teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        option.textContent = teacher.name;
        option.dataset.startTime = teacher.startTime;
        option.dataset.endTime = teacher.endTime;
        select.appendChild(option);
      });

      individualTeachersLoaded = true;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error loading teachers for dropdown:', error);
    select.innerHTML = '<option value="">Error loading teachers</option>';
  }
}

// Load individual teacher records
async function loadIndividualRecords() {
  const select = document.getElementById('individualTeacherSelect');
  const teacherId = select.value;
  const teacherName = select.options[select.selectedIndex]?.textContent;
  const startTime = select.options[select.selectedIndex]?.dataset.startTime;
  const endTime = select.options[select.selectedIndex]?.dataset.endTime;

  const startDate = document.getElementById('individualStartDate').value;
  const endDate = document.getElementById('individualEndDate').value;

  const summaryDiv = document.getElementById('individualSummary');
  const contentDiv = document.getElementById('individualRecordsContent');
  const downloadBtn = document.getElementById('downloadIndividualRecordsBtn');

  if (!teacherId) {
    alert('Please select a teacher');
    return;
  }

  contentDiv.innerHTML = '<div class="loading">Loading records...</div>';
  summaryDiv.style.display = 'none';
  downloadBtn.style.display = 'none';

  try {
    let url = `${API_URL}/attendance/history/${teacherId}`;
    const params = new URLSearchParams();

    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      // Store data for download
      currentIndividualData = {
        attendance: data.attendance,
        teacherName,
        startTime,
        endTime,
        filterStartDate: startDate,
        filterEndDate: endDate
      };

      renderIndividualRecords(data.attendance, teacherName, startTime, endTime, startDate, endDate);

      // Show download button if there are records
      if (data.attendance && data.attendance.length > 0) {
        downloadBtn.style.display = 'inline-block';
      }
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error loading individual records:', error);
    contentDiv.innerHTML = `<div class="error-message">Error loading records: ${error.message}</div>`;
  }
}

// Render individual teacher records
function renderIndividualRecords(attendance, teacherName, startTime, endTime, filterStartDate, filterEndDate) {
  const summaryDiv = document.getElementById('individualSummary');
  const contentDiv = document.getElementById('individualRecordsContent');

  if (!attendance || attendance.length === 0) {
    summaryDiv.style.display = 'none';
    contentDiv.innerHTML = `<div class="info-text">No attendance records found for ${teacherName}.</div>`;
    return;
  }

  // Calculate statistics
  const totalRecords = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const undertimeCount = attendance.filter(a => a.has_undertime === 1).length;
  const attendanceRate = totalRecords > 0 ? ((presentCount + lateCount) / totalRecords * 100).toFixed(1) : 0;

  // Build date range text
  let dateRangeText = '';
  if (filterStartDate || filterEndDate) {
    if (filterStartDate && filterEndDate) {
      dateRangeText = `${filterStartDate} to ${filterEndDate}`;
    } else if (filterStartDate) {
      dateRangeText = `From ${filterStartDate}`;
    } else {
      dateRangeText = `Until ${filterEndDate}`;
    }
  }

  // Render summary
  summaryDiv.style.display = 'grid';
  summaryDiv.innerHTML = `
    <div class="individual-teacher-header" style="grid-column: 1 / -1;">
      <h3>${teacherName}</h3>
      <span class="shift-badge">${startTime} - ${endTime}</span>
      ${dateRangeText ? `<span class="shift-badge" style="margin-left: auto;">${dateRangeText}</span>` : ''}
    </div>
    <div class="individual-stat-card">
      <h4>Total Records</h4>
      <div class="stat-value">${totalRecords}</div>
    </div>
    <div class="individual-stat-card present">
      <h4>Present</h4>
      <div class="stat-value">${presentCount}</div>
    </div>
    <div class="individual-stat-card late">
      <h4>Late</h4>
      <div class="stat-value">${lateCount}</div>
    </div>
    <div class="individual-stat-card absent">
      <h4>Absent</h4>
      <div class="stat-value">${absentCount}</div>
    </div>
    <div class="individual-stat-card" style="background: #fef3c7;">
      <h4>Undertime</h4>
      <div class="stat-value" style="color: #d97706;">${undertimeCount}</div>
    </div>
    <div class="individual-stat-card rate">
      <h4>Attendance Rate</h4>
      <div class="stat-value">${attendanceRate}%</div>
    </div>
  `;

  // Render records table
  contentDiv.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Status</th>
          <th>Details</th>
          <th>Recorded At</th>
        </tr>
      </thead>
      <tbody>
        ${attendance.map(record => {
          let detailsHtml = '-';

          if (record.status === 'late' && record.late_reason) {
            detailsHtml = `<strong>Reason:</strong> ${record.late_reason}`;
            if (record.minutes_late) {
              detailsHtml += `<br><strong>Minutes Late:</strong> ${record.minutes_late}`;
            }

            // Class Coverage for late
            if (record.classAssignments && record.classAssignments.length > 0) {
              detailsHtml += '<br><br><strong>Class Coverage:</strong><br>';
              record.classAssignments.forEach(assignment => {
                if (assignment.online_class || assignment.onlineClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #e3f2fd; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                  </div>`;
                } else if (assignment.no_class || assignment.noClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> N/A
                  </div>`;
                } else {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}</strong><br>
                    👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;
                  if (assignment.students) {
                    const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                    if (students && students.length > 0) {
                      detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                    }
                  }
                  detailsHtml += '</div>';
                }
              });
            }
          } else if (record.status === 'absent' && record.absent_reason) {
            detailsHtml = `<strong>Reason:</strong> ${record.absent_reason}`;
            if (record.official_leave_type === 'sick') {
              detailsHtml += `<br><span style="color: #6f42c1; font-weight: bold;">🏥 Official Sick Leave</span>`;
            } else if (record.official_leave_type === 'vacation') {
              detailsHtml += `<br><span style="color: #6f42c1; font-weight: bold;">🏖️ Official Vacation Leave</span>`;
            }

            // Class Coverage for absent
            if (record.classAssignments && record.classAssignments.length > 0) {
              detailsHtml += '<br><br><strong>Class Coverage:</strong><br>';
              record.classAssignments.forEach(assignment => {
                if (assignment.online_class || assignment.onlineClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #e3f2fd; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                  </div>`;
                } else if (assignment.no_class || assignment.noClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> N/A
                  </div>`;
                } else {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}</strong><br>
                    👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;
                  if (assignment.students) {
                    const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                    if (students && students.length > 0) {
                      detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                    }
                  }
                  detailsHtml += '</div>';
                }
              });
            }
          }

          // Add undertime info
          if (record.has_undertime === 1 && record.undertime_reason) {
            detailsHtml += detailsHtml === '-' ? '' : '<br><br>';
            detailsHtml += `<strong>⏰ Left Early:</strong> ${record.undertime_reason}`;
            if (record.undertime_minutes) {
              detailsHtml += ` (${record.undertime_minutes} min)`;
            }

            // Undertime class coverage
            if (record.undertimeClassAssignments && record.undertimeClassAssignments.length > 0) {
              detailsHtml += '<br><br><strong>Remaining Classes Coverage:</strong><br>';
              record.undertimeClassAssignments.forEach(assignment => {
                if (assignment.online_class || assignment.onlineClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #e3f2fd; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> 💻 Online class
                  </div>`;
                } else if (assignment.no_class || assignment.noClass) {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}:</strong> N/A
                  </div>`;
                } else {
                  detailsHtml += `<div style="margin: 5px 0; padding: 5px; background: #fff3cd; border-radius: 4px;">
                    📅 <strong>${assignment.class_slot}</strong><br>
                    👨‍🏫 Substitute: ${assignment.substitute_teacher_name || 'Not assigned'}<br>`;
                  if (assignment.students) {
                    const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                    if (students && students.length > 0) {
                      detailsHtml += `👥 Students: ${students.map(s => s.name).join(', ')}`;
                    }
                  }
                  detailsHtml += '</div>';
                }
              });
            }
          }

          // Format date nicely
          const dateObj = new Date(record.date + 'T00:00:00');
          const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

          return `
            <tr>
              <td>${formattedDate}</td>
              <td>
                <span class="status-badge status-${record.status}">
                  ${record.status.toUpperCase()}
                </span>
              </td>
              <td>${detailsHtml}</td>
              <td>${new Date(record.timestamp + 'Z').toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// Download individual records as image
async function downloadIndividualRecordsAsImage() {
  const downloadBtn = document.getElementById('downloadIndividualRecordsBtn');

  if (!currentIndividualData || !currentIndividualData.attendance || currentIndividualData.attendance.length === 0) {
    alert('No records to download. Please load records first.');
    return;
  }

  try {
    downloadBtn.disabled = true;
    downloadBtn.textContent = '📸 Generating...';

    const { attendance, teacherName, startTime, endTime, filterStartDate, filterEndDate } = currentIndividualData;

    // Calculate statistics
    const totalRecords = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    const absentCount = attendance.filter(a => a.status === 'absent').length;
    const undertimeCount = attendance.filter(a => a.has_undertime === 1).length;
    const attendanceRate = totalRecords > 0 ? ((presentCount + lateCount) / totalRecords * 100).toFixed(1) : 0;

    // Build date range text
    let dateRangeText = 'All Records';
    if (filterStartDate || filterEndDate) {
      if (filterStartDate && filterEndDate) {
        dateRangeText = `${filterStartDate} to ${filterEndDate}`;
      } else if (filterStartDate) {
        dateRangeText = `From ${filterStartDate}`;
      } else {
        dateRangeText = `Until ${filterEndDate}`;
      }
    }

    // Create a temporary container for download
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.background = '#ffffff';
    tempContainer.style.padding = '30px';
    tempContainer.style.width = '1200px';

    tempContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #001F3F; font-size: 1.8rem; margin-bottom: 5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 700;">
          Individual Attendance Report
        </h1>
        <p style="color: #1a202c; font-size: 1.3rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: 600; margin: 5px 0;">
          ${teacherName}
        </p>
        <p style="color: #64748B; font-size: 1rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          Shift: ${startTime} - ${endTime} | ${dateRangeText}
        </p>
      </div>

      <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 25px; flex-wrap: wrap;">
        <div style="background: #f8f9fa; padding: 12px 20px; border-radius: 8px; text-align: center; min-width: 100px;">
          <div style="font-size: 0.85rem; color: #64748b;">Total</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #1a202c;">${totalRecords}</div>
        </div>
        <div style="background: #D1FAE5; padding: 12px 20px; border-radius: 8px; text-align: center; min-width: 100px;">
          <div style="font-size: 0.85rem; color: #065F46;">Present</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #10b981;">${presentCount}</div>
        </div>
        <div style="background: #FEF3C7; padding: 12px 20px; border-radius: 8px; text-align: center; min-width: 100px;">
          <div style="font-size: 0.85rem; color: #92400E;">Late</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">${lateCount}</div>
        </div>
        <div style="background: #FEE2E2; padding: 12px 20px; border-radius: 8px; text-align: center; min-width: 100px;">
          <div style="font-size: 0.85rem; color: #991B1B;">Absent</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444;">${absentCount}</div>
        </div>
        <div style="background: #FEF3C7; padding: 12px 20px; border-radius: 8px; text-align: center; min-width: 100px;">
          <div style="font-size: 0.85rem; color: #92400E;">Undertime</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #d97706;">${undertimeCount}</div>
        </div>
        <div style="background: #DBEAFE; padding: 12px 20px; border-radius: 8px; text-align: center; min-width: 100px;">
          <div style="font-size: 0.85rem; color: #1e40af;">Rate</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${attendanceRate}%</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);">
        <thead>
          <tr>
            <th style="padding: 14px 18px; text-align: left; background: #001F3F; color: white; font-weight: 600;">Date</th>
            <th style="padding: 14px 18px; text-align: left; background: #001F3F; color: white; font-weight: 600;">Status</th>
            <th style="padding: 14px 18px; text-align: left; background: #001F3F; color: white; font-weight: 600;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${attendance.map(record => {
            let detailsHtml = '-';

            if (record.status === 'late' && record.late_reason) {
              detailsHtml = `<strong>Reason:</strong> ${record.late_reason}`;
              if (record.minutes_late) {
                detailsHtml += `<br><strong>Minutes Late:</strong> ${record.minutes_late}`;
              }
              if (record.classAssignments && record.classAssignments.length > 0) {
                detailsHtml += '<br><br><strong>Class Coverage:</strong><br>';
                record.classAssignments.forEach(assignment => {
                  if (assignment.online_class || assignment.onlineClass) {
                    detailsHtml += `<div style="margin: 3px 0; padding: 4px; background: #E3F2FD; border-radius: 4px;">📅 ${assignment.class_slot}: 💻 Online</div>`;
                  } else if (assignment.no_class || assignment.noClass) {
                    detailsHtml += `<div style="margin: 3px 0; padding: 4px; background: #F7F9FC; border-radius: 4px;">📅 ${assignment.class_slot}: N/A</div>`;
                  } else {
                    let assignHtml = `<div style="margin: 3px 0; padding: 4px; background: #F7F9FC; border-radius: 4px;">📅 ${assignment.class_slot}<br>👨‍🏫 ${assignment.substitute_teacher_name || 'Not assigned'}`;
                    if (assignment.students) {
                      const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                      if (students && students.length > 0) {
                        assignHtml += `<br>👥 ${students.map(s => s.name).join(', ')}`;
                      }
                    }
                    detailsHtml += assignHtml + '</div>';
                  }
                });
              }
            } else if (record.status === 'absent' && record.absent_reason) {
              detailsHtml = `<strong>Reason:</strong> ${record.absent_reason}`;
              if (record.official_leave_type === 'sick') {
                detailsHtml += `<br><span style="color: #6f42c1; font-weight: bold;">🏥 Official Sick Leave</span>`;
              } else if (record.official_leave_type === 'vacation') {
                detailsHtml += `<br><span style="color: #6f42c1; font-weight: bold;">🏖️ Official Vacation Leave</span>`;
              }
              if (record.classAssignments && record.classAssignments.length > 0) {
                detailsHtml += '<br><br><strong>Class Coverage:</strong><br>';
                record.classAssignments.forEach(assignment => {
                  if (assignment.online_class || assignment.onlineClass) {
                    detailsHtml += `<div style="margin: 3px 0; padding: 4px; background: #E3F2FD; border-radius: 4px;">📅 ${assignment.class_slot}: 💻 Online</div>`;
                  } else if (assignment.no_class || assignment.noClass) {
                    detailsHtml += `<div style="margin: 3px 0; padding: 4px; background: #F7F9FC; border-radius: 4px;">📅 ${assignment.class_slot}: N/A</div>`;
                  } else {
                    let assignHtml = `<div style="margin: 3px 0; padding: 4px; background: #F7F9FC; border-radius: 4px;">📅 ${assignment.class_slot}<br>👨‍🏫 ${assignment.substitute_teacher_name || 'Not assigned'}`;
                    if (assignment.students) {
                      const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                      if (students && students.length > 0) {
                        assignHtml += `<br>👥 ${students.map(s => s.name).join(', ')}`;
                      }
                    }
                    detailsHtml += assignHtml + '</div>';
                  }
                });
              }
            }

            if (record.has_undertime === 1 && record.undertime_reason) {
              detailsHtml += detailsHtml === '-' ? '' : '<br><br>';
              detailsHtml += `<strong>⏰ Left Early:</strong> ${record.undertime_reason}`;
              if (record.undertime_minutes) {
                detailsHtml += ` (${record.undertime_minutes} min)`;
              }
              if (record.undertimeClassAssignments && record.undertimeClassAssignments.length > 0) {
                detailsHtml += '<br><strong>Remaining Classes:</strong><br>';
                record.undertimeClassAssignments.forEach(assignment => {
                  if (assignment.online_class || assignment.onlineClass) {
                    detailsHtml += `<div style="margin: 3px 0; padding: 4px; background: #E3F2FD; border-radius: 4px;">📅 ${assignment.class_slot}: 💻 Online</div>`;
                  } else if (assignment.no_class || assignment.noClass) {
                    detailsHtml += `<div style="margin: 3px 0; padding: 4px; background: #F7F9FC; border-radius: 4px;">📅 ${assignment.class_slot}: N/A</div>`;
                  } else {
                    let assignHtml = `<div style="margin: 3px 0; padding: 4px; background: #FFF3CD; border-radius: 4px;">📅 ${assignment.class_slot}<br>👨‍🏫 ${assignment.substitute_teacher_name || 'Not assigned'}`;
                    if (assignment.students) {
                      const students = typeof assignment.students === 'string' ? JSON.parse(assignment.students) : assignment.students;
                      if (students && students.length > 0) {
                        assignHtml += `<br>👥 ${students.map(s => s.name).join(', ')}`;
                      }
                    }
                    detailsHtml += assignHtml + '</div>';
                  }
                });
              }
            }

            const dateObj = new Date(record.date + 'T00:00:00');
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            let statusBgColor = '#D1FAE5';
            let statusTextColor = '#065F46';
            if (record.status === 'late') {
              statusBgColor = '#FEF3C7';
              statusTextColor = '#92400E';
            } else if (record.status === 'absent') {
              statusBgColor = '#FEE2E2';
              statusTextColor = '#991B1B';
            }

            return `
              <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 10px 15px; vertical-align: top; font-size: 0.9rem;">${formattedDate}</td>
                <td style="padding: 10px 15px; vertical-align: top;">
                  <span style="display: inline-block; padding: 3px 10px; border-radius: 15px; font-size: 0.8rem; font-weight: 600; background: ${statusBgColor}; color: ${statusTextColor};">
                    ${record.status.toUpperCase()}
                  </span>
                </td>
                <td style="padding: 10px 15px; vertical-align: top; max-width: 500px; font-size: 0.85rem; line-height: 1.4;">${detailsHtml}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    document.body.appendChild(tempContainer);

    const canvas = await html2canvas(tempContainer, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true
    });

    document.body.removeChild(tempContainer);

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTeacherName = teacherName.replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `attendance-${safeTeacherName}-${filterStartDate || 'all'}-${filterEndDate || 'records'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      downloadBtn.disabled = false;
      downloadBtn.textContent = '📷 Download as Image';
    });
  } catch (error) {
    console.error('Error generating image:', error);
    alert('Error generating image. Please try again.');
    downloadBtn.disabled = false;
    downloadBtn.textContent = '📷 Download as Image';
  }
}
