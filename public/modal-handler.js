// Modal handling for late and absent reasons

let currentTeacherData = null;
let allStudents = [];
let allTeachers = [];
let classAssignments = {};
let lateClassAssignments = {};

// Initialize modal handlers
function initializeModals() {
  // Load students
  loadStudents();

  // Populate reason dropdowns
  populateLateReasons();
  populateAbsentReasons();
  populateUndertimeReasons();

  // Late modal handlers
  document.getElementById('lateReasonSelect').addEventListener('change', function() {
    const customContainer = document.getElementById('lateCustomReasonContainer');
    customContainer.style.display = this.value === 'Other (specify)' ? 'block' : 'none';
  });

  document.getElementById('lateSaveBtn').addEventListener('click', saveLateAttendance);
  document.getElementById('lateCancelBtn').addEventListener('click', () => closeLateModal(true));

  // Absent modal handlers
  document.getElementById('absentReasonSelect').addEventListener('change', function() {
    const customContainer = document.getElementById('absentCustomReasonContainer');
    customContainer.style.display = this.value === 'Other (specify)' ? 'block' : 'none';
  });

  document.getElementById('absentSaveBtn').addEventListener('click', saveAbsentAttendance);
  document.getElementById('absentCancelBtn').addEventListener('click', () => closeAbsentModal(true));

  // Undertime modal handlers
  document.getElementById('undertimeReasonSelect').addEventListener('change', function() {
    const customContainer = document.getElementById('undertimeCustomReasonContainer');
    customContainer.style.display = this.value === 'Other (specify)' ? 'block' : 'none';
  });

  document.getElementById('undertimeSaveBtn').addEventListener('click', saveUndertimeAttendance);
  document.getElementById('undertimeCancelBtn').addEventListener('click', () => closeUndertimeModal(true));

  // AI Auto-fill button handlers
  document.getElementById('aiAutoFillAbsentBtn').addEventListener('click', aiAutoFillAbsentSubstitutes);
  document.getElementById('aiAutoFillLateBtn').addEventListener('click', aiAutoFillLateSubstitutes);
  document.getElementById('aiAutoFillUndertimeBtn').addEventListener('click', aiAutoFillUndertimeSubstitutes);

  // Minutes late input handler - re-render slots when minutes change
  document.getElementById('lateMinutesInput').addEventListener('input', function() {
    if (currentTeacherData) {
      const classSlots = calculateClassSlots(currentTeacherData.startTime, currentTeacherData.endTime);
      const existingAssignments = Object.values(lateClassAssignments);
      renderLateClassSlots(classSlots, existingAssignments);
    }
  });

  // Minutes early (undertime) input handler - re-render slots when minutes change
  document.getElementById('undertimeMinutesInput').addEventListener('input', function() {
    if (currentTeacherData) {
      const classSlots = calculateClassSlots(currentTeacherData.startTime, currentTeacherData.endTime);
      const existingAssignments = Object.values(undertimeClassAssignments);
      renderUndertimeClassSlots(classSlots, existingAssignments);
    }
  });

  // Close modals on outside click
  document.getElementById('lateModal').addEventListener('click', function(e) {
    if (e.target === this) closeLateModal(true);
  });

  document.getElementById('absentModal').addEventListener('click', function(e) {
    if (e.target === this) closeAbsentModal(true);
  });

  document.getElementById('undertimeModal').addEventListener('click', function(e) {
    if (e.target === this) closeUndertimeModal(true);
  });
}

// Load students from API
async function loadStudents() {
  try {
    const response = await fetch(`${API_URL}/students`);
    const data = await response.json();
    if (data.success) {
      allStudents = data.students;
    }
  } catch (error) {
    console.error('Error loading students:', error);
  }
}

// Populate late reasons dropdown
function populateLateReasons() {
  const select = document.getElementById('lateReasonSelect');
  select.innerHTML = '<option value="">-- Select Reason --</option>';

  LATE_REASONS.forEach(reason => {
    const option = document.createElement('option');
    option.value = reason;
    option.textContent = reason;
    select.appendChild(option);
  });
}

// Populate absent reasons dropdown
function populateAbsentReasons() {
  const select = document.getElementById('absentReasonSelect');
  select.innerHTML = '<option value="">-- Select Reason --</option>';

  ABSENT_REASONS.forEach(reason => {
    const option = document.createElement('option');
    option.value = reason;
    option.textContent = reason;
    select.appendChild(option);
  });
}

