// Undertime modal handling
let undertimeClassAssignments = {};

// Populate undertime reasons dropdown
function populateUndertimeReasons() {
  const select = document.getElementById('undertimeReasonSelect');
  select.innerHTML = '<option value="">-- Select Reason --</option>';

  UNDERTIME_REASONS.forEach(reason => {
    const option = document.createElement('option');
    option.value = reason;
    option.textContent = reason;
    select.appendChild(option);
  });
}

// Open undertime modal
async function openUndertimeModal(teacherData) {
  currentTeacherData = teacherData;
  undertimeClassAssignments = {};

  document.getElementById('undertimeTeacherName').textContent = teacherData.teacherName;

  // Try to load existing data
  let existingData = null;
  try {
    const selectedDate = getSelectedDate();
    const response = await fetch(`${API_URL}/attendance/teacher/${teacherData.teacherId}?date=${selectedDate}`);
    const data = await response.json();

    if (data.success && data.attendance && data.attendance.has_undertime === 1) {
      existingData = data.attendance;

      // Load undertime minutes
      if (data.attendance.undertime_minutes) {
        document.getElementById('undertimeMinutesInput').value = data.attendance.undertime_minutes;
      }

      // Load undertime reason
      const undertimeReason = data.attendance.undertime_reason;
      const standardReasons = UNDERTIME_REASONS.filter(r => r !== 'Other (specify)');
      if (standardReasons.includes(undertimeReason)) {
        document.getElementById('undertimeReasonSelect').value = undertimeReason;
        document.getElementById('undertimeCustomReasonContainer').style.display = 'none';
      } else {
        document.getElementById('undertimeReasonSelect').value = 'Other (specify)';
        document.getElementById('undertimeCustomReason').value = undertimeReason;
        document.getElementById('undertimeCustomReasonContainer').style.display = 'block';
      }
    } else {
      document.getElementById('undertimeReasonSelect').value = '';
      document.getElementById('undertimeCustomReason').value = '';
      document.getElementById('undertimeCustomReasonContainer').style.display = 'none';
      document.getElementById('undertimeMinutesInput').value = '';
    }
  } catch (error) {
    console.error('Error loading undertime data:', error);
    document.getElementById('undertimeReasonSelect').value = '';
    document.getElementById('undertimeCustomReason').value = '';
    document.getElementById('undertimeCustomReasonContainer').style.display = 'none';
    document.getElementById('undertimeMinutesInput').value = '';
  }

  // Calculate and display class slots for undertime
  const classSlots = calculateClassSlots(teacherData.startTime, teacherData.endTime);
  renderUndertimeClassSlots(classSlots, existingData?.undertimeClassAssignments || []);

  document.getElementById('undertimeModal').classList.add('show');
}

// Close undertime modal
function closeUndertimeModal(uncheckBox = false) {
  document.getElementById('undertimeModal').classList.remove('show');

  if (uncheckBox && currentTeacherData) {
    const undertimeCheckbox = document.querySelector(
      `input.undertime-checkbox[data-teacher-id="${currentTeacherData.teacherId}"]`
    );
    if (undertimeCheckbox) undertimeCheckbox.checked = false;
  }

  currentTeacherData = null;
  undertimeClassAssignments = {};
}

