// Legacy GBSA ERP System App JS

let attendanceData = [];
let selectedRowIndex = -1;
let selectedEmployeeId = null;

document.addEventListener("DOMContentLoaded", () => {
    initClock();
    loadAttendanceLogs();
});

// Live clock
function initClock() {
    const update = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const el = document.getElementById("currentClock");
        if (el) el.textContent = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    };
    update();
    setInterval(update, 1000);
}

// Fetch logs from backend
async function loadAttendanceLogs() {
    const tbody = document.getElementById("gridTbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="text-center" style="padding: 20px; color: #666;">
                <i class="fa-solid fa-spinner fa-spin"></i> 데이터를 조도하는 중입니다...
            </td>
        </tr>
    `;

    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const empName = document.getElementById("empName").value;

    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (empName) params.append("emp_name", empName);

    try {
        const res = await fetch(`/api/attendance/logs?${params.toString()}`);
        const json = await res.json();

        if (json.success) {
            attendanceData = json.data;
            document.getElementById("recordCount").textContent = attendanceData.length;
            renderGridTable();
        } else {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: red; padding: 20px;">데이터 조도 오류가 발생했습니다.</td></tr>`;
        }
    } catch (err) {
        console.error("API Error:", err);
        tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="color: red; padding: 20px;">서버 통신 장애: ${err.message}</td></tr>`;
    }
}

// Render 10-column Excel Table Grid
function renderGridTable() {
    const tbody = document.getElementById("gridTbody");

    if (attendanceData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center" style="padding: 25px; color: #888;">
                    조회 조건에 해당하는 근태 리더기 내역이 없습니다.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = attendanceData.map((row, index) => {
        const isSelected = selectedRowIndex === index;
        const selectedClass = isSelected ? "selected-row" : "";

        return `
            <tr class="${selectedClass}" onclick="selectGridRow(${index}, '${row.emp_id}', '${row.emp_name}')">
                <td class="text-center">${row.no}</td>
                <td class="text-center">${row.work_date}</td>
                <td class="text-center font-bold">${row.emp_name}</td>
                <td class="text-center">${row.emp_id}</td>
                <td class="text-left">${row.dept_name}</td>
                <td class="text-center font-mono">${row.card_number}</td>
                <td class="text-center">${row.work_type}</td>
                <td class="text-center">${row.work_shape}</td>
                <td class="text-center font-mono" style="${!row.check_in_time ? 'color:#e74c3c; font-weight:bold;' : ''}">${row.check_in_time || '-'}</td>
                <td class="text-center font-mono" style="${!row.check_out_time ? 'color:#9b59b6; font-weight:bold;' : ''}">${row.check_out_time || '-'}</td>
            </tr>
        `;
    }).join("");
}

// Row Click Selection
function selectGridRow(index, empId, empName) {
    selectedRowIndex = index;
    selectedEmployeeId = empId;
    document.getElementById("empName").value = empName;
    renderGridTable();
}

// Get targeted employee ID (selected row or text input)
function getTargetEmpId() {
    if (selectedEmployeeId) return selectedEmployeeId;

    const inputName = document.getElementById("empName").value.trim();
    if (!inputName) return null;

    // Search matching emp in data
    const matched = attendanceData.find(r => r.emp_name === inputName || r.emp_id === inputName);
    if (matched) return matched.emp_id;

    // Fallback default
    return "GBSA2018012";
}

// Handle Check-in Action
async function handleCheckIn() {
    const empId = getTargetEmpId();
    if (!empId) {
        showErpAlert("출근 처리할 사원을 선택하거나 사원명을 입력해주세요.");
        return;
    }

    const now = new Date();
    const workDate = (selectedRowIndex >= 0 && attendanceData[selectedRowIndex]) 
        ? attendanceData[selectedRowIndex].work_date 
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const checkInTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        const res = await fetch("/api/attendance/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emp_id: empId,
                work_date: workDate,
                check_in_time: checkInTime
            })
        });

        const json = await res.json();
        if (json.success) {
            showErpAlert(json.message);
            loadAttendanceLogs();
        } else {
            showErpAlert("출근 처리 중 오류 발생");
        }
    } catch (err) {
        showErpAlert(`통신 오류: ${err.message}`);
    }
}

// Handle Check-out Action
async function handleCheckOut() {
    const empId = getTargetEmpId();
    if (!empId) {
        showErpAlert("퇴근 처리할 사원을 선택하거나 사원명을 입력해주세요.");
        return;
    }

    const now = new Date();
    const workDate = (selectedRowIndex >= 0 && attendanceData[selectedRowIndex]) 
        ? attendanceData[selectedRowIndex].work_date 
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const checkOutTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    try {
        const res = await fetch("/api/attendance/check-out", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emp_id: empId,
                work_date: workDate,
                check_out_time: checkOutTime
            })
        });

        const json = await res.json();
        if (json.success) {
            showErpAlert(json.message);
            loadAttendanceLogs();
        } else {
            showErpAlert("퇴근 처리 중 오류 발생");
        }
    } catch (err) {
        showErpAlert(`통신 오류: ${err.message}`);
    }
}

// Download Excel File
function downloadExcel() {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const empName = document.getElementById("empName").value;

    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (empName) params.append("emp_name", empName);

    window.location.href = `/api/attendance/export/excel?${params.toString()}`;
    showErpAlert("엑셀 파일 다운로드가 시작되었습니다.");
}

// Alert Message Helper
function showErpAlert(msg) {
    const alertBox = document.getElementById("erpAlert");
    const alertMsg = document.getElementById("erpAlertMsg");
    if (alertBox && alertMsg) {
        alertMsg.textContent = msg;
        alertBox.classList.remove("hidden");
        setTimeout(() => {
            alertBox.classList.add("hidden");
        }, 3000);
    }
}