// Open late modal
async function openLateModal(teacherData) {
  currentTeacherData = teacherData;
  lateClassAssignments = {};

  document.getElementById('lateTeacherName').textContent = teacherData.teacherName;

  // Try to load existing data
  let existingData = null;
  try {
    const selectedDate = getSelectedDate();
    const response = await fetch(`${API_URL}/attendance/teacher/${teacherData.teacherId}?date=${selectedDate}`);
    const data = await response.json();

    if (data.success && data.attendance && data.attendance.status === 'late') {
      existingData = data.attendance;
      let lateReason = data.attendance.late_reason;

      // Parse notification status from reason (format: "With notif - Traffic" or "No notif - Traffic")
      const notifiedCheckbox = document.getElementById('lateNotifiedCheckbox');
      if (lateReason.startsWith('With notif - ')) {
        notifiedCheckbox.checked = true;
        lateReason = lateReason.replace('With notif - ', '');
      } else if (lateReason.startsWith('No notif - ')) {
        notifiedCheckbox.checked = false;
        lateReason = lateReason.replace('No notif - ', '');
      } else {
        // Old format without notification prefix
        notifiedCheckbox.checked = false;
      }

      // Load minutes late
      if (data.attendance.minutes_late) {
        document.getElementById('lateMinutesInput').value = data.attendance.minutes_late;
      }

      // Check if it's a custom reason
      const standardReasons = LATE_REASONS.filter(r => r !== 'Other (specify)');
      if (standardReasons.includes(lateReason)) {
        document.getElementById('lateReasonSelect').value = lateReason;
        document.getElementById('lateCustomReasonContainer').style.display = 'none';
      } else {
        document.getElementById('lateReasonSelect').value = 'Other (specify)';
        document.getElementById('lateCustomReason').value = lateReason;
        document.getElementById('lateCustomReasonContainer').style.display = 'block';
      }
    } else {
      document.getElementById('lateReasonSelect').value = '';
      document.getElementById('lateCustomReason').value = '';
      document.getElementById('lateCustomReasonContainer').style.display = 'none';
      document.getElementById('lateNotifiedCheckbox').checked = false;
      document.getElementById('lateMinutesInput').value = '';
    }
  } catch (error) {
    console.error('Error loading late data:', error);
    document.getElementById('lateReasonSelect').value = '';
    document.getElementById('lateCustomReason').value = '';
    document.getElementById('lateCustomReasonContainer').style.display = 'none';
    document.getElementById('lateNotifiedCheckbox').checked = false;
  }

  // Calculate and display class slots for late teacher
  const classSlots = calculateClassSlots(teacherData.startTime, teacherData.endTime);
  renderLateClassSlots(classSlots, existingData?.classAssignments || []);

  document.getElementById('lateModal').classList.add('show');
}

// Close late modal
function closeLateModal(uncheckBox = false) {
  document.getElementById('lateModal').classList.remove('show');

  // Uncheck the late checkbox only if explicitly cancelled
  if (uncheckBox && currentTeacherData) {
    const lateCheckbox = document.querySelector(
      `input[data-teacher-id="${currentTeacherData.teacherId}"][data-status="late"]`
    );
    if (lateCheckbox) lateCheckbox.checked = false;
  }

  currentTeacherData = null;
  lateClassAssignments = {};
}

// Save late attendance
async function saveLateAttendance() {
  const reasonSelect = document.getElementById('lateReasonSelect');
  const customReason = document.getElementById('lateCustomReason');
  const notifiedCheckbox = document.getElementById('lateNotifiedCheckbox');
  const minutesLateInput = document.getElementById('lateMinutesInput');

  let reason = reasonSelect.value;
  if (reason === 'Other (specify)') {
    reason = customReason.value.trim();
    if (!reason) {
      alert('Please specify a custom reason');
      return;
    }
  } else if (!reason) {
    alert('Please select a reason');
    return;
  }

  // Get minutes late value
  const minutesLate = minutesLateInput.value ? parseInt(minutesLateInput.value) : null;

  // Combine notification status with reason
  const notificationPrefix = notifiedCheckbox.checked ? 'With notif' : 'No notif';
  const fullReason = `${notificationPrefix} - ${reason}`;

  if (!currentTeacherData) return;

  const statusElement = document.getElementById(`status-${currentTeacherData.teacherId}`);

  try {
    statusElement.textContent = 'Saving...';
    statusElement.className = 'save-status saving';

    const lateClassAssignmentsArray = Object.values(lateClassAssignments);

    const response = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: getSelectedDate(),
        attendance: [{
          teacherId: currentTeacherData.teacherId,
          teacherName: currentTeacherData.teacherName,
          startTime: currentTeacherData.startTime,
          endTime: currentTeacherData.endTime,
          status: 'late',
          lateReason: fullReason,
          minutesLate: minutesLate,
          classAssignments: lateClassAssignmentsArray
        }]
      })
    });

    const data = await response.json();

    if (data.success) {
      statusElement.textContent = '✓ Saved';
      statusElement.className = 'save-status saved';

      // Refresh the daily report to keep it in sync
      refreshDailyReportSilently();

      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'save-status';
      }, 2000);

      closeLateModal();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error saving late attendance:', error);
    statusElement.textContent = '✗ Error';
    statusElement.className = 'save-status error';
  }
}