// Save undertime attendance
async function saveUndertimeAttendance() {
  const reasonSelect = document.getElementById('undertimeReasonSelect');
  const customReason = document.getElementById('undertimeCustomReason');
  const minutesInput = document.getElementById('undertimeMinutesInput');

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

  const undertimeMinutes = minutesInput.value ? parseInt(minutesInput.value) : null;

  if (!currentTeacherData) return;

  const statusElement = document.getElementById(`status-${currentTeacherData.teacherId}`);

  try {
    statusElement.textContent = 'Saving...';
    statusElement.className = 'save-status saving';

    const undertimeClassAssignmentsArray = Object.values(undertimeClassAssignments);

    // Get current attendance to preserve existing status
    const selectedDate = getSelectedDate();
    const currentResponse = await fetch(`${API_URL}/attendance/teacher/${currentTeacherData.teacherId}?date=${selectedDate}`);
    const currentData = await currentResponse.json();

    let currentStatus = 'present';
    let lateReason = null;
    let minutesLate = null;

    if (currentData.success && currentData.attendance) {
      currentStatus = currentData.attendance.status;
      lateReason = currentData.attendance.late_reason;
      minutesLate = currentData.attendance.minutes_late;
    }

    const response = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        date: selectedDate,
        attendance: [{
          teacherId: currentTeacherData.teacherId,
          teacherName: currentTeacherData.teacherName,
          startTime: currentTeacherData.startTime,
          endTime: currentTeacherData.endTime,
          status: currentStatus,
          lateReason: lateReason,
          minutesLate: minutesLate,
          hasUndertime: 1,
          undertimeMinutes: undertimeMinutes,
          undertimeReason: reason,
          undertimeClassAssignments: undertimeClassAssignmentsArray
        }]
      })
    });

    const data = await response.json();

    if (data.success) {
      statusElement.textContent = '✓ Saved';
      statusElement.className = 'save-status saved';

      if (attendanceData[currentTeacherData.teacherId]) {
        attendanceData[currentTeacherData.teacherId].has_undertime = 1;
        attendanceData[currentTeacherData.teacherId].undertime_minutes = undertimeMinutes;
        attendanceData[currentTeacherData.teacherId].undertime_reason = reason;
      }

      refreshDailyReportSilently();

      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'save-status';
      }, 2000);

      closeUndertimeModal();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Error saving undertime:', error);
    statusElement.textContent = '✗ Error';
    statusElement.className = 'save-status error';
  }
}

