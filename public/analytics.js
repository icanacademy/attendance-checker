// Comprehensive Analytics Rendering

async function renderComprehensiveAnalytics(attendance, startDate, endDate) {
  if (attendance.length === 0) {
    document.getElementById('overviewSummary').innerHTML = '<div class="info-text">No attendance records found for the selected date range.</div>';
    return;
  }

  // Destroy existing charts
  Object.values(chartInstances).forEach(chart => chart?.destroy());
  chartInstances = {};

  // Calculate analytics
  const analytics = calculateAnalytics(attendance, startDate, endDate);

  // Render summary cards
  renderSummaryCards(analytics);

  // Render charts
  renderTrendChart(analytics);
  renderStatusPieChart(analytics);
  renderLateReasonsChart(analytics);
  renderAbsentReasonsChart(analytics);
  renderUndertimeReasonsChart(analytics);
  renderShiftChart(analytics);
  renderDayOfWeekChart(analytics);
  renderShiftDayHeatmap(analytics);
  renderTeacherBreakdownChart(analytics);

  // Render insights - pass attendance array for streak calculation
  renderTeacherInsights(analytics, attendance);
  renderSubstituteCoverage(analytics);
}

function calculateAnalytics(attendance, startDate, endDate) {
  const analytics = {
    totalRecords: attendance.length,
    presentCount: attendance.filter(a => a.status === 'present').length,
    lateCount: attendance.filter(a => a.status === 'late').length,
    absentCount: attendance.filter(a => a.status === 'absent').length,
    undertimeCount: attendance.filter(a => a.has_undertime === 1).length,
    sickLeaveCount: attendance.filter(a => a.official_leave_type === 'sick').length,
    vacationLeaveCount: attendance.filter(a => a.official_leave_type === 'vacation').length,
    dateRange: { startDate, endDate },
    uniqueTeachers: new Set(attendance.map(a => a.teacher_id)).size,
    dailyData: {},
    lateReasons: {},
    absentReasons: {},
    undertimeReasons: {},
    teacherStats: {},
    shiftStats: {},
    dayOfWeekStats: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 },
    shiftDayHeatmap: {},
    substitutesUsed: new Set(),
    classesNeedingCoverage: 0,
    classesWithoutCoverage: 0,
    studentsAffected: new Set(),
    totalMinutesLate: 0,
    lateWithMinutesCount: 0,
    totalMinutesEarly: 0,
    undertimeWithMinutesCount: 0
  };

  // Calculate attendance rate
  analytics.attendanceRate = ((analytics.presentCount + analytics.lateCount) / analytics.totalRecords * 100).toFixed(1);

  // Process each record
  attendance.forEach(record => {
    const date = record.date;
    const teacherId = record.teacher_id;

    // Daily data for trend chart
    if (!analytics.dailyData[date]) {
      analytics.dailyData[date] = { present: 0, late: 0, absent: 0, undertime: 0, sickLeave: 0, vacationLeave: 0 };
    }

    // Count official leaves separately from regular absences
    if (record.official_leave_type === 'sick') {
      analytics.dailyData[date].sickLeave++;
    } else if (record.official_leave_type === 'vacation') {
      analytics.dailyData[date].vacationLeave++;
    } else {
      analytics.dailyData[date][record.status]++;
    }

    // Track undertime separately (can overlap with other statuses)
    if (record.has_undertime === 1) {
      analytics.dailyData[date].undertime++;
    }

    // Late reasons
    if (record.status === 'late' && record.late_reason) {
      analytics.lateReasons[record.late_reason] = (analytics.lateReasons[record.late_reason] || 0) + 1;
    }

    // Absent reasons
    if (record.status === 'absent' && record.absent_reason) {
      analytics.absentReasons[record.absent_reason] = (analytics.absentReasons[record.absent_reason] || 0) + 1;
    }

    // Undertime reasons
    if (record.has_undertime === 1 && record.undertime_reason) {
      analytics.undertimeReasons[record.undertime_reason] = (analytics.undertimeReasons[record.undertime_reason] || 0) + 1;
    }

    // Minutes late tracking
    if (record.status === 'late' && record.minutes_late) {
      analytics.totalMinutesLate += record.minutes_late;
      analytics.lateWithMinutesCount++;
    }

    // Minutes early tracking (undertime)
    if (record.has_undertime === 1 && record.undertime_minutes) {
      analytics.totalMinutesEarly += record.undertime_minutes;
      analytics.undertimeWithMinutesCount++;
    }

    // Teacher stats
    if (!analytics.teacherStats[teacherId]) {
      analytics.teacherStats[teacherId] = {
        name: record.teacher_name,
        present: 0,
        late: 0,
        absent: 0,
        undertime: 0,
        sickLeave: 0,
        vacationLeave: 0,
        total: 0
      };
    }

    // Count official leaves separately from regular absences
    if (record.official_leave_type === 'sick') {
      analytics.teacherStats[teacherId].sickLeave++;
    } else if (record.official_leave_type === 'vacation') {
      analytics.teacherStats[teacherId].vacationLeave++;
    } else {
      // Only count as regular status if not an official leave
      analytics.teacherStats[teacherId][record.status]++;
    }

    if (record.has_undertime === 1) {
      analytics.teacherStats[teacherId].undertime++;
    }
    analytics.teacherStats[teacherId].total++;

    // Shift stats
    const shift = record.start_time || 'Unknown';
    if (!analytics.shiftStats[shift]) {
      analytics.shiftStats[shift] = { present: 0, late: 0, absent: 0, undertime: 0, sickLeave: 0, vacationLeave: 0 };
    }

    // Count official leaves separately from regular absences
    if (record.official_leave_type === 'sick') {
      analytics.shiftStats[shift].sickLeave++;
    } else if (record.official_leave_type === 'vacation') {
      analytics.shiftStats[shift].vacationLeave++;
    } else {
      analytics.shiftStats[shift][record.status]++;
    }

    if (record.has_undertime === 1) {
      analytics.shiftStats[shift].undertime++;
    }

    // Day of week stats
    const dateObj = new Date(date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    if (record.status === 'absent' || record.status === 'late' || record.has_undertime === 1) {
      analytics.dayOfWeekStats[dayName]++;
    }

    // Shift-Day Heatmap (track issues by shift and day)
    const heatmapKey = `${shift}_${dayName}`;
    if (!analytics.shiftDayHeatmap[heatmapKey]) {
      analytics.shiftDayHeatmap[heatmapKey] = { shift, day: dayName, issues: 0 };
    }
    if (record.status === 'absent' || record.status === 'late' || record.has_undertime === 1 ||
        record.official_leave_type === 'sick' || record.official_leave_type === 'vacation') {
      analytics.shiftDayHeatmap[heatmapKey].issues++;
    }

    // Substitute coverage (for absent, late, and undertime)
    if (record.status === 'absent' && record.classAssignments) {
      const assignments = typeof record.classAssignments === 'string' ?
        JSON.parse(record.classAssignments) : record.classAssignments;

      if (Array.isArray(assignments)) {
        assignments.forEach(assignment => {
          analytics.classesNeedingCoverage++;

          if (assignment.onlineClass || assignment.online_class) {
            // Online class - doesn't need substitute
          } else if (assignment.noClass || assignment.no_class) {
            // N/A
          } else if (assignment.substitute_teacher_id) {
            analytics.substitutesUsed.add(assignment.substitute_teacher_name);
          } else {
            analytics.classesWithoutCoverage++;
          }

          // Students affected
          if (assignment.students) {
            const students = typeof assignment.students === 'string' ?
              JSON.parse(assignment.students) : assignment.students;
            if (Array.isArray(students)) {
              students.forEach(s => analytics.studentsAffected.add(s.name));
            }
          }
        });
      }
    }

    // Undertime class assignments coverage
    if (record.has_undertime === 1 && record.undertimeClassAssignments) {
      const assignments = typeof record.undertimeClassAssignments === 'string' ?
        JSON.parse(record.undertimeClassAssignments) : record.undertimeClassAssignments;

      if (Array.isArray(assignments)) {
        assignments.forEach(assignment => {
          analytics.classesNeedingCoverage++;

          if (assignment.onlineClass || assignment.online_class) {
            // Online class - doesn't need substitute
          } else if (assignment.noClass || assignment.no_class) {
            // N/A
          } else if (assignment.substitute_teacher_id) {
            analytics.substitutesUsed.add(assignment.substitute_teacher_name);
          } else {
            analytics.classesWithoutCoverage++;
          }

          // Students affected
          if (assignment.students) {
            const students = typeof assignment.students === 'string' ?
              JSON.parse(assignment.students) : assignment.students;
            if (Array.isArray(students)) {
              students.forEach(s => analytics.studentsAffected.add(s.name));
            }
          }
        });
      }
    }
  });

  // Calculate averages
  analytics.avgMinutesLate = analytics.lateWithMinutesCount > 0 ?
    (analytics.totalMinutesLate / analytics.lateWithMinutesCount).toFixed(1) : 0;
  analytics.avgMinutesEarly = analytics.undertimeWithMinutesCount > 0 ?
    (analytics.totalMinutesEarly / analytics.undertimeWithMinutesCount).toFixed(1) : 0;

  // Calculate total days tracked
  analytics.totalDays = Object.keys(analytics.dailyData).length;

  // Calculate coverage rate
  analytics.coverageRate = analytics.classesNeedingCoverage > 0 ?
    (((analytics.classesNeedingCoverage - analytics.classesWithoutCoverage) / analytics.classesNeedingCoverage) * 100).toFixed(1) : 100;

  return analytics;
}