// Open absent modal
async function openAbsentModal(teacherData) {
  currentTeacherData = teacherData;
  classAssignments = {};

  document.getElementById('absentTeacherName').textContent = teacherData.teacherName;

  // Try to load existing data
  let existingData = null;
  try {
    const selectedDate = getSelectedDate();
    const response = await fetch(`${API_URL}/attendance/teacher/${teacherData.teacherId}?date=${selectedDate}`);
    const data = await response.json();

    if (data.success && data.attendance && data.attendance.status === 'absent') {
      existingData = data.attendance;

      const absentReason = data.attendance.absent_reason;

      // Check if it's a custom reason
      const standardReasons = ABSENT_REASONS.filter(r => r !== 'Other (specify)');
      if (standardReasons.includes(absentReason)) {
        document.getElementById('absentReasonSelect').value = absentReason;
        document.getElementById('absentCustomReasonContainer').style.display = 'none';
      } else {
        document.getElementById('absentReasonSelect').value = 'Other (specify)';
        document.getElementById('absentCustomReason').value = absentReason;
        document.getElementById('absentCustomReasonContainer').style.display = 'block';
      }
    } else {
      document.getElementById('absentReasonSelect').value = '';
      document.getElementById('absentCustomReason').value = '';
      document.getElementById('absentCustomReasonContainer').style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading absent data:', error);
    document.getElementById('absentReasonSelect').value = '';
    document.getElementById('absentCustomReason').value = '';
    document.getElementById('absentCustomReasonContainer').style.display = 'none';
  }

  // Calculate and display class slots
  const classSlots = calculateClassSlots(teacherData.startTime, teacherData.endTime);
  renderClassSlots(classSlots, existingData?.classAssignments || []);

  document.getElementById('absentModal').classList.add('show');
}

// Close absent modal
function closeAbsentModal(uncheckBox = false) {
  document.getElementById('absentModal').classList.remove('show');

  // Uncheck the absent checkbox only if explicitly cancelled
  if (uncheckBox && currentTeacherData) {
    const absentCheckbox = document.querySelector(
      `input[data-teacher-id="${currentTeacherData.teacherId}"][data-status="absent"]`
    );
    if (absentCheckbox) absentCheckbox.checked = false;
  }

  currentTeacherData = null;
  classAssignments = {};
}

// Render class slots in the modal
async function renderClassSlots(classSlots, existingAssignments = []) {
  const container = document.getElementById('classSlotsList');

  if (classSlots.length === 0) {
    container.innerHTML = '<p class="info-text">No class slots found for this teacher\'s shift.</p>';
    return;
  }

  // Filter out teachers who are absent (but keep late teachers - they may be available for later slots)
  const availableTeachers = teachers.filter(t => {
    const attendance = attendanceData[t.id];
    // Exclude only if status is 'absent'
    return !attendance || attendance.status !== 'absent';
  });

  // Create a map of existing assignments by class slot
  const assignmentMap = {};
  existingAssignments.forEach(assignment => {
    assignmentMap[assignment.class_slot] = assignment;
  });

  // Fetch busy teachers, assigned substitutes, and scheduled students for all slots in parallel
  const busyTeachersPromises = classSlots.map(slot =>
    getBusyTeachers(getSelectedDate(), slot.label)
  );
  const assignedSubstitutesPromises = classSlots.map(slot =>
    getAssignedSubstitutes(getSelectedDate(), slot.label)
  );
  const scheduledStudentsPromises = classSlots.map(slot =>
    getScheduledStudents(getSelectedDate(), slot.label, currentTeacherData.teacherName)
  );

  const [busyTeachersPerSlot, assignedSubstitutesPerSlot, scheduledStudentsPerSlot] = await Promise.all([
    Promise.all(busyTeachersPromises),
    Promise.all(assignedSubstitutesPromises),
    Promise.all(scheduledStudentsPromises)
  ]);

  container.innerHTML = classSlots.map((slot, index) => {
    const existingAssignment = assignmentMap[slot.label];
    const noClass = existingAssignment?.noClass || false;
    const onlineClass = existingAssignment?.onlineClass || false;
    const substituteId = existingAssignment?.substitute_teacher_id || '';

    // Get busy teachers, assigned substitutes, and scheduled students for this specific slot
    const busyTeachers = busyTeachersPerSlot[index] || [];
    const assignedSubstitutes = assignedSubstitutesPerSlot[index] || [];
    const scheduledStudents = scheduledStudentsPerSlot[index] || [];

    // Filter teachers who are:
    // 1. Available for THIS specific time slot (considering late arrivals)
    // 2. Not already assigned to classes at this time
    // 3. Not already assigned as substitute for another teacher
    const slotAvailableTeachers = availableTeachers.filter(t => {
      const shiftCovers = isLateTeacherAvailableForSlot(t, slot.label, attendanceData);
      const notBusy = isTeacherNotBusy(t, busyTeachers, assignedSubstitutes);

      if (!shiftCovers) {
        console.log(`[Filter] ${t.name} EXCLUDED - shift doesn't cover ${slot.label} or will arrive too late`);
      }
      if (!notBusy) {
        console.log(`[Filter] ${t.name} EXCLUDED - busy or already substitute`);
      }

      return shiftCovers && notBusy;
    });

    return `
    <div class="class-slot-card" data-slot-index="${index}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h5 style="margin: 0;">${slot.label}</h5>
        <div style="display: flex; gap: 15px;">
          <label style="display: flex; align-items: center; gap: 5px; margin: 0;">
            <input type="checkbox" class="no-class-checkbox" data-slot="${slot.label}" data-index="${index}" ${noClass ? 'checked' : ''}>
            N/A
          </label>
          <label style="display: flex; align-items: center; gap: 5px; margin: 0;">
            <input type="checkbox" class="online-class-checkbox" data-slot="${slot.label}" data-index="${index}" ${onlineClass ? 'checked' : ''}>
            Online class
          </label>
        </div>
      </div>

      <div class="class-details" id="class-details-${index}" style="${(noClass || onlineClass) ? 'display: none;' : ''}">
        <label>Substitute Teacher:</label>
        <select class="sub-teacher-select" data-slot="${slot.label}">
          <option value="">-- Select Substitute --</option>
          ${slotAvailableTeachers.map(t => `<option value="${t.id}" data-name="${t.name}" ${t.id === substituteId ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>

        <label>Students:</label>
        <select class="students-select" data-slot="${slot.label}" multiple size="5">
          ${allStudents.map(s => {
            // Auto-select if in scheduled students (match by name) OR in existing assignment (match by ID)
            const isScheduled = scheduledStudents.some(student =>
              student.name.trim().toLowerCase() === s.name.trim().toLowerCase()
            );
            const isInExisting = existingAssignment?.students?.some(student => student.id === s.id) || false;
            const isSelected = isScheduled || isInExisting;
            return `<option value="${s.id}" data-name="${s.name}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
          }).join('')}
        </select>

        <div class="student-chips" id="students-chips-${index}"></div>
      </div>
    </div>
  `;
  }).join('');

  // Add event listeners for substitute and student selection
  container.querySelectorAll('.sub-teacher-select').forEach(select => {
    select.addEventListener('change', function() {
      const slot = this.dataset.slot;
      const teacherId = this.value;
      const teacherName = this.options[this.selectedIndex].dataset.name;

      if (!classAssignments[slot]) {
        classAssignments[slot] = { classSlot: slot, students: [] };
      }

      classAssignments[slot].substituteTeacherId = teacherId;
      classAssignments[slot].substituteTeacherName = teacherName;
    });
  });

  container.querySelectorAll('.students-select').forEach(select => {
    select.addEventListener('change', function() {
      const slot = this.dataset.slot;
      const selectedStudents = Array.from(this.selectedOptions).map(opt => ({
        id: opt.value,
        name: opt.dataset.name
      }));

      if (!classAssignments[slot]) {
        classAssignments[slot] = { classSlot: slot };
      }

      classAssignments[slot].students = selectedStudents;

      // Update chips display
      const slotIndex = this.closest('.class-slot-card').dataset.slotIndex;
      renderStudentChips(slotIndex, selectedStudents);
    });
  });

  // Add event listeners for "no class" checkboxes
  container.querySelectorAll('.no-class-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const index = this.dataset.index;
      const slot = this.dataset.slot;
      const detailsDiv = document.getElementById(`class-details-${index}`);
      const onlineCheckbox = container.querySelector(`.online-class-checkbox[data-index="${index}"]`);

      if (this.checked) {
        // Uncheck online class (mutually exclusive)
        onlineCheckbox.checked = false;

        // Hide class details
        detailsDiv.style.display = 'none';

        // Mark this slot as "no class" in assignments
        if (!classAssignments[slot]) {
          classAssignments[slot] = { classSlot: slot };
        }
        classAssignments[slot].noClass = true;
        classAssignments[slot].onlineClass = false;
        classAssignments[slot].substituteTeacherId = null;
        classAssignments[slot].substituteTeacherName = null;
        classAssignments[slot].students = [];
      } else {
        // Show class details
        detailsDiv.style.display = 'block';

        // Remove "no class" flag
        if (classAssignments[slot]) {
          delete classAssignments[slot].noClass;
        }
      }
    });
  });

  // Add event listeners for "online class" checkboxes
  container.querySelectorAll('.online-class-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const index = this.dataset.index;
      const slot = this.dataset.slot;
      const detailsDiv = document.getElementById(`class-details-${index}`);
      const noClassCheckbox = container.querySelector(`.no-class-checkbox[data-index="${index}"]`);

      if (this.checked) {
        // Uncheck no class (mutually exclusive)
        noClassCheckbox.checked = false;

        // Hide class details (online doesn't need substitute)
        detailsDiv.style.display = 'none';

        // Mark this slot as "online class" in assignments
        if (!classAssignments[slot]) {
          classAssignments[slot] = { classSlot: slot };
        }
        classAssignments[slot].onlineClass = true;
        classAssignments[slot].noClass = false;
        classAssignments[slot].substituteTeacherId = null;
        classAssignments[slot].substituteTeacherName = null;
        classAssignments[slot].students = [];
      } else {
        // Show class details
        detailsDiv.style.display = 'block';

        // Remove "online class" flag
        if (classAssignments[slot]) {
          delete classAssignments[slot].onlineClass;
        }
      }
    });
  });

  // Pre-populate classAssignments and student chips with existing data AND scheduled students
  classSlots.forEach((slot, slotIndex) => {
    const existingAssignment = assignmentMap[slot.label];
    const scheduledStudents = scheduledStudentsPerSlot[slotIndex] || [];

    // Determine which students to show
    let studentsToShow = [];
    if (existingAssignment?.students && existingAssignment.students.length > 0) {
      // Use existing assignment if it exists
      studentsToShow = existingAssignment.students;
    } else if (scheduledStudents.length > 0) {
      // Otherwise use scheduled students from scheduling app - match by name to get Notion IDs
      studentsToShow = scheduledStudents.map(scheduledStudent => {
        // Find matching student in allStudents (Notion) by name
        const matchingStudent = allStudents.find(s =>
          s.name.trim().toLowerCase() === scheduledStudent.name.trim().toLowerCase()
        );
        return matchingStudent ? { id: matchingStudent.id, name: matchingStudent.name } : null;
      }).filter(s => s !== null); // Remove students that couldn't be matched
    }

    // Pre-populate classAssignments with the data
    if (existingAssignment || scheduledStudents.length > 0) {
      classAssignments[slot.label] = {
        classSlot: slot.label,
        noClass: existingAssignment?.noClass || false,
        onlineClass: existingAssignment?.onlineClass || false,
        substituteTeacherId: existingAssignment?.substitute_teacher_id,
        substituteTeacherName: existingAssignment?.substitute_teacher_name,
        students: studentsToShow
      };
    }

    // Render student chips for auto-selected students
    if (studentsToShow.length > 0) {
      renderStudentChips(slotIndex, studentsToShow);
    }
  });
}