// Render undertime class slots
async function renderUndertimeClassSlots(classSlots, existingAssignments = []) {
  const container = document.getElementById('undertimeClassSlotsList');

  if (classSlots.length === 0) {
    container.innerHTML = '<p class="info-text">No class slots found.</p>';
    return;
  }

  // Filter out teachers who are absent (but keep late teachers - they may be available for later slots)
  const availableTeachers = teachers.filter(t => {
    const attendance = attendanceData[t.id];
    // Exclude only if status is 'absent'
    return !attendance || attendance.status !== 'absent';
  });

  const assignmentMap = {};
  existingAssignments.forEach(assignment => {
    assignmentMap[assignment.class_slot] = assignment;
  });

  // Fetch busy teachers and assigned substitutes for all slots in parallel
  const busyTeachersPromises = classSlots.map(slot =>
    getBusyTeachers(getSelectedDate(), slot.label)
  );
  const assignedSubstitutesPromises = classSlots.map(slot =>
    getAssignedSubstitutes(getSelectedDate(), slot.label)
  );

  const [busyTeachersPerSlot, assignedSubstitutesPerSlot] = await Promise.all([
    Promise.all(busyTeachersPromises),
    Promise.all(assignedSubstitutesPromises)
  ]);

  // Get minutes early from input to determine which slots need substitutes
  const minutesEarlyInput = document.getElementById('undertimeMinutesInput');
  const minutesEarly = minutesEarlyInput.value ? parseInt(minutesEarlyInput.value) : 0;
  const slotsNeedingSub = getSlotsNeedingSubstituteForUndertime(currentTeacherData, minutesEarly);

  console.log(`[Undertime Modal] Minutes early: ${minutesEarly}, Slots needing substitute:`, slotsNeedingSub);

  container.innerHTML = classSlots.map((slot, index) => {
    const existingAssignment = assignmentMap[slot.label];
    const noClass = existingAssignment?.noClass || false;
    const onlineClass = existingAssignment?.onlineClass || false;
    const substituteId = existingAssignment?.substitute_teacher_id || '';

    // Check if this slot needs a substitute based on minutes early
    const needsSubstitute = slotsNeedingSub.includes(slot.label);
    const wasPresent = !needsSubstitute;

    // Get busy teachers and assigned substitutes for this specific slot
    const busyTeachers = busyTeachersPerSlot[index] || [];
    const assignedSubstitutes = assignedSubstitutesPerSlot[index] || [];

    // Filter teachers who are available for THIS specific time slot (considering late arrivals) AND not busy with classes or substitutes
    const slotAvailableTeachers = availableTeachers.filter(t =>
      isLateTeacherAvailableForSlot(t, slot.label, attendanceData) && isTeacherNotBusy(t, busyTeachers, assignedSubstitutes)
    );

    return `
    <div class="class-slot-card" data-slot-index="${index}" ${wasPresent ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h5 style="margin: 0;">${slot.label} ${wasPresent ? '<span style="color: #28a745; font-weight: normal; font-size: 14px;">(Teacher was present)</span>' : ''}</h5>
        <div style="display: flex; gap: 15px;"${wasPresent ? ' style="display: none;"' : ''}>
          <label style="display: flex; align-items: center; gap: 5px; margin: 0;">
            <input type="checkbox" class="undertime-no-class-checkbox" data-slot="${slot.label}" data-index="${index}" ${noClass ? 'checked' : ''}>
            N/A
          </label>
          <label style="display: flex; align-items: center; gap: 5px; margin: 0;">
            <input type="checkbox" class="undertime-online-class-checkbox" data-slot="${slot.label}" data-index="${index}" ${onlineClass ? 'checked' : ''}>
            Online class
          </label>
        </div>
      </div>

      <div class="undertime-class-details" id="undertime-class-details-${index}" style="${(noClass || onlineClass) ? 'display: none;' : ''}">
        <label>Substitute Teacher:</label>
        <select class="undertime-sub-teacher-select" data-slot="${slot.label}">
          <option value="">-- Select Substitute --</option>
          ${slotAvailableTeachers.map(t => `<option value="${t.id}" data-name="${t.name}" ${t.id === substituteId ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>

        <label>Students:</label>
        <select class="undertime-students-select" data-slot="${slot.label}" multiple size="5">
          ${allStudents.map(s => {
            const isSelected = existingAssignment?.students?.some(student => student.id === s.id) || false;
            return `<option value="${s.id}" data-name="${s.name}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
          }).join('')}
        </select>

        <div class="student-chips" id="undertime-students-chips-${index}"></div>
      </div>
    </div>
  `;
  }).join('');

  // Event listeners for substitute selection
  container.querySelectorAll('.undertime-sub-teacher-select').forEach(select => {
    select.addEventListener('change', function() {
      const slot = this.dataset.slot;
      const teacherId = this.value;
      const teacherName = this.options[this.selectedIndex].dataset.name;

      if (!undertimeClassAssignments[slot]) {
        undertimeClassAssignments[slot] = { classSlot: slot, students: [] };
      }

      undertimeClassAssignments[slot].substituteTeacherId = teacherId;
      undertimeClassAssignments[slot].substituteTeacherName = teacherName;
    });
  });

  // Event listeners for student selection
  container.querySelectorAll('.undertime-students-select').forEach(select => {
    select.addEventListener('change', function() {
      const slot = this.dataset.slot;
      const selectedStudents = Array.from(this.selectedOptions).map(opt => ({
        id: opt.value,
        name: opt.dataset.name
      }));

      if (!undertimeClassAssignments[slot]) {
        undertimeClassAssignments[slot] = { classSlot: slot };
      }

      undertimeClassAssignments[slot].students = selectedStudents;

      const slotIndex = this.closest('.class-slot-card').dataset.slotIndex;
      renderUndertimeStudentChips(slotIndex, selectedStudents);
    });
  });

  // No class checkboxes
  container.querySelectorAll('.undertime-no-class-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const index = this.dataset.index;
      const slot = this.dataset.slot;
      const detailsDiv = document.getElementById(`undertime-class-details-${index}`);
      const onlineCheckbox = container.querySelector(`.undertime-online-class-checkbox[data-index="${index}"]`);

      if (this.checked) {
        onlineCheckbox.checked = false;
        detailsDiv.style.display = 'none';

        if (!undertimeClassAssignments[slot]) {
          undertimeClassAssignments[slot] = { classSlot: slot };
        }
        undertimeClassAssignments[slot].noClass = true;
        undertimeClassAssignments[slot].onlineClass = false;
        undertimeClassAssignments[slot].substituteTeacherId = null;
        undertimeClassAssignments[slot].substituteTeacherName = null;
        undertimeClassAssignments[slot].students = [];
      } else {
        detailsDiv.style.display = 'block';
        if (undertimeClassAssignments[slot]) {
          delete undertimeClassAssignments[slot].noClass;
        }
      }
    });
  });

  // Online class checkboxes
  container.querySelectorAll('.undertime-online-class-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const index = this.dataset.index;
      const slot = this.dataset.slot;
      const detailsDiv = document.getElementById(`undertime-class-details-${index}`);
      const noClassCheckbox = container.querySelector(`.undertime-no-class-checkbox[data-index="${index}"]`);

      if (this.checked) {
        noClassCheckbox.checked = false;
        detailsDiv.style.display = 'none';

        if (!undertimeClassAssignments[slot]) {
          undertimeClassAssignments[slot] = { classSlot: slot };
        }
        undertimeClassAssignments[slot].onlineClass = true;
        undertimeClassAssignments[slot].noClass = false;
        undertimeClassAssignments[slot].substituteTeacherId = null;
        undertimeClassAssignments[slot].substituteTeacherName = null;
        undertimeClassAssignments[slot].students = [];
      } else {
        detailsDiv.style.display = 'block';
        if (undertimeClassAssignments[slot]) {
          delete undertimeClassAssignments[slot].onlineClass;
        }
      }
    });
  });

  // Pre-populate with existing data
  existingAssignments.forEach((assignment) => {
    const slot = assignment.class_slot;
    undertimeClassAssignments[slot] = {
      classSlot: slot,
      noClass: assignment.noClass || false,
      onlineClass: assignment.onlineClass || false,
      substituteTeacherId: assignment.substitute_teacher_id,
      substituteTeacherName: assignment.substitute_teacher_name,
      students: assignment.students || []
    };

    const slotIndex = classSlots.findIndex(s => s.label === slot);
    if (slotIndex !== -1 && assignment.students && assignment.students.length > 0) {
      renderUndertimeStudentChips(slotIndex, assignment.students);
    }
  });
}