function renderSummaryCards(analytics) {
  const overviewSummary = document.getElementById('overviewSummary');

  overviewSummary.innerHTML = `
    <div class="summary-card">
      <h3>Total Records</h3>
      <div class="card-subtitle">All attendance entries</div>
      <div class="value">${analytics.totalRecords}</div>
    </div>
    <div class="summary-card">
      <h3>Present</h3>
      <div class="card-subtitle">On time arrivals</div>
      <div class="value">${analytics.presentCount}</div>
      <small>${((analytics.presentCount / analytics.totalRecords) * 100).toFixed(1)}%</small>
    </div>
    <div class="summary-card">
      <h3>Late</h3>
      <div class="card-subtitle">Delayed arrivals</div>
      <div class="value">${analytics.lateCount}</div>
      <small>${((analytics.lateCount / analytics.totalRecords) * 100).toFixed(1)}%</small>
    </div>
    <div class="summary-card">
      <h3>Absent</h3>
      <div class="card-subtitle">Did not attend</div>
      <div class="value">${analytics.absentCount}</div>
      <small>${((analytics.absentCount / analytics.totalRecords) * 100).toFixed(1)}%</small>
    </div>
    <div class="summary-card">
      <h3>Left Early</h3>
      <div class="card-subtitle">Undertime occurrences</div>
      <div class="value">${analytics.undertimeCount}</div>
      <small>${((analytics.undertimeCount / analytics.totalRecords) * 100).toFixed(1)}%</small>
    </div>
    <div class="summary-card">
      <h3>Attendance Rate</h3>
      <div class="card-subtitle">Present + Late combined</div>
      <div class="value">${analytics.attendanceRate}%</div>
    </div>
    <div class="summary-card">
      <h3>Avg Minutes Late</h3>
      <div class="card-subtitle">When teachers arrive late</div>
      <div class="value">${analytics.avgMinutesLate}</div>
      <small>minutes</small>
    </div>
    <div class="summary-card">
      <h3>Avg Minutes Early</h3>
      <div class="card-subtitle">When teachers leave early</div>
      <div class="value">${analytics.avgMinutesEarly}</div>
      <small>minutes</small>
    </div>
    <div class="summary-card" style="border-top: 4px solid #6f42c1;">
      <h3>🏥 Sick Leave</h3>
      <div class="card-subtitle">Official sick leave</div>
      <div class="value" style="color: #6f42c1;">${analytics.sickLeaveCount}</div>
      <small>${((analytics.sickLeaveCount / analytics.totalRecords) * 100).toFixed(1)}%</small>
    </div>
    <div class="summary-card" style="border-top: 4px solid #6f42c1;">
      <h3>🏖️ Vacation Leave</h3>
      <div class="card-subtitle">Official vacation leave</div>
      <div class="value" style="color: #6f42c1;">${analytics.vacationLeaveCount}</div>
      <small>${((analytics.vacationLeaveCount / analytics.totalRecords) * 100).toFixed(1)}%</small>
    </div>
    <div class="summary-card">
      <h3>Total Days Tracked</h3>
      <div class="card-subtitle">Days in selected period</div>
      <div class="value">${analytics.totalDays}</div>
    </div>
    <div class="summary-card">
      <h3>Coverage Rate</h3>
      <div class="card-subtitle">Classes with substitute coverage</div>
      <div class="value">${analytics.coverageRate}%</div>
    </div>
  `;
}