// Render student chips
function renderStudentChips(slotIndex, students) {
  const container = document.getElementById(`students-chips-${slotIndex}`);

  if (students.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = students.map(student => `
    <div class="student-chip">
      ${student.name}
    </div>
  `).join('');
}

// Render class slots for late modal
async function renderLateClassSlots(classSlots, existingAssignments = []) {
  const container = document.getElementById('lateClassSlotsList');

  if (classSlots.length === 0) {
    container.innerHTML = '<p class="info-text">No class slots found for this teacher\'s shift.</p>';
    return;
  }

  // Filter out teachers who are absent (but keep late teachers - they may be available for later slots)
  const availableTeachers = teachers.filter(t => {
    const attendance = attendanceData[t.id];
    // Exclude only if status is 'absent'
    return !attendance || attendance.status !== 'absent';
  });

  // Create a map of existing assignments by class slot
  const assignmentMap = {};
  existingAssignments.forEach(assignment => {
    assignmentMap[assignment.class_slot] = assignment;
  });

  // Fetch busy teachers, assigned substitutes, and scheduled students for all slots in parallel
  const busyTeachersPromises = classSlots.map(slot =>
    getBusyTeachers(getSelectedDate(), slot.label)
  );
  const assignedSubstitutesPromises = classSlots.map(slot =>
    getAssignedSubstitutes(getSelectedDate(), slot.label)
  );
  const scheduledStudentsPromises = classSlots.map(slot =>
    getScheduledStudents(getSelectedDate(), slot.label, currentTeacherData.teacherName)
  );

  const [busyTeachersPerSlot, assignedSubstitutesPerSlot, scheduledStudentsPerSlot] = await Promise.all([
    Promise.all(busyTeachersPromises),
    Promise.all(assignedSubstitutesPromises),
    Promise.all(scheduledStudentsPromises)
  ]);

  // Get minutes late from input to determine which slots need substitutes
  const minutesLateInput = document.getElementById('lateMinutesInput');
  const minutesLate = minutesLateInput.value ? parseInt(minutesLateInput.value) : 0;
  const slotsNeedingSub = getSlotsNeedingSubstitute(currentTeacherData, minutesLate);

  console.log(`[Late Modal] Minutes late: ${minutesLate}, Slots needing substitute:`, slotsNeedingSub);

  container.innerHTML = classSlots.map((slot, index) => {
    const existingAssignment = assignmentMap[slot.label];
    const noClass = existingAssignment?.noClass || false;
    const onlineClass = existingAssignment?.onlineClass || false;
    const substituteId = existingAssignment?.substitute_teacher_id || '';

    // Check if this slot needs a substitute based on minutes late
    const needsSubstitute = slotsNeedingSub.includes(slot.label);
    const willBePresent = !needsSubstitute;

    // Get busy teachers, assigned substitutes, and scheduled students for this specific slot
    const busyTeachers = busyTeachersPerSlot[index] || [];
    const assignedSubstitutes = assignedSubstitutesPerSlot[index] || [];
    const scheduledStudents = scheduledStudentsPerSlot[index] || [];

    // Filter teachers who are available for THIS specific time slot (considering late arrivals) AND not busy with classes or substitutes
    const slotAvailableTeachers = availableTeachers.filter(t =>
      isLateTeacherAvailableForSlot(t, slot.label, attendanceData) && isTeacherNotBusy(t, busyTeachers, assignedSubstitutes)
    );

    return `
    <div class="class-slot-card" data-slot-index="${index}" ${willBePresent ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h5 style="margin: 0;">${slot.label} ${willBePresent ? '<span style="color: #28a745; font-weight: normal; font-size: 14px;">(Teacher will be present)</span>' : ''}</h5>
        <div style="display: flex; gap: 15px;"${willBePresent ? ' style="display: none;"' : ''}>
          <label style="display: flex; align-items: center; gap: 5px; margin: 0;">
            <input type="checkbox" class="late-no-class-checkbox" data-slot="${slot.label}" data-index="${index}" ${noClass ? 'checked' : ''}>
            N/A
          </label>
          <label style="display: flex; align-items: center; gap: 5px; margin: 0;">
            <input type="checkbox" class="late-online-class-checkbox" data-slot="${slot.label}" data-index="${index}" ${onlineClass ? 'checked' : ''}>
            Online class
          </label>
        </div>
      </div>

      <div class="late-class-details" id="late-class-details-${index}" style="${(noClass || onlineClass) ? 'display: none;' : ''}">
        <label>Substitute Teacher:</label>
        <select class="late-sub-teacher-select" data-slot="${slot.label}">
          <option value="">-- Select Substitute --</option>
          ${slotAvailableTeachers.map(t => `<option value="${t.id}" data-name="${t.name}" ${t.id === substituteId ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>

        <label>Students:</label>
        <select class="late-students-select" data-slot="${slot.label}" multiple size="5">
          ${allStudents.map(s => {
            // Auto-select if in scheduled students (match by name) OR in existing assignment (match by ID)
            const isScheduled = scheduledStudents.some(student =>
              student.name.trim().toLowerCase() === s.name.trim().toLowerCase()
            );
            const isInExisting = existingAssignment?.students?.some(student => student.id === s.id) || false;
            const isSelected = isScheduled || isInExisting;
            return `<option value="${s.id}" data-name="${s.name}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
          }).join('')}
        </select>

        <div class="student-chips" id="late-students-chips-${index}"></div>
      </div>
    </div>
  `;
  }).join('');

  // Add event listeners for substitute and student selection
  container.querySelectorAll('.late-sub-teacher-select').forEach(select => {
    select.addEventListener('change', function() {
      const slot = this.dataset.slot;
      const teacherId = this.value;
      const teacherName = this.options[this.selectedIndex].dataset.name;

      if (!lateClassAssignments[slot]) {
        lateClassAssignments[slot] = { classSlot: slot, students: [] };
      }

      lateClassAssignments[slot].substituteTeacherId = teacherId;
      lateClassAssignments[slot].substituteTeacherName = teacherName;
    });
  });

  container.querySelectorAll('.late-students-select').forEach(select => {
    select.addEventListener('change', function() {
      const slot = this.dataset.slot;
      const selectedStudents = Array.from(this.selectedOptions).map(opt => ({
        id: opt.value,
        name: opt.dataset.name
      }));

      if (!lateClassAssignments[slot]) {
        lateClassAssignments[slot] = { classSlot: slot };
      }

      lateClassAssignments[slot].students = selectedStudents;

      // Update chips display
      const slotIndex = this.closest('.class-slot-card').dataset.slotIndex;
      renderLateStudentChips(slotIndex, selectedStudents);
    });
  });

  // Add event listeners for "no class" checkboxes
  container.querySelectorAll('.late-no-class-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const index = this.dataset.index;
      const slot = this.dataset.slot;
      const detailsDiv = document.getElementById(`late-class-details-${index}`);
      const onlineCheckbox = container.querySelector(`.late-online-class-checkbox[data-index="${index}"]`);

      if (this.checked) {
        // Uncheck online class (mutually exclusive)
        onlineCheckbox.checked = false;

        // Hide class details
        detailsDiv.style.display = 'none';

        // Mark this slot as "no class" in assignments
        if (!lateClassAssignments[slot]) {
          lateClassAssignments[slot] = { classSlot: slot };
        }
        lateClassAssignments[slot].noClass = true;
        lateClassAssignments[slot].onlineClass = false;
        lateClassAssignments[slot].substituteTeacherId = null;
        lateClassAssignments[slot].substituteTeacherName = null;
        lateClassAssignments[slot].students = [];
      } else {
        // Show class details
        detailsDiv.style.display = 'block';

        // Remove "no class" flag
        if (lateClassAssignments[slot]) {
          delete lateClassAssignments[slot].noClass;
        }
      }
    });
  });

  // Add event listeners for "online class" checkboxes
  container.querySelectorAll('.late-online-class-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const index = this.dataset.index;
      const slot = this.dataset.slot;
      const detailsDiv = document.getElementById(`late-class-details-${index}`);
      const noClassCheckbox = container.querySelector(`.late-no-class-checkbox[data-index="${index}"]`);

      if (this.checked) {
        // Uncheck no class (mutually exclusive)
        noClassCheckbox.checked = false;

        // Hide class details (online doesn't need substitute)
        detailsDiv.style.display = 'none';

        // Mark this slot as "online class" in assignments
        if (!lateClassAssignments[slot]) {
          lateClassAssignments[slot] = { classSlot: slot };
        }
        lateClassAssignments[slot].onlineClass = true;
        lateClassAssignments[slot].noClass = false;
        lateClassAssignments[slot].substituteTeacherId = null;
        lateClassAssignments[slot].substituteTeacherName = null;
        lateClassAssignments[slot].students = [];
      } else {
        // Show class details
        detailsDiv.style.display = 'block';

        // Remove "online class" flag
        if (lateClassAssignments[slot]) {
          delete lateClassAssignments[slot].onlineClass;
        }
      }
    });
  });

  // Pre-populate lateClassAssignments and student chips with existing data or scheduled students
  classSlots.forEach((slot, slotIndex) => {
    const existingAssignment = existingAssignments.find(a => a.class_slot === slot.label);
    const scheduledStudents = scheduledStudentsPerSlot[slotIndex] || [];

    // Get students from existing assignment
    const existingStudents = existingAssignment?.students || [];

    // Match scheduled students by name to get their Notion IDs from allStudents
    const matchedScheduledStudents = scheduledStudents.map(scheduledStudent => {
      const match = allStudents.find(s =>
        s.name.trim().toLowerCase() === scheduledStudent.name.trim().toLowerCase()
      );
      return match ? { id: match.id, name: match.name } : null;
    }).filter(s => s !== null);

    // Combine existing and newly scheduled students (avoid duplicates)
    const combinedStudents = [...existingStudents];
    matchedScheduledStudents.forEach(scheduled => {
      if (!combinedStudents.some(existing => existing.id === scheduled.id)) {
        combinedStudents.push(scheduled);
      }
    });

    // Pre-populate lateClassAssignments
    if (existingAssignment || combinedStudents.length > 0) {
      lateClassAssignments[slot.label] = {
        classSlot: slot.label,
        noClass: existingAssignment?.noClass || false,
        onlineClass: existingAssignment?.onlineClass || false,
        substituteTeacherId: existingAssignment?.substitute_teacher_id || '',
        substituteTeacherName: existingAssignment?.substitute_teacher_name || '',
        students: combinedStudents
      };

      // Render student chips if there are students to show
      if (combinedStudents.length > 0) {
        renderLateStudentChips(slotIndex, combinedStudents);
      }
    }
  });
}