// Render student chips
function renderUndertimeStudentChips(slotIndex, students) {
  const container = document.getElementById(`undertime-students-chips-${slotIndex}`);

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

// AI Auto-fill for undertime modal
async function aiAutoFillUndertimeSubstitutes() {
  if (!currentTeacherData) return;

  const statusSpan = document.getElementById('aiAutoFillUndertimeStatus');
  const button = document.getElementById('aiAutoFillUndertimeBtn');

  try {
    button.disabled = true;
    statusSpan.textContent = '🤖 Analyzing...';

    // Get class slots for this teacher
    const classSlots = calculateClassSlots(currentTeacherData.startTime, currentTeacherData.endTime);

    // Get minutes early and filter to only slots needing substitutes
    const minutesEarlyInput = document.getElementById('undertimeMinutesInput');
    const minutesEarly = minutesEarlyInput.value ? parseInt(minutesEarlyInput.value) : 0;

    if (!minutesEarly || minutesEarly === 0) {
      statusSpan.textContent = 'Please enter minutes early first';
      statusSpan.style.color = '#ffc107';
      button.disabled = false;
      return;
    }

    const slotsNeedingSub = getSlotsNeedingSubstituteForUndertime(currentTeacherData, minutesEarly);
    const slotsToProcess = classSlots.filter(slot => slotsNeedingSub.includes(slot.label));

    if (slotsToProcess.length === 0) {
      statusSpan.textContent = 'Teacher was present for all slots';
      statusSpan.style.color = '#28a745';
      button.disabled = false;
      setTimeout(() => { statusSpan.textContent = ''; }, 3000);
      return;
    }

    console.log(`[AI Auto-fill Undertime] Processing ${slotsToProcess.length} slots needing substitute:`, slotsToProcess.map(s => s.label));

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
          const selectElement = document.querySelector(`.undertime-sub-teacher-select[data-slot="${slot}"]`);
          if (selectElement) {
            selectElement.value = rec.substituteTeacherId;

            // Update undertimeClassAssignments
            if (!undertimeClassAssignments[slot]) {
              undertimeClassAssignments[slot] = { classSlot: slot, students: [] };
            }
            undertimeClassAssignments[slot].substituteTeacherId = rec.substituteTeacherId;
            undertimeClassAssignments[slot].substituteTeacherName = rec.substituteTeacherName;
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

          const studentsSelect = document.querySelector(`.undertime-students-select[data-slot="${slot}"]`);
          if (studentsSelect) {
            Array.from(studentsSelect.options).forEach(option => {
              option.selected = matchedStudents.some(s => s.id === option.value);
            });

            if (!undertimeClassAssignments[slot]) {
              undertimeClassAssignments[slot] = { classSlot: slot };
            }
            undertimeClassAssignments[slot].students = matchedStudents;

            const slotCard = studentsSelect.closest('.class-slot-card');
            const slotIndex = slotCard?.dataset.slotIndex;
            if (slotIndex !== undefined) {
              renderUndertimeStudentChips(slotIndex, matchedStudents);
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
      statusSpan.textContent = 'No recommendations available';
      statusSpan.style.color = '#ffc107';
    }
  } catch (error) {
    console.error('Error in AI auto-fill:', error);
    statusSpan.textContent = '✗ Error';
    statusSpan.style.color = '#dc3545';
  } finally {
    button.disabled = false;
  }
}