function renderTrendChart(analytics) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  const dates = Object.keys(analytics.dailyData).sort();
  const presentData = dates.map(date => analytics.dailyData[date].present);
  const lateData = dates.map(date => analytics.dailyData[date].late);
  const absentData = dates.map(date => analytics.dailyData[date].absent);
  const undertimeData = dates.map(date => analytics.dailyData[date].undertime || 0);
  const sickLeaveData = dates.map(date => analytics.dailyData[date].sickLeave || 0);
  const vacationLeaveData = dates.map(date => analytics.dailyData[date].vacationLeave || 0);

  chartInstances.trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(date => new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        {
          label: 'Present',
          data: presentData,
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          tension: 0.3
        },
        {
          label: 'Late',
          data: lateData,
          borderColor: '#ffc107',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          tension: 0.3
        },
        {
          label: 'Absent',
          data: absentData,
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          tension: 0.3
        },
        {
          label: 'Left Early',
          data: undertimeData,
          borderColor: '#fd7e14',
          backgroundColor: 'rgba(253, 126, 20, 0.1)',
          tension: 0.3
        },
        {
          label: '🏥 Sick Leave',
          data: sickLeaveData,
          borderColor: '#6f42c1',
          backgroundColor: 'rgba(111, 66, 193, 0.1)',
          tension: 0.3
        },
        {
          label: '🏖️ Vacation Leave',
          data: vacationLeaveData,
          borderColor: '#9b59b6',
          backgroundColor: 'rgba(155, 89, 182, 0.1)',
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderStatusPieChart(analytics) {
  const ctx = document.getElementById('statusPieChart');
  if (!ctx) return;

  chartInstances.statusPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Late', 'Absent', 'Left Early', '🏥 Sick Leave', '🏖️ Vacation Leave'],
      datasets: [{
        data: [analytics.presentCount, analytics.lateCount, analytics.absentCount, analytics.undertimeCount, analytics.sickLeaveCount, analytics.vacationLeaveCount],
        backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#fd7e14', '#6f42c1', '#9b59b6']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function renderLateReasonsChart(analytics) {
  const ctx = document.getElementById('lateReasonsChart');

  if (!ctx) {
    console.error('lateReasonsChart canvas element not found');
    return;
  }

  const reasons = Object.entries(analytics.lateReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10

  if (reasons.length === 0) {
    ctx.parentElement.innerHTML = '<h3>Late Reasons Breakdown</h3><p class="info-text">No late reasons recorded</p>';
    return;
  }

  chartInstances.lateReasonsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: reasons.map(r => r[0]),
      datasets: [{
        label: 'Count',
        data: reasons.map(r => r[1]),
        backgroundColor: '#ffc107'
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderAbsentReasonsChart(analytics) {
  const ctx = document.getElementById('absentReasonsChart');

  if (!ctx) {
    console.error('absentReasonsChart canvas element not found');
    return;
  }

  const reasons = Object.entries(analytics.absentReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10

  if (reasons.length === 0) {
    ctx.parentElement.innerHTML = '<h3>Absent Reasons Breakdown</h3><p class="info-text">No absent reasons recorded</p>';
    return;
  }

  chartInstances.absentReasonsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: reasons.map(r => r[0]),
      datasets: [{
        label: 'Count',
        data: reasons.map(r => r[1]),
        backgroundColor: '#dc3545'
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderUndertimeReasonsChart(analytics) {
  const ctx = document.getElementById('undertimeReasonsChart');

  if (!ctx) {
    console.error('undertimeReasonsChart canvas element not found');
    return;
  }

  const reasons = Object.entries(analytics.undertimeReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10

  if (reasons.length === 0) {
    ctx.parentElement.innerHTML = '<h3>Undertime Reasons Breakdown</h3><p class="info-text">No undertime reasons recorded</p>';
    return;
  }

  chartInstances.undertimeReasonsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: reasons.map(r => r[0]),
      datasets: [{
        label: 'Count',
        data: reasons.map(r => r[1]),
        backgroundColor: '#fd7e14'
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderShiftChart(analytics) {
  const ctx = document.getElementById('shiftChart');
  if (!ctx) return;

  const shifts = Object.keys(analytics.shiftStats).sort();

  chartInstances.shiftChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: shifts,
      datasets: [
        {
          label: 'Present',
          data: shifts.map(s => analytics.shiftStats[s].present),
          backgroundColor: '#28a745'
        },
        {
          label: 'Late',
          data: shifts.map(s => analytics.shiftStats[s].late),
          backgroundColor: '#ffc107'
        },
        {
          label: 'Absent',
          data: shifts.map(s => analytics.shiftStats[s].absent),
          backgroundColor: '#dc3545'
        },
        {
          label: 'Left Early',
          data: shifts.map(s => analytics.shiftStats[s].undertime || 0),
          backgroundColor: '#fd7e14'
        },
        {
          label: '🏥 Sick Leave',
          data: shifts.map(s => analytics.shiftStats[s].sickLeave || 0),
          backgroundColor: '#6f42c1'
        },
        {
          label: '🏖️ Vacation Leave',
          data: shifts.map(s => analytics.shiftStats[s].vacationLeave || 0),
          backgroundColor: '#9b59b6'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderDayOfWeekChart(analytics) {
  const ctx = document.getElementById('dayOfWeekChart');
  if (!ctx) return;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  chartInstances.dayOfWeekChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Issues (Late + Absent)',
        data: days.map(day => analytics.dayOfWeekStats[day]),
        backgroundColor: '#001F3F'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderShiftDayHeatmap(analytics) {
  const ctx = document.getElementById('shiftDayHeatmap');
  if (!ctx) return;

  // Get unique shifts and days
  const shifts = [...new Set(Object.values(analytics.shiftDayHeatmap).map(d => d.shift))].sort();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fullDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Create datasets for each shift
  const colors = ['#001F3F', '#0074D9', '#39CCCC', '#3D9970', '#FF851B', '#FF4136', '#85144b'];
  const datasets = shifts.map((shift, index) => ({
    label: shift,
    data: fullDays.map(day => {
      const key = `${shift}_${day}`;
      return analytics.shiftDayHeatmap[key]?.issues || 0;
    }),
    backgroundColor: colors[index % colors.length]
  }));

  chartInstances.shiftDayHeatmap = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 10,
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${context.parsed.y} issues`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: false,
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

function renderTeacherBreakdownChart(analytics) {
  const ctx = document.getElementById('teacherBreakdownChart');
  if (!ctx) return;

  // Convert teacher stats to array with percentages and sort by performance (best first)
  const teacherArray = Object.entries(analytics.teacherStats)
    .map(([id, stats]) => {
      const total = stats.total;
      return {
        id,
        name: stats.name,
        presentPercent: total > 0 ? (stats.present / total * 100) : 0,
        latePercent: total > 0 ? (stats.late / total * 100) : 0,
        absentPercent: total > 0 ? (stats.absent / total * 100) : 0,
        undertimePercent: total > 0 ? (stats.undertime / total * 100) : 0,
        sickLeavePercent: total > 0 ? (stats.sickLeave / total * 100) : 0,
        vacationLeavePercent: total > 0 ? (stats.vacationLeave / total * 100) : 0,
        presentCount: stats.present,
        lateCount: stats.late,
        absentCount: stats.absent,
        undertimeCount: stats.undertime,
        sickLeaveCount: stats.sickLeave,
        vacationLeaveCount: stats.vacationLeave,
        total: total
      };
    })
    .sort((a, b) => {
      // Sort by present percentage (highest first)
      if (b.presentPercent !== a.presentPercent) {
        return b.presentPercent - a.presentPercent;
      }
      // If same present %, sort by late percentage (lowest first)
      if (a.latePercent !== b.latePercent) {
        return a.latePercent - b.latePercent;
      }
      // If same late %, sort by absent percentage (lowest first)
      if (a.absentPercent !== b.absentPercent) {
        return a.absentPercent - b.absentPercent;
      }
      // If all same, sort by name
      return a.name.localeCompare(b.name);
    });

  chartInstances.teacherBreakdownChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: teacherArray.map(t => t.name),
      datasets: [
        {
          label: 'Present',
          data: teacherArray.map(t => t.presentPercent),
          backgroundColor: '#28a745',
          barThickness: 25
        },
        {
          label: 'Late',
          data: teacherArray.map(t => t.latePercent),
          backgroundColor: '#ffc107',
          barThickness: 25
        },
        {
          label: 'Absent',
          data: teacherArray.map(t => t.absentPercent),
          backgroundColor: '#dc3545',
          barThickness: 25
        },
        {
          label: 'Left Early',
          data: teacherArray.map(t => t.undertimePercent),
          backgroundColor: '#fd7e14',
          barThickness: 25
        },
        {
          label: '🏥 Sick Leave',
          data: teacherArray.map(t => t.sickLeavePercent),
          backgroundColor: '#6f42c1',
          barThickness: 25
        },
        {
          label: '🏖️ Vacation Leave',
          data: teacherArray.map(t => t.vacationLeavePercent),
          backgroundColor: '#9b59b6',
          barThickness: 25
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 13
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const teacherIndex = context.dataIndex;
              const teacher = teacherArray[teacherIndex];
              const status = context.dataset.label;

              let count, percent;
              if (status === 'Present') {
                count = teacher.presentCount;
                percent = teacher.presentPercent;
              } else if (status === 'Late') {
                count = teacher.lateCount;
                percent = teacher.latePercent;
              } else if (status === 'Absent') {
                count = teacher.absentCount;
                percent = teacher.absentPercent;
              } else if (status === 'Left Early') {
                count = teacher.undertimeCount;
                percent = teacher.undertimePercent;
              } else if (status === '🏥 Sick Leave') {
                count = teacher.sickLeaveCount;
                percent = teacher.sickLeavePercent;
              } else if (status === '🏖️ Vacation Leave') {
                count = teacher.vacationLeaveCount;
                percent = teacher.vacationLeavePercent;
              }

              return `${status}: ${count} (${percent.toFixed(1)}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            },
            font: {
              size: 12
            }
          },
          grid: {
            display: true
          }
        },
        y: {
          stacked: true,
          ticks: {
            font: {
              size: 12
            },
            padding: 8
          },
          grid: {
            display: false
          }
        }
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 20
        }
      }
    }
  });
}

function renderTeacherInsights(analytics, attendance) {
  const container = document.getElementById('teacherInsights');

  // Helper function to extract first name from brackets
  const getFirstName = (fullName) => {
    const bracketMatch = fullName.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      return bracketMatch[1]; // Return name inside brackets
    }
    return fullName; // Return full name if no brackets
  };

  // Calculate teacher performance
  const teacherArray = Object.entries(analytics.teacherStats).map(([id, stats]) => ({
    id,
    ...stats,
    displayName: getFirstName(stats.name),
    presentRate: ((stats.present / stats.total) * 100).toFixed(1), // Only count on-time attendance
    attendanceRate: ((stats.present + stats.late) / stats.total * 100).toFixed(1), // Overall attendance (for reference)
    issueRate: ((stats.late + stats.absent) / stats.total * 100).toFixed(1)
  }));

  // Perfect attendance
  const perfectAttendance = teacherArray.filter(t => t.present === t.total);

  // Most absences
  const mostAbsences = teacherArray.sort((a, b) => b.absent - a.absent).slice(0, 5);

  // Most late
  const mostLate = teacherArray.sort((a, b) => b.late - a.late).slice(0, 5);

  // Needs attention (high late + absent rate)
  const needsAttention = teacherArray
    .filter(t => (t.late + t.absent) > 0)
    .sort((a, b) => b.issueRate - a.issueRate)
    .slice(0, 5);

  // Calculate attendance streaks using actual attendance data
  const teacherStreaks = calculateAttendanceStreaks(attendance).map(t => ({
    ...t,
    displayName: getFirstName(t.name)
  }));
  const longestStreaks = teacherStreaks
    .filter(t => t.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 5);

  container.innerHTML = `
    <h3>Teacher Performance Insights</h3>
    <div class="insights-grid">
      <div class="insight-card">
        <h4>Perfect Attendance</h4>
        <ul class="insight-list">
          ${perfectAttendance.length > 0 ?
            perfectAttendance.map(t => `<li>${t.displayName} <span class="badge-success">${t.total} days</span></li>`).join('') :
            '<li>No perfect attendance in this period</li>'
          }
        </ul>
      </div>

      <div class="insight-card">
        <h4>Most Absences</h4>
        <ul class="insight-list">
          ${mostAbsences.filter(t => t.absent > 0).slice(0, 5).map(t =>
            `<li>${t.displayName} <span class="badge-danger">${t.absent} days</span></li>`
          ).join('') || '<li>No absences recorded</li>'}
        </ul>
      </div>

      <div class="insight-card">
        <h4>Most Late Arrivals</h4>
        <ul class="insight-list">
          ${mostLate.filter(t => t.late > 0).slice(0, 5).map(t =>
            `<li>${t.displayName} <span class="badge-warning">${t.late} days</span></li>`
          ).join('') || '<li>No late arrivals recorded</li>'}
        </ul>
      </div>

      <div class="insight-card">
        <h4>Top Performers</h4>
        <ul class="insight-list">
          ${teacherArray.sort((a, b) => b.presentRate - a.presentRate).slice(0, 5).map(t =>
            `<li>${t.displayName} <span class="insight-value">${t.presentRate}% on-time</span></li>`
          ).join('')}
        </ul>
      </div>

      <div class="insight-card">
        <h4>Attendance Streak</h4>
        <ul class="insight-list">
          ${longestStreaks.length > 0 ?
            longestStreaks.map(t => `<li>${t.displayName} <span class="badge-success">${t.streak} days</span></li>`).join('') :
            '<li>No current streaks</li>'
          }
        </ul>
      </div>

      <div class="insight-card">
        <h4>Needs Attention</h4>
        <ul class="insight-list">
          ${needsAttention.length > 0 ?
            needsAttention.map(t => `<li>${t.displayName} <span class="badge-danger">${t.issueRate}% issues</span></li>`).join('') :
            '<li>All teachers performing well</li>'
          }
        </ul>
      </div>
    </div>
  `;
}

function calculateAttendanceStreaks(attendance) {
  const teacherStreaks = {};

  // Organize attendance by teacher
  const attendanceByTeacher = {};

  attendance.forEach(record => {
    if (!attendanceByTeacher[record.teacher_id]) {
      attendanceByTeacher[record.teacher_id] = {
        name: record.teacher_name,
        records: []
      };
    }
    attendanceByTeacher[record.teacher_id].records.push({
      date: record.date,
      status: record.status
    });
  });

  // Calculate current streak for each teacher
  Object.entries(attendanceByTeacher).forEach(([teacherId, data]) => {
    // Sort records by date descending (most recent first)
    const sortedRecords = data.records.sort((a, b) => b.date.localeCompare(a.date));

    let currentStreak = 0;

    // Count consecutive present days from most recent
    for (const record of sortedRecords) {
      if (record.status === 'present') {
        currentStreak++;
      } else {
        break; // Streak is broken
      }
    }

    teacherStreaks[teacherId] = {
      name: data.name,
      streak: currentStreak
    };
  });

  return Object.values(teacherStreaks);
}

function renderSubstituteCoverage(analytics) {
  const container = document.getElementById('substituteCoverage');

  container.innerHTML = `
    <h3>Substitute Coverage Analytics</h3>
    <div class="insights-grid">
      <div class="insight-card">
        <h4>Coverage Statistics</h4>
        <ul class="insight-list">
          <li>Total Classes Needing Coverage: <span class="insight-value">${analytics.classesNeedingCoverage}</span></li>
          <li>Classes Without Substitute: <span class="badge-danger">${analytics.classesWithoutCoverage}</span></li>
          <li>Classes With Coverage: <span class="badge-success">${analytics.classesNeedingCoverage - analytics.classesWithoutCoverage}</span></li>
          <li>Coverage Rate: <span class="insight-value">${analytics.classesNeedingCoverage > 0 ?
            (((analytics.classesNeedingCoverage - analytics.classesWithoutCoverage) / analytics.classesNeedingCoverage) * 100).toFixed(1) : 0}%</span></li>
        </ul>
      </div>

      <div class="insight-card">
        <h4>Substitute Teachers Used</h4>
        <ul class="insight-list">
          ${analytics.substitutesUsed.size > 0 ?
            `<li>Total Substitutes: <span class="insight-value">${analytics.substitutesUsed.size}</span></li>
             ${Array.from(analytics.substitutesUsed).slice(0, 10).map(name => `<li>${name}</li>`).join('')}` :
            '<li>No substitutes assigned in this period</li>'
          }
        </ul>
      </div>

      <div class="insight-card">
        <h4>Student Impact</h4>
        <ul class="insight-list">
          <li>Students Affected by Absences: <span class="insight-value">${analytics.studentsAffected.size}</span></li>
          ${analytics.studentsAffected.size > 0 ?
            '<li><small>Students who had classes affected by teacher absences</small></li>' :
            '<li>No students affected</li>'
          }
        </ul>
      </div>
    </div>
  `;
}

// Download analytics as image
async function downloadAnalytics() {
  alert('Generating analytics image... This may take a moment.');

  const overviewTab = document.getElementById('overview-tab');

  try {
    const canvas = await html2canvas(overviewTab, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      windowWidth: 1400
    });

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const startDate = document.getElementById('overviewStartDate').value;
      const endDate = document.getElementById('overviewEndDate').value;
      link.href = url;
      link.download = `attendance-analytics-${startDate}-to-${endDate}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  } catch (error) {
    console.error('Error generating analytics image:', error);
    alert('Error generating image. Please try again.');
  }
}