// Render student chips for late modal
function renderLateStudentChips(slotIndex, students) {
  const container = document.getElementById(`late-students-chips-${slotIndex}`);

  if (!container) return;

  if (students.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = students.map(student => `
    <div class="student-chip">
      ${student.name}
    </div>
  `).join('');
}

// Save absent attendance
async function saveAbsentAttendance() {
  const reasonSelect = document.getElementById('absentReasonSelect');
  const customReason = document.getElementById('absentCustomReason');

  let reason = reasonSelect.value;
  if (reason === 'Other (specify)') {
    reason = customReason.value.trim();
    if (!reason) {
      alert('Please specify a custom reason');
      return;
    }
  } else if (!reason) {
    alert('Please select a reason');
    return;
  }

  if (!currentTeacherData) return;

  const statusElement = document.getElementById(`status-${currentTeacherData.teacherId}`);

  // Auto-detect official leave type from reason
  let officialLeaveType = null;
  if (reason === 'Official sick leave') {
    officialLeaveType = 'sick';
  } else if (reason === 'Official vacation leave') {
    officialLeaveType = 'vacation';
  }

  try {
    statusElement.textContent = 'Saving...';
    statusElement.className = 'save-status saving';

    const classAssignmentsArray = Object.values(classAssignments);

    const response = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: getSelectedDate(),
        attendance: [{
          teacherId: currentTeacherData.teacherId,
          teacherName: currentTeacherData.teacherName,
          startTime: currentTeacherData.startTime,
          endTime: currentTeacherData.endTime,
          status: 'absent',
          absentReason: reason,
          classAssignments: classAssignmentsArray,
          officialLeaveType: officialLeaveType
        }]
      })
    });

    const data = await response.json();

    if (data.success) {
      statusElement.textContent = '✓ Saved';
      statusElement.className = 'save-status saved';

      // Refresh the daily report to keep it in sync
      refreshDailyReportSilently();

      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'save-status';
      }, 2000);

      closeAbsentModal();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error saving absent attendance:', error);
    statusElement.textContent = '✗ Error';
    statusElement.className = 'save-status error';
  }
}

// AI Auto-fill for absent modal
async function aiAutoFillAbsentSubstitutes() {
  if (!currentTeacherData) return;

  const statusSpan = document.getElementById('aiAutoFillAbsentStatus');
  const button = document.getElementById('aiAutoFillAbsentBtn');

  try {
    button.disabled = true;
    statusSpan.textContent = '🤖 Analyzing...';

    // Get class slots for this teacher
    const classSlots = calculateClassSlots(currentTeacherData.startTime, currentTeacherData.endTime);

    // Get available teachers (filtered by attendance status, shift, busy schedule, etc.)
    const date = getSelectedDate();

    // Filter teachers same way as renderClassSlots does
    const availableTeachers = teachers.filter(t => {
      const attendance = attendanceData[t.id];
      return !attendance || attendance.status !== 'absent';
    });

    // Track teachers assigned in this session to prevent double-booking
    const alreadyAssignedInSession = new Set();
    const recommendations = [];

    // Process each slot sequentially to avoid assigning same teacher multiple times
    for (const slot of classSlots) {
      const busyTeachers = await getBusyTeachers(date, slot.label);
      const assignedSubstitutes = await getAssignedSubstitutes(date, slot.label);

      // Add teachers assigned in this session to the assignedSubstitutes list
      const allAssignedSubs = [...assignedSubstitutes, ...Array.from(alreadyAssignedInSession)];

      const slotAvailableTeachers = availableTeachers.filter(t =>
        isLateTeacherAvailableForSlot(t, slot.label, attendanceData) &&
        isTeacherNotBusy(t, busyTeachers, allAssignedSubs)
      );

      if (slotAvailableTeachers.length === 0) {
        console.warn(`[AI Auto-fill] No available teachers for slot ${slot.label}`);
        continue;
      }

      // Call AI API for this specific slot
      const response = await fetch(`${API_URL}/ai-auto-fill-substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date,
          teacherId: currentTeacherData.teacherId,
          teacherName: currentTeacherData.teacherName,
          classSlots: [slot],
          availableTeachers: slotAvailableTeachers
        })
      });

      const data = await response.json();

      if (data.success && data.recommendations && data.recommendations.length > 0) {
        const rec = data.recommendations[0];
        recommendations.push(rec);

        // Track this teacher as assigned so they won't be selected for next slots
        if (rec.substituteTeacherId) {
          // Extract nickname from teacher name
          const teacher = slotAvailableTeachers.find(t => t.id === rec.substituteTeacherId);
          if (teacher) {
            const nicknameMatch = teacher.name.match(/\[([^\]]+)\]/);
            const nickname = nicknameMatch ? nicknameMatch[1].trim().toLowerCase() : teacher.name.trim().toLowerCase();
            alreadyAssignedInSession.add(nickname);
            console.log(`[AI Auto-fill] Assigned ${teacher.name} to ${slot.label}, nickname: ${nickname}`);
          }
        }
      }
    }

    if (recommendations.length > 0) {
      console.log('[AI Auto-fill] All recommendations:', recommendations);

      // Apply recommendations to UI
      recommendations.forEach((rec, index) => {
        const slot = rec.classSlot;

        // Set substitute teacher
        if (rec.substituteTeacherId) {
          const selectElement = document.querySelector(`.sub-teacher-select[data-slot="${slot}"]`);
          if (selectElement) {
            selectElement.value = rec.substituteTeacherId;

            // Update classAssignments
            if (!classAssignments[slot]) {
              classAssignments[slot] = { classSlot: slot, students: [] };
            }
            classAssignments[slot].substituteTeacherId = rec.substituteTeacherId;
            classAssignments[slot].substituteTeacherName = rec.substituteTeacherName;
          }
        }

        // Set students
        if (rec.students && rec.students.length > 0) {
          // Match students by name to get Notion IDs
          const matchedStudents = rec.students.map(scheduledStudent => {
            const match = allStudents.find(s =>
              s.name.trim().toLowerCase() === scheduledStudent.name.trim().toLowerCase()
            );
            return match ? { id: match.id, name: match.name } : null;
          }).filter(s => s !== null);

          const studentsSelect = document.querySelector(`.students-select[data-slot="${slot}"]`);
          if (studentsSelect) {
            // Select the students in the multi-select
            Array.from(studentsSelect.options).forEach(option => {
              option.selected = matchedStudents.some(s => s.id === option.value);
            });

            // Update classAssignments
            if (!classAssignments[slot]) {
              classAssignments[slot] = { classSlot: slot };
            }
            classAssignments[slot].students = matchedStudents;

            // Render student chips
            const slotCard = studentsSelect.closest('.class-slot-card');
            const slotIndex = slotCard?.dataset.slotIndex;
            if (slotIndex !== undefined) {
              renderStudentChips(slotIndex, matchedStudents);
            }
          }
        }
      });

      statusSpan.textContent = '✓ Applied! (AI scores in console)';
      statusSpan.style.color = '#28a745';

      setTimeout(() => {
        statusSpan.textContent = '';
      }, 3000);
    } else {
      throw new Error(data.error || 'Failed to get recommendations');
    }
  } catch (error) {
    console.error('Error in AI auto-fill:', error);
    statusSpan.textContent = '✗ Error';
    statusSpan.style.color = '#dc3545';
  } finally {
    button.disabled = false;
  }
}

// AI Auto-fill for late modal
async function aiAutoFillLateSubstitutes() {
  if (!currentTeacherData) return;

  const statusSpan = document.getElementById('aiAutoFillLateStatus');
  const button = document.getElementById('aiAutoFillLateBtn');

  try {
    button.disabled = true;
    statusSpan.textContent = '🤖 Analyzing...';

    // Get class slots for this teacher
    const classSlots = calculateClassSlots(currentTeacherData.startTime, currentTeacherData.endTime);

    // Get minutes late and filter to only slots needing substitutes
    const minutesLateInput = document.getElementById('lateMinutesInput');
    const minutesLate = minutesLateInput.value ? parseInt(minutesLateInput.value) : 0;

    if (!minutesLate || minutesLate === 0) {
      statusSpan.textContent = 'Please enter minutes late first';
      statusSpan.style.color = '#ffc107';
      button.disabled = false;
      return;
    }

    const slotsNeedingSub = getSlotsNeedingSubstitute(currentTeacherData, minutesLate);
    const slotsToProcess = classSlots.filter(slot => slotsNeedingSub.includes(slot.label));

    if (slotsToProcess.length === 0) {
      statusSpan.textContent = 'Teacher will be present for all slots';
      statusSpan.style.color = '#28a745';
      button.disabled = false;
      setTimeout(() => { statusSpan.textContent = ''; }, 3000);
      return;
    }

    console.log(`[AI Auto-fill Late] Processing ${slotsToProcess.length} slots needing substitute:`, slotsToProcess.map(s => s.label));

    // Get available teachers
    const date = getSelectedDate();

    const availableTeachers = teachers.filter(t => {
      const attendance = attendanceData[t.id];
      return !attendance || attendance.status !== 'absent';
    });

    // Track teachers assigned in this session to prevent double-booking
    const alreadyAssignedInSession = new Set();
    const recommendations = [];

    // Process each slot sequentially to avoid assigning same teacher multiple times
    for (const slot of slotsToProcess) {
      const busyTeachers = await getBusyTeachers(date, slot.label);
      const assignedSubstitutes = await getAssignedSubstitutes(date, slot.label);

      // Add teachers assigned in this session to the assignedSubstitutes list
      const allAssignedSubs = [...assignedSubstitutes, ...Array.from(alreadyAssignedInSession)];

      const slotAvailableTeachers = availableTeachers.filter(t =>
        isLateTeacherAvailableForSlot(t, slot.label, attendanceData) &&
        isTeacherNotBusy(t, busyTeachers, allAssignedSubs)
      );

      if (slotAvailableTeachers.length === 0) {
        console.warn(`[AI Auto-fill] No available teachers for slot ${slot.label}`);
        continue;
      }

      // Call AI API for this specific slot
      const response = await fetch(`${API_URL}/ai-auto-fill-substitute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date,
          teacherId: currentTeacherData.teacherId,
          teacherName: currentTeacherData.teacherName,
          classSlots: [slot],
          availableTeachers: slotAvailableTeachers
        })
      });

      const data = await response.json();

      if (data.success && data.recommendations && data.recommendations.length > 0) {
        const rec = data.recommendations[0];
        recommendations.push(rec);

        // Track this teacher as assigned so they won't be selected for next slots
        if (rec.substituteTeacherId) {
          const teacher = slotAvailableTeachers.find(t => t.id === rec.substituteTeacherId);
          if (teacher) {
            const nicknameMatch = teacher.name.match(/\[([^\]]+)\]/);
            const nickname = nicknameMatch ? nicknameMatch[1].trim().toLowerCase() : teacher.name.trim().toLowerCase();
            alreadyAssignedInSession.add(nickname);
            console.log(`[AI Auto-fill] Assigned ${teacher.name} to ${slot.label}, nickname: ${nickname}`);
          }
        }
      }
    }

    if (recommendations.length > 0) {
      console.log('[AI Auto-fill] All recommendations:', recommendations);

      // Apply recommendations to UI
      recommendations.forEach((rec, index) => {
        const slot = rec.classSlot;

        // Set substitute teacher
        if (rec.substituteTeacherId) {
          const selectElement = document.querySelector(`.late-sub-teacher-select[data-slot="${slot}"]`);
          if (selectElement) {
            selectElement.value = rec.substituteTeacherId;

            // Update lateClassAssignments
            if (!lateClassAssignments[slot]) {
              lateClassAssignments[slot] = { classSlot: slot, students: [] };
            }
            lateClassAssignments[slot].substituteTeacherId = rec.substituteTeacherId;
            lateClassAssignments[slot].substituteTeacherName = rec.substituteTeacherName;
          }
        }

        // Set students
        if (rec.students && rec.students.length > 0) {
          const matchedStudents = rec.students.map(scheduledStudent => {
            const match = allStudents.find(s =>
              s.name.trim().toLowerCase() === scheduledStudent.name.trim().toLowerCase()
            );
            return match ? { id: match.id, name: match.name } : null;
          }).filter(s => s !== null);

          const studentsSelect = document.querySelector(`.late-students-select[data-slot="${slot}"]`);
          if (studentsSelect) {
            Array.from(studentsSelect.options).forEach(option => {
              option.selected = matchedStudents.some(s => s.id === option.value);
            });

            if (!lateClassAssignments[slot]) {
              lateClassAssignments[slot] = { classSlot: slot };
            }
            lateClassAssignments[slot].students = matchedStudents;

            const slotCard = studentsSelect.closest('.class-slot-card');
            const slotIndex = slotCard?.dataset.slotIndex;
            if (slotIndex !== undefined) {
              renderLateStudentChips(slotIndex, matchedStudents);
            }
          }
        }
      });

      statusSpan.textContent = '✓ Applied! (AI scores in console)';
      statusSpan.style.color = '#28a745';

      setTimeout(() => {
        statusSpan.textContent = '';
      }, 3000);
    } else {
      throw new Error(data.error || 'Failed to get recommendations');
    }
  } catch (error) {
    console.error('Error in AI auto-fill:', error);
    statusSpan.textContent = '✗ Error';
    statusSpan.style.color = '#dc3545';
  } finally {
    button.disabled = false;
  }
}
