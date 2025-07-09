/*

// -------------------
// 설정 및 초기화
// -------------------

// 본인의 Firebase 프로젝트 설정 값으로 교체하세요.
const firebaseConfig = {
    apiKey: "AIzaSyCWkpSlc2P0GccMcWE705HKMHQmwdnTo4c",
    authDomain: "breathoflife-ac0e7.firebaseapp.com",
    projectId: "breathoflife-ac0e7",
    storageBucket: "breathoflife-ac0e7.firebasestorage.app",
    messagingSenderId: "338476730148",
    appId: "1:338476730148:web:c8655d007ecf7b92ef95b1"
};

// 가나다순으로 정렬된 전체 진료과 목록
const ALL_DEPARTMENTS = [
    "가정의학과", "내과", "마취통증의학과", "병리과", "비뇨의학과", "산부인과",
    "성형외과", "소아청소년과", "신경외과", "안과", "영상의학과",
    "이비인후과", "재활의학과", "정신건강의학과", "정형외과", "직업환경의학과",
    "진단검사의학과", "피부과", "핵의학과", "흉부외과"
];

// Firebase 서비스 초기화
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


// -------------------
// HTML 요소 가져오기 (각 페이지에 맞게 존재할 수 있는 요소만 가져옴)
// -------------------
// 로그인 및 회원가입 페이지에서만 사용되는 요소
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// 메인 페이지에서만 사용되는 요소
const logoutButton = document.getElementById('logout-button');
const managementTitle = document.getElementById('management-title');
const updateBedsButton = document.getElementById('update-beds-button');
const updateTotalBeds = document.getElementById('total-beds');
const updateAvailableBeds = document.getElementById('available-beds');
const updateMessage = document.getElementById('update-message');
const departmentSelect = document.getElementById('department-select');
const addDepartmentButton = document.getElementById('add-department-button');
const departmentTagsContainer = document.getElementById('department-tags-container');
const callsContainer = document.getElementById('calls-container');
const noCallsMessage = document.getElementById('no-calls-message');
const acceptedCallsContainer = document.getElementById('accepted-calls-container');
const noAcceptedCallsMessage = document.getElementById('no-accepted-calls-message');


// -------------------
// 전역 변수
// -------------------
let currentHospitalId = null;
let currentHospitalName = null; // 현재 병원 이름을 저장할 변수
let pendingCallsListener = null; // 대기중인 요청 리스너
let acceptedCallsListener = null; // 수락한 요청 리스너


// -------------------
// 핵심 기능 함수 (변동 없음)
// -------------------

// 진료과 드롭다운 목록 채우기
function populateDepartmentSelect() {
    // departmentSelect 요소가 존재하는 경우에만 실행
    if (departmentSelect) {
        departmentSelect.innerHTML = '<option value="">-- 진료과 선택 --</option>';
        ALL_DEPARTMENTS.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
    }
}

// 진료과 태그 목록 화면에 표시
function renderDepartmentTags(departments = []) {
    if (departmentTagsContainer) { // 요소가 존재하는 경우에만 실행
        departmentTagsContainer.innerHTML = '';
        departments.forEach(dept => {
            const tag = document.createElement('div');
            tag.className = 'department-tag';
            tag.textContent = dept;
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-tag';
            removeBtn.textContent = 'x';
            removeBtn.onclick = () => removeDepartment(dept);
            tag.appendChild(removeBtn);
            departmentTagsContainer.appendChild(tag);
        });
    }
}

// 진료과 추가
function addDepartment() {
    const selectedDept = departmentSelect ? departmentSelect.value : null; // 요소 체크
    if (!selectedDept || !currentHospitalId) return;
    const hospitalDocRef = db.collection('hospitals').doc(currentHospitalId);
    hospitalDocRef.update({
        availableDepartments: firebase.firestore.FieldValue.arrayUnion(selectedDept)
    }).then(() => {
        db.collection('hospitals').doc(currentHospitalId).get().then(doc => renderDepartmentTags(doc.data().availableDepartments));
        if (departmentSelect) departmentSelect.value = ""; // 요소 체크
    });
}

// 진료과 삭제
function removeDepartment(deptName) {
    if (!deptName || !currentHospitalId) return;
    const hospitalDocRef = db.collection('hospitals').doc(currentHospitalId);
    hospitalDocRef.update({
        availableDepartments: firebase.firestore.FieldValue.arrayRemove(deptName)
    }).then(() => {
        db.collection('hospitals').doc(currentHospitalId).get().then(doc => renderDepartmentTags(doc.data().availableDepartments));
    });
}

// 치료 완료: 병원 기록으로 데이터를 복사하고, 원본 요청은 삭제
function completeCase(callId, callData) {
    if (!currentHospitalId || !currentHospitalName) return;

    const batch = db.batch();

    // 1. 병원의 하위 컬렉션으로 환자 데이터 복사하여 영구 기록 생성
    const newCaseRef = db.collection('hospitals').doc(currentHospitalId).collection('completed_cases').doc(callId);
    const caseRecord = {
        ...callData,
        status: 'completed',
        acceptedHospitalName: currentHospitalName, // 병원 이름 저장
        caseCompletedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    batch.set(newCaseRef, caseRecord);

    // 2. 원본 요청 문서 삭제
    const originalCallRef = db.collection('emergency_calls').doc(callId);
    batch.delete(originalCallRef);

    batch.commit().then(() => {
        alert("환자 치료를 완료하고 병원 기록으로 이전했습니다.\n(원본 요청은 삭제되었습니다)");
    }).catch(error => {
        console.error("치료 완료 처리 오류:", error);
        alert("치료 완료 처리 중 오류가 발생했습니다.");
    });
}

// 응급 요청 수락
function acceptCall(callId) {
    if (!currentHospitalId || !currentHospitalName) return;
    const callDocRef = db.collection("emergency_calls").doc(callId);
    db.runTransaction(transaction => {
        return transaction.get(callDocRef).then(callDoc => {
            if (!callDoc.exists) throw "요청 문서를 찾을 수 없습니다.";
            if (callDoc.data().status !== 'pending') throw "이미 다른 병원에서 수락한 요청입니다.";
            transaction.update(callDocRef, {
                status: "accepted",
                acceptedHospitalId: currentHospitalId,
                acceptedHospitalName: currentHospitalName, // 수락 시에도 병원 이름 추가
                acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    }).then(() => {
        alert("응급 요청을 수락했습니다.");
    }).catch(error => {
        alert(`오류: ${error}`);
        const cardToRemove = document.getElementById(`pending-call-${callId}`);
        if (cardToRemove) cardToRemove.remove();
    });
}

// 응급 요청 거절
function rejectCall(callId) {
    db.collection("emergency_calls").doc(callId).update({
        rejectedBy: firebase.firestore.FieldValue.arrayUnion(currentHospitalId)
    });
}

// 대기 중인 응급 요청 리스너
function listenForPendingCalls() {
    if (pendingCallsListener) pendingCallsListener();
    if (!currentHospitalId || !callsContainer) return; // callsContainer가 현재 페이지에 있는지 확인

    const hospitalRef = db.collection('hospitals').doc(currentHospitalId);

    hospitalRef.get().then(hospitalDoc => {
        const availableDepts = hospitalDoc.data().availableDepartments || [];

        const query = db.collection('emergency_calls').where('status', '==', 'pending');

        pendingCallsListener = query.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const callData = change.doc.data();
                const callId = change.doc.id;

                const recDepts = callData.recommendedDepartments || [];

                // 병원이 처리 가능한 요청인지 판단
                const isMatch = recDepts.some(dept => availableDepts.includes(dept));
                if (!isMatch) return;  // 필터에 맞지 않으면 무시

                const cardElement = document.getElementById(`pending-call-${callId}`);
                const isRejected = callData.rejectedBy && callData.rejectedBy.includes(currentHospitalId);

                if (isRejected || change.type === 'removed') {
                    if (cardElement) cardElement.remove();
                    return;
                }
                if (change.type === 'added' && !cardElement) {
                    const card = createPendingCallCard(callId, callData);
                    callsContainer.prepend(card);
                }
                if (change.type === 'modified') {
                    if (cardElement) cardElement.remove();
                }
            });

            if (noCallsMessage) { // noCallsMessage가 현재 페이지에 있는지 확인
                noCallsMessage.style.display = callsContainer.querySelectorAll('.call-card').length === 0 ? 'block' : 'none';
            }
        });
    });
}

// 수락한 응급 요청 리스너
function listenForAcceptedCalls() {
    if (acceptedCallsListener) acceptedCallsListener();
    if (!currentHospitalId || !acceptedCallsContainer) return; // acceptedCallsContainer가 현재 페이지에 있는지 확인
    const query = db.collection('emergency_calls').where('acceptedHospitalId', '==', currentHospitalId).where('status', '==', 'accepted');
    acceptedCallsListener = query.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const callData = change.doc.data();
            const callId = change.doc.id;
            const cardElement = document.getElementById(`accepted-call-${callId}`);

            if (change.type === 'removed' || (change.type === 'modified' && change.doc.data().status !== 'accepted')) {
                if (cardElement) cardElement.remove();
                return;
            }
            if (change.type === 'added' && !cardElement) {
                const card = createAcceptedCallCard(callId, callData);
                acceptedCallsContainer.prepend(card);
            }
        });
        if (noAcceptedCallsMessage) { // noAcceptedCallsMessage가 현재 페이지에 있는지 확인
            noAcceptedCallsMessage.style.display = acceptedCallsContainer.querySelectorAll('.accepted-call-card').length === 0 ? 'block' : 'none';
        }
    }, error => console.error("수락 요청 리스너 오류:", error));
}

// 대기 중인 요청 카드 HTML 생성
function createPendingCallCard(id, data) {
    const card = document.createElement('div');
    card.className = 'call-card';
    card.id = `pending-call-${id}`;
    const patient = data.patientInfo;
    const creationTime = data.createdAt ? data.createdAt.toDate().toLocaleTimeString('ko-KR') : '시간 없음';
    card.innerHTML = `
        <h3>환자: ${patient.name} (${patient.age}세, ${patient.gender})</h3>
        <p><strong>주요 증상:</strong> ${patient.symptom}</p>
        <p><strong>기타 정보:</strong> ${patient.otherInfo || '없음'}</p>
        <p><strong>요청 시각:</strong> ${creationTime}</p>
        <div class="call-actions">
            <button class="btn" data-action="accept" data-id="${id}">수락</button>
            <button class="btn btn-secondary" data-action="reject" data-id="${id}">거절</button>
        </div>
    `;
    return card;
}

// 수락한 요청 카드 HTML 생성
function createAcceptedCallCard(id, data) {
    const card = document.createElement('div');
    card.className = 'accepted-call-card';
    card.id = `accepted-call-${id}`;
    const patient = data.patientInfo;
    const acceptedTime = data.acceptedAt ? data.acceptedAt.toDate().toLocaleTimeString('ko-KR') : '시간 없음';
    card.innerHTML = `
        <h3>환자: ${patient.name} (${patient.age}세, ${patient.gender})</h3>
        <p><strong>주요 증상:</strong> ${patient.symptom}</p>
        <p><strong>수락 시각:</strong> ${acceptedTime}</p>
        <div class="accepted-call-actions">
            <button class="btn" data-action="complete" data-id="${id}">치료 완료</button>
        </div>
    `;
    card.querySelector('button[data-action="complete"]').addEventListener('click', () => {
        if (confirm(`${patient.name} 환자의 치료를 완료하고 기록을 저장하시겠습니까?`)) {
            completeCase(id, data);
        }
    });
    return card;
}


// -------------------
// 이벤트 리스너 설정 (각 페이지에 맞게 조건부 실행)
// -------------------

// 로그인 폼 제출
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                // 로그인 성공 시 메인 페이지로 리다이렉트
                window.location.href = '/main';
            })
            .catch(error => {
                let msg = "로그인 중 오류가 발생했습니다.";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') msg = "이메일 또는 비밀번호가 올바르지 않습니다.";
                alert(msg);
            });
    });
}


// 회원가입 폼 제출
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const hospitalName = document.getElementById('hospital-name').value;
        const address = document.getElementById('hospital-address').value;
        const lat = document.getElementById('hospital-lat').value;
        const lon = document.getElementById('hospital-lon').value;

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        if (isNaN(latitude) || isNaN(longitude)) {
            alert("유효한 위도와 경도를 숫자로 입력해주세요.");
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                const batch = db.batch();
                const hospitalRef = db.collection('hospitals').doc();
                batch.set(hospitalRef, {
                    hospitalName: hospitalName,
                    address: { full: address },
                    location: new firebase.firestore.GeoPoint(latitude, longitude),
                    beds: { total: 20, available: 5, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() },
                    availableDepartments: []
                });
                const userRef = db.collection('users').doc(userCredential.user.uid);
                batch.set(userRef, { email, name: "병원 관리자", role: 'hospital', hospitalId: hospitalRef.id });
                return batch.commit();
            })
            .then(() => {
                alert('회원가입이 완료되었습니다. 자동으로 로그인됩니다.');
                // 회원가입 성공 시 메인 페이지로 리다이렉트 (로그인 상태가 되므로)
                window.location.href = '/main';
            })
            .catch(error => {
                let msg = `회원가입 중 오류가 발생했습니다: ${error.message}`;
                if (error.code === 'auth/email-already-in-use') msg = "이미 사용 중인 이메일입니다.";
                alert(msg);
            });
    });
}


// 로그아웃 버튼 (main.html에만 존재)
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            // 로그아웃 성공 시 로그인 페이지로 리다이렉트
            window.location.href = '/';
        });
    });
}


// 병상 업데이트 (main.html에만 존재)
if (updateBedsButton) {
    updateBedsButton.addEventListener('click', () => {
        if (!currentHospitalId) return;
        const totalBeds = parseInt(updateTotalBeds.value, 10);
        const availableBeds = parseInt(updateAvailableBeds.value, 10);
        if (isNaN(totalBeds) || isNaN(availableBeds) || totalBeds < 0 || availableBeds < 0 || availableBeds > totalBeds) {
            alert("병상 수를 올바르게 입력해주세요.");
            return;
        }
        db.collection('hospitals').doc(currentHospitalId).update({
            'beds.total': totalBeds, 'beds.available': availableBeds, 'beds.lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            if (updateMessage) { // 요소 체크
                updateMessage.textContent = '업데이트 완료! (' + new Date().toLocaleTimeString() + ')';
                setTimeout(() => updateMessage.textContent = '', 3000);
            }
        });
    });
}


// 진료과 추가 (main.html에만 존재)
if (addDepartmentButton) {
    addDepartmentButton.addEventListener('click', addDepartment);
}

// 대기중인 요청 수락/거절 (이벤트 위임, main.html에만 존재)
if (callsContainer) {
    callsContainer.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' || !e.target.dataset.action) return;
        const { action, id } = e.target.dataset;
        if (action === 'accept') {
            if (confirm("이 응급 요청을 수락하시겠습니까?")) acceptCall(id);
        } else if (action === 'reject') {
            rejectCall(id);
        }
    });
}


// ------------------------
// 인증 상태 변경 리스너 (메인 로직)
// ------------------------
auth.onAuthStateChanged(async (user) => {
    const path = window.location.pathname;

    if (!user) {
        // 로그아웃 상태 처리
        if (path === '/main') window.location.href = '/';
        currentHospitalId = null;
        currentHospitalName = null;

        if (pendingCallsListener) pendingCallsListener();
        if (acceptedCallsListener) acceptedCallsListener();

        if (callsContainer) callsContainer.innerHTML = '<p id="no-calls-message">현재 대기 중인 응급 요청이 없습니다.</p>';
        if (acceptedCallsContainer) acceptedCallsContainer.innerHTML = '<p id="no-accepted-calls-message">현재 치료 중인 환자가 없습니다.</p>';
        if (loginForm) loginForm.reset();
        if (signupForm) signupForm.reset();
        return;
    }

    // 로그인된 상태
    if (path === '/' || path === '/register') {
        window.location.href = '/main';
        return;
    }

    if (path === '/main') {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) throw new Error("User doc not found");

            currentHospitalId = userDoc.data().hospitalId;

            const hospitalDoc = await db.collection('hospitals').doc(currentHospitalId).get();
            if (!hospitalDoc.exists) throw new Error("Hospital doc not found");

            const hospitalData = hospitalDoc.data();
            currentHospitalName = hospitalData.hospitalName;

            if (managementTitle) managementTitle.textContent = `${hospitalData.hospitalName} 응급실 관리`;
            if (updateTotalBeds) updateTotalBeds.value = hospitalData.beds.total;
            if (updateAvailableBeds) updateAvailableBeds.value = hospitalData.beds.available;
            renderDepartmentTags(hospitalData.availableDepartments);

            listenForPendingCalls();
            listenForAcceptedCalls();

            // ✅ AI 요약은 main.html에 ai-summary-container가 있을 때만 실행
            if (document.getElementById("ai-summary-container")) {
                console.log("📌 AI 요약 실행됨");
                fetchAISummary(currentHospitalId);
            }

        } catch (error) {
            console.error("데이터 로드 중 오류:", error);
            auth.signOut(); // 오류 발생 시 로그아웃
        }
    }
});

// --- 앱 시작 시 초기화 (현재 페이지에 요소가 있는 경우에만 실행) ---
if (departmentSelect) {
    populateDepartmentSelect();
}

async function fetchAISummary(hospitalId) {
    console.log("✅ fetchAISummary 전달 ID:", hospitalId);

    const container = document.getElementById("ai-summary-container");
    if (!container) return;

    try {
        const res = await fetch(`http://127.0.0.1:8084/api/ai-summary?hospital_id=${hospitalId}`);
        const data = await res.json();
        console.log("📦 AI 요약 응답:", data);

        container.innerHTML = "";
        const raw = data.result;

        // ⛏️ 명확하게 각 섹션을 구분
        const section1 = raw.match(/📊 시간대별 환자 수([\s\S]*?)👶 연령대별 환자 수/);
        const section2 = raw.match(/👶 연령대별 환자 수([\s\S]*?)🩺 증상별 진료과목 추천/);
        const section3 = raw.match(/🩺 증상별 진료과목 추천([\s\S]*?)🧠 AI 분석 결과/);
        const section4 = raw.match(/🧠 AI 분석 결과([\s\S]*)/);

        const sections = [
            { title: "📊 시간대별 환자 수", content: section1?.[1]?.trim() || "정보 없음" },
            { title: "👶 연령대별 환자 수", content: section2?.[1]?.trim() || "정보 없음" },
            { title: "🩺 증상별 진료과목 추천", content: section3?.[1]?.trim() || "정보 없음" },
            { title: "🧠 AI 분석 결과", content: section4?.[1]?.trim() || "정보 없음" },
        ];

        // 📦 카드 생성
        sections.forEach(({ title, content }) => {
            const card = document.createElement("div");
            card.className = "summary-card";

            const header = document.createElement("div");
            header.className = "summary-title";
            header.textContent = title;

            const body = document.createElement("div");
            body.className = "summary-text";
            const cleanContent = content
                .split('\n')
                .filter(line => !line.includes("━━━━━━━━"))
                .join("<br>");
            body.innerHTML = cleanContent;

            card.appendChild(header);
            card.appendChild(body);
            container.appendChild(card);
        });

    } catch (err) {
        console.error("❌ AI 분석 실패:", err);
        container.innerText = "❌ AI 분석 실패";
    }
}
*/

// -------------------
// 설정 및 초기화
// -------------------

// 본인의 Firebase 프로젝트 설정 값으로 교체하세요.
const firebaseConfig = {
    apiKey: "AIzaSyCWkpSlc2P0GccMcWE705HKMHQmwdnTo4c",
    authDomain: "breathoflife-ac0e7.firebaseapp.com",
    projectId: "breathoflife-ac0e7",
    storageBucket: "breathoflife-ac0e7.firebasestorage.app",
    messagingSenderId: "338476730148",
    appId: "1:338476730148:web:c8655d007ecf7b92ef95b1"
};

// 가나다순으로 정렬된 전체 진료과 목록
const ALL_DEPARTMENTS = [
    "가정의학과", "내과", "마취통증의학과", "병리과", "비뇨의학과", "산부인과",
    "성형외과", "소아청소년과", "신경외과", "안과", "영상의학과",
    "이비인후과", "재활의학과", "정신건강의학과", "정형외과", "직업환경의학과",
    "진단검사의학과", "피부과", "핵의학과", "흉부외과"
];

// Firebase 서비스 초기화
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


// -------------------
// HTML 요소 가져오기 (각 페이지에 맞게 존재할 수 있는 요소만 가져옴)
// -------------------
// 로그인 및 회원가입 페이지에서만 사용되는 요소
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

// 메인 페이지에서만 사용되는 요소
const logoutButton = document.getElementById('logout-button');
const managementTitle = document.getElementById('management-title');
const updateBedsButton = document.getElementById('update-beds-button');
const updateTotalBeds = document.getElementById('total-beds');
const updateAvailableBeds = document.getElementById('available-beds');
const updateMessage = document.getElementById('update-message');
const departmentSelect = document.getElementById('department-select');
const addDepartmentButton = document.getElementById('add-department-button');
const departmentTagsContainer = document.getElementById('department-tags-container');
const callsContainer = document.getElementById('calls-container');
const noCallsMessage = document.getElementById('no-calls-message');
const acceptedCallsContainer = document.getElementById('accepted-calls-container');
const noAcceptedCallsMessage = document.getElementById('no-accepted-calls-message');

// -------------------
// 전역 변수
// -------------------
let currentHospitalId = null;
let currentHospitalName = null; // 현재 병원 이름을 저장할 변수
let pendingCallsListener = null; // 대기중인 요청 리스너
let acceptedCallsListener = null; // 수락한 요청 리스너
let historyData = [];
const filterButtons = document.querySelectorAll('.history-filter button[data-filter]');
const searchInput   = document.getElementById('history-search-input');
const tableBody     = document.querySelector('#history-table tbody');
const pendingCallsStore = {};

// -------------------
// 핵심 기능 함수 (변동 없음)
// -------------------

// 진료과 드롭다운 목록 채우기
function populateDepartmentSelect() {
    // departmentSelect 요소가 존재하는 경우에만 실행
    if (departmentSelect) {
        departmentSelect.innerHTML = '<option value="">-- 진료과 선택 --</option>';
        ALL_DEPARTMENTS.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
    }
}

// 진료과 태그 목록 화면에 표시
function renderDepartmentTags(departments = []) {
    if (departmentTagsContainer) { // 요소가 존재하는 경우에만 실행
        departmentTagsContainer.innerHTML = '';
        departments.forEach(dept => {
            const tag = document.createElement('div');
            tag.className = 'department-tag';
            tag.textContent = dept;
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-tag';
            removeBtn.textContent = 'x';
            removeBtn.onclick = () => removeDepartment(dept);
            tag.appendChild(removeBtn);
            departmentTagsContainer.appendChild(tag);
        });
    }
}

// 진료과 추가
function addDepartment() {
    const selectedDept = departmentSelect ? departmentSelect.value : null; // 요소 체크
    if (!selectedDept || !currentHospitalId) return;
    const hospitalDocRef = db.collection('hospitals').doc(currentHospitalId);
    hospitalDocRef.update({
        availableDepartments: firebase.firestore.FieldValue.arrayUnion(selectedDept)
    }).then(() => {
        db.collection('hospitals').doc(currentHospitalId).get().then(doc => renderDepartmentTags(doc.data().availableDepartments));
        if (departmentSelect) departmentSelect.value = ""; // 요소 체크
    });
}

// 진료과 삭제
function removeDepartment(deptName) {
    if (!deptName || !currentHospitalId) return;
    const hospitalDocRef = db.collection('hospitals').doc(currentHospitalId);
    hospitalDocRef.update({
        availableDepartments: firebase.firestore.FieldValue.arrayRemove(deptName)
    }).then(() => {
        db.collection('hospitals').doc(currentHospitalId).get().then(doc => renderDepartmentTags(doc.data().availableDepartments));
    });
}

function completeCase(callId, callData) {
    console.log("✅ completeCase() 호출됨");
    console.log("📌 callId:", callId);
    console.log("📌 callData:", callData);

    if (!currentHospitalId || !currentHospitalName) {
        console.warn("❗ currentHospitalId 또는 currentHospitalName이 설정되지 않았습니다.");
        alert("병원 정보가 설정되지 않았습니다. 로그인 여부를 확인하세요.");
        return;
    }

    // Firebase 객체 확인
    if (!firebase || !firebase.firestore) {
        console.error("❌ Firebase가 초기화되지 않았습니다.");
        alert("Firebase 초기화 오류");
        return;
    }

    const db = firebase.firestore();
    const batch = db.batch();

    // ✅ 새 문서 위치: hospitals/{currentHospitalId}/completed_cases/{callId}
    const newCaseRef = db.collection('hospitals')
        .doc(currentHospitalId)
        .collection('completed_cases')
        .doc(callId);

    const caseRecord = {
        ...callData,
        status: 'completed',
        acceptedHospitalName: currentHospitalName,
        caseCompletedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    console.log("📦 저장할 문서 내용:", caseRecord);

    // 🔁 batch 작업 구성
    batch.set(newCaseRef, caseRecord);

    const originalCallRef = db.collection('emergency_calls').doc(callId);
    batch.delete(originalCallRef);

    // ✅ 커밋 및 결과 확인
    batch.commit()
        .then(() => {
            console.log("✅ Firestore batch 저장 및 삭제 성공");
            alert("환자 치료를 완료하고 병원 기록으로 이전했습니다.\n(원본 요청은 삭제되었습니다)");
            document.getElementById(`accepted-call-${callId}`)?.remove();
        })
        .catch(error => {
            console.error("❌ 치료 완료 처리 중 오류:", error);
            alert("Firestore에 기록 저장 중 오류가 발생했습니다.");
        });
}



// -------------------
// 수락 / 거절 처리
// -------------------
function acceptCall(callId) {
    const callRef = db.collection('emergency_calls').doc(callId);
    const hospRef = db.collection('hospitals').doc(currentHospitalId);

    db.runTransaction(tx => {
        return tx.get(hospRef).then(hs => {
            const bedsAvail = hs.data().beds.available;
            if (bedsAvail <= 0) throw "가용 병상이 없습니다.";
            // 업데이트
            tx.update(callRef, {
                status: "accepted",
                acceptedHospitalId: currentHospitalId,
                acceptedHospitalName: currentHospitalName,
                acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.update(hospRef, {
                'beds.available': firebase.firestore.FieldValue.increment(-1),
                'beds.lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    })
        .then(() => {
            alert("응급 요청 수락됨")
            document.getElementById(`pending-call-${callId}`)?.remove();
        })
        .catch(err => alert(`수락 실패: ${err}`));
}

// 응급 요청 거절
function rejectCall(callId, data) {
    // 1) emergency_calls에만 status/rejectedAt/rejectedBy 추가
    db.collection('emergency_calls').doc(callId).update({
        status: 'rejected',
        rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
        rejectedBy: firebase.firestore.FieldValue.arrayUnion(currentHospitalId)
    });
    // UI 카드만 지워 주고 문서는 남겨둡니다.
    document.getElementById(`pending-call-${callId}`)?.remove();
}

// 대기 중인 응급 요청 리스너
function listenForPendingCalls() {
    if (pendingCallsListener) pendingCallsListener();
    if (!currentHospitalId || !callsContainer) return; // callsContainer가 현재 페이지에 있는지 확인

    const hospitalRef = db.collection('hospitals').doc(currentHospitalId);

    hospitalRef.get().then(hospitalDoc => {
        const availableDepts = hospitalDoc.data().availableDepartments || [];

        const query = db.collection('emergency_calls').where('status', '==', 'pending');

        pendingCallsListener = query.onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const callData = change.doc.data();
                const callId = change.doc.id;

                const recDepts = callData.recommendedDepartments || [];

                // 병원이 처리 가능한 요청인지 판단
                const isMatch = recDepts.some(dept => availableDepts.includes(dept));
                if (!isMatch) return;  // 필터에 맞지 않으면 무시

                const cardElement = document.getElementById(`pending-call-${callId}`);
                const isRejected = callData.rejectedBy && callData.rejectedBy.includes(currentHospitalId);

                if (isRejected || change.type === 'removed') {
                    if (cardElement) cardElement.remove();
                    return;
                }
                if (change.type === 'added' && !cardElement) {
                    const card = createPendingCallCard(callId, callData);
                    callsContainer.prepend(card);
                }
                if (change.type === 'modified') {
                    if (cardElement) cardElement.remove();
                }
            });

            if (noCallsMessage) { // noCallsMessage가 현재 페이지에 있는지 확인
                noCallsMessage.style.display = callsContainer.querySelectorAll('.call-card').length === 0 ? 'block' : 'none';
            }
        });
    });
}

// 수락한 응급 요청 리스너
function listenForAcceptedCalls() {
    if (acceptedCallsListener) acceptedCallsListener();
    if (!currentHospitalId || !acceptedCallsContainer) return; // acceptedCallsContainer가 현재 페이지에 있는지 확인
    const query = db.collection('emergency_calls').where('acceptedHospitalId', '==', currentHospitalId).where('status', '==', 'accepted');
    acceptedCallsListener = query.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const callData = change.doc.data();
            const callId = change.doc.id;
            const cardElement = document.getElementById(`accepted-call-${callId}`);

            if (change.type === 'removed' || (change.type === 'modified' && change.doc.data().status !== 'accepted')) {
                if (cardElement) cardElement.remove();
                return;
            }
            if (change.type === 'added' && !cardElement) {
                const card = createAcceptedCallCard(callId, callData);
                acceptedCallsContainer.prepend(card);
            }
        });
        if (noAcceptedCallsMessage) { // noAcceptedCallsMessage가 현재 페이지에 있는지 확인
            noAcceptedCallsMessage.style.display = acceptedCallsContainer.querySelectorAll('.accepted-call-card').length === 0 ? 'block' : 'none';
        }
    }, error => console.error("수락 요청 리스너 오류:", error));
}

// 대기 중인 요청 카드 HTML 생성
function createPendingCallCard(id, data) {
    // 1) callData 저장해 두기
    pendingCallsStore[id] = data;

    const card = document.createElement('div');
    card.className = 'call-card';
    card.id = `pending-call-${id}`;

    const patient = data.patientInfo;
    const creationTime = data.createdAt
        ? data.createdAt.toDate().toLocaleTimeString('ko-KR')
        : '시간 없음';

    card.innerHTML = `
    <h3>환자: ${patient.name} (${patient.age}세, ${patient.gender})</h3>
    <p><strong>주요 증상:</strong> ${patient.symptom}</p>
    <p><strong>기타 정보:</strong> ${patient.otherInfo || '없음'}</p>
    <p><strong>요청 시각:</strong> ${creationTime}</p>
    <div class="call-actions">
      <button class="btn" data-action="accept" data-id="${id}">수락</button>
      <button class="btn btn-secondary" data-action="reject" data-id="${id}">거절</button>
    </div>
  `;
    return card;
}

// 수락한 요청 카드 HTML 생성
function createAcceptedCallCard(id, data) {
    const card = document.createElement('div');
    card.className = 'accepted-call-card';
    card.id = `accepted-call-${id}`;
    const patient = data.patientInfo;
    const acceptedTime = data.acceptedAt
        ? data.acceptedAt.toDate().toLocaleTimeString('ko-KR')
        : '시간 없음';
    const otherInfo = patient.otherInfo || '없음';

    card.innerHTML = `
        <h3>환자: ${patient.name} (${patient.age}세, ${patient.gender})</h3>
        <p><strong>주요 증상:</strong> ${patient.symptom}</p>
        <p><strong>수락 시각:</strong> ${acceptedTime}</p>
        <div class="accepted-call-actions">
            <button class="btn" data-action="complete" data-id="${id}">치료 완료</button>
        </div>
    `;
    card.querySelector('button[data-action="complete"]').addEventListener('click', () => {
        if (confirm(`${patient.name} 환자의 치료를 완료하고 기록을 저장하시겠습니까?`)) {
            completeCase(id, data);
        }
    });
    return card;
}

// 응급 콜 기록
document.addEventListener('DOMContentLoaded', () => {

    // --- 실시간 구독으로 변경 ---
    historyData = [];

    // 수용 완료 리스너
    db.collection('emergency_calls')
        .where('acceptedHospitalId', '==', currentHospitalId)
        .onSnapshot(accSnap => {
            historyData = historyData.filter(i => i.status !== '수용 완료');
            accSnap.forEach(doc => {
                const d = doc.data();
                historyData.push({
                    time: d.acceptedAt?.toDate?.()?.toLocaleString() ?? '시간 없음',
                    patient: `${d.patientInfo?.age ?? '-'}세 ${d.patientInfo?.gender ?? '-'}, ${d.patientInfo?.symptom ?? '-'}`,
                    status: '수용 완료'
                });
            });
            renderHistory();
        });

// 수용 불가 리스너
    db.collection('emergency_calls')
        .where('rejectedBy', 'array-contains', currentHospitalId)
        .onSnapshot(rejSnap => {
            historyData = historyData.filter(i => i.status !== '수용 불가');
            rejSnap.forEach(doc => {
                const d = doc.data();
                historyData.push({
                    time: d.rejectedAt?.toDate?.()?.toLocaleString() ?? '시간 없음',
                    patient: `${d.patientInfo?.age ?? '-'}세 ${d.patientInfo?.gender ?? '-'}, ${d.patientInfo?.symptom ?? '-'}`,
                    status: '수용 불가'
                });
            });
            renderHistory();
        });


    // 필터 & 검색 이벤트
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // 1) 모든 버튼에서 'btn-primary'와 'active' 제거, 'btn-secondary' 추가
            filterButtons.forEach(b => {
                b.classList.remove('btn-primary', 'active');
                b.classList.add('btn-secondary');
            });
            // 2) 클릭된 버튼에는 'btn-secondary' 제거, 'btn-primary' + 'active' 추가
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary', 'active');

            // 3) 필터링 결과 다시 렌더
            renderHistory();
        });
    });
    searchInput.addEventListener('input', renderHistory);

    function renderHistory() {
        const filter = document.querySelector('.history-filter .btn-primary').dataset.filter;
        const kw = searchInput.value.trim().toLowerCase();
        tableBody.innerHTML = '';

        historyData
            .filter(item => {
                if (filter==='accepted') return item.status==='수용 완료';
                if (filter==='rejected') return item.status==='수용 불가';
                return true;
            })
            .filter(item => item.patient.toLowerCase().includes(kw) || item.status.includes(kw))
            .forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td>${item.time}</td>
          <td>${item.patient}</td>
          <td><span class="status-label ${item.status==='수용 완료'?'accepted':'rejected'}">${item.status}</span></td>
        `;
                tableBody.appendChild(tr);
            });
    }
});

// -------------------
// 이벤트 리스너 설정 (각 페이지에 맞게 조건부 실행)
// -------------------

// 로그인 폼 제출
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                // 로그인 성공 시 메인 페이지로 리다이렉트
                window.location.href = '/main';
            })
            .catch(error => {
                let msg = "로그인 중 오류가 발생했습니다.";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') msg = "이메일 또는 비밀번호가 올바르지 않습니다.";
                alert(msg);
            });
    });
}


// 회원가입 폼 제출
if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const hospitalName = document.getElementById('hospital-name').value;
        const address = document.getElementById('hospital-address').value;
        const lat = document.getElementById('hospital-lat').value;
        const lon = document.getElementById('hospital-lon').value;

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        if (isNaN(latitude) || isNaN(longitude)) {
            alert("유효한 위도와 경도를 숫자로 입력해주세요.");
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                const batch = db.batch();
                const hospitalRef = db.collection('hospitals').doc();
                batch.set(hospitalRef, {
                    hospitalName: hospitalName,
                    address: { full: address },
                    location: new firebase.firestore.GeoPoint(latitude, longitude),
                    beds: { total: 20, available: 5, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() },
                    availableDepartments: []
                });
                const userRef = db.collection('users').doc(userCredential.user.uid);
                batch.set(userRef, { email, name: "병원 관리자", role: 'hospital', hospitalId: hospitalRef.id });
                return batch.commit();
            })
            .then(() => {
                alert('회원가입이 완료되었습니다. 자동으로 로그인됩니다.');
                // 회원가입 성공 시 메인 페이지로 리다이렉트 (로그인 상태가 되므로)
                window.location.href = '/main';
            })
            .catch(error => {
                let msg = `회원가입 중 오류가 발생했습니다: ${error.message}`;
                if (error.code === 'auth/email-already-in-use') msg = "이미 사용 중인 이메일입니다.";
                alert(msg);
            });
    });
}


// 로그아웃 버튼 (main.html에만 존재)
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            // 로그아웃 성공 시 로그인 페이지로 리다이렉트
            window.location.href = '/';
        });
    });
}


// 병상 업데이트 (main.html에만 존재)
if (updateBedsButton) {
    updateBedsButton.addEventListener('click', () => {
        if (!currentHospitalId) return;
        const totalBeds = parseInt(updateTotalBeds.value, 10);
        const availableBeds = parseInt(updateAvailableBeds.value, 10);
        if (isNaN(totalBeds) || isNaN(availableBeds) || totalBeds < 0 || availableBeds < 0 || availableBeds > totalBeds) {
            alert("병상 수를 올바르게 입력해 주세요.");
            return;
        }
        db.collection('hospitals').doc(currentHospitalId).update({
            'beds.total': totalBeds, 'beds.available': availableBeds, 'beds.lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            if (updateMessage) { // 요소 체크
                updateMessage.textContent = '업데이트 완료! (' + new Date().toLocaleTimeString() + ')';
                setTimeout(() => updateMessage.textContent = '', 3000);
            }
        });
    });
}


// 진료과 추가 (main.html에만 존재)
if (addDepartmentButton) {
    addDepartmentButton.addEventListener('click', addDepartment);
}

// -------------------
// 이벤트 위임: 수락 / 거절 버튼
// -------------------
document.getElementById('calls-container').addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') return;
    const action = e.target.dataset.action;
    const id     = e.target.dataset.id;
    if (action === 'accept') {
        if (confirm("수락 하시겠습니까?")) acceptCall(id);
    }
    else if (action === 'reject') {
        if (confirm("거절 하시겠습니까?"))
            rejectCall(id, pendingCallsStore[id]);
    }
});


// ------------------------
// 인증 상태 변경 리스너 (메인 로직)
// ------------------------
auth.onAuthStateChanged(user => {
    const path = window.location.pathname;

    if (user) {
        // 로그인 된 상태인데 로그인/회원가입 페이지에 있으면 메인으로
        if (path === '/' || path === '/register') {
            window.location.href = '/main';
            return;
        }

        // 메인 페이지: 데이터 로드 & 구독 등록
        if (path === '/main') {
            db.collection('users').doc(user.uid).get()
                .then(userDoc => {
                    if (!userDoc.exists) {
                        auth.signOut();
                        return Promise.reject("User doc not found.");
                    }
                    currentHospitalId = userDoc.data().hospitalId;
                    return db.collection('hospitals').doc(currentHospitalId).get();
                })
                .then(hospitalDoc => {
                    if (!hospitalDoc.exists) {
                        auth.signOut();
                        return Promise.reject("Hospital doc not found.");
                    }

                    const hd = hospitalDoc.data();
                    currentHospitalName = hd.hospitalName;
                    if (managementTitle) managementTitle.textContent = `${hd.hospitalName} 응급실 관리`;
                    if (updateTotalBeds) updateTotalBeds.value = hd.beds.total;
                    if (updateAvailableBeds) updateAvailableBeds.value = hd.beds.available;
                    renderDepartmentTags(hd.availableDepartments);

                    // 병상 변화 감지 → 대기 리스트 제어
                    db.collection('hospitals').doc(currentHospitalId).onSnapshot(hsnap => {
                        const avail = hsnap.data().beds.available || 0;
                        updateAvailableBeds.value = avail;
                        if (avail <= 0) {
                            callsContainer.innerHTML = '<p class="no-beds">가용 병상이 없습니다.</p>';
                            if (pendingCallsListener) pendingCallsListener(); // 리스너 해제
                        } else {
                            listenForPendingCalls();
                        }
                    });

                    listenForAcceptedCalls();
                    subscribeHistory();

                    // ✅ AI 요약 컨테이너 있을 때만 실행
                    if (document.getElementById("ai-summary-container")) {
                        fetchAISummary(currentHospitalId);
                    }
                })
                .catch(err => {
                    console.error("데이터 로드 중 오류:", err);
                    auth.signOut();
                });
        }

    } else {
        // 로그아웃 상태
        if (path === '/main') {
            window.location.href = '/';
            return;
        }
        currentHospitalId = null;
        currentHospitalName = null;
        if (pendingCallsListener)  pendingCallsListener();
        if (acceptedCallsListener) acceptedCallsListener();
        if (callsContainer) callsContainer.innerHTML = '<p id="no-calls-message">현재 대기 중인 요청이 없습니다.</p>';
        if (acceptedCallsContainer) acceptedCallsContainer.innerHTML = '<p id="no-accepted-calls-message">현재 치료 중인 환자가 없습니다.</p>';
        if (loginForm) loginForm.reset();
        if (signupForm) signupForm.reset();
    }
});

// --- 페이지 요소 초기화
if (departmentSelect) {
    populateDepartmentSelect();
}


function initHistoryListener() {

    // 수용 완료 리스너
    db.collection('emergency_calls')
        .where('acceptedHospitalId', '==', currentHospitalId)
        .onSnapshot(accSnap => {
            historyData = historyData.filter(i => i.status !== '수용 완료');
            accSnap.forEach(doc => {
                const d = doc.data();
                historyData.push({
                    time:    d.acceptedAt.toDate().toLocaleString(),
                    patient: `${d.patientInfo.age}세 ${d.patientInfo.gender}, ${d.patientInfo.symptom}`,
                    status:  '수용 완료'
                });
            });
            renderHistory();
        });

    // 수용 불가 리스너
    db.collection('emergency_calls')
        .where('rejectedBy', 'array-contains', currentHospitalId)
        .onSnapshot(rejSnap => {
            historyData = historyData.filter(i => i.status !== '수용 불가');
            rejSnap.forEach(doc => {
                const d = doc.data();
                historyData.push({
                    time:    d.rejectedAt.toDate().toLocaleString(),
                    patient: `${d.patientInfo.age}세 ${d.patientInfo.gender}, ${d.patientInfo.symptom}`,
                    status:  '수용 불가'
                });
            });
            renderHistory();
        });

    // 필터 버튼 & 검색 이벤트
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.classList.remove('btn-primary', 'active');
                b.classList.add('btn-secondary');
            });
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary', 'active');
            renderHistory();
        });
    });
    searchInput.addEventListener('input', renderHistory);

    // 렌더 함수
    function renderHistory() {
        const filter = document.querySelector('.history-filter .btn-primary').dataset.filter;
        const kw = searchInput.value.trim().toLowerCase();
        tableBody.innerHTML = '';

        historyData
            .filter(item => {
                if (filter === 'accepted') return item.status === '수용 완료';
                if (filter === 'rejected') return item.status === '수용 불가';
                return true;
            })
            .filter(item => item.patient.toLowerCase().includes(kw) || item.status.includes(kw))
            .forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td>${item.time}</td>
          <td>${item.patient}</td>
          <td><span class="status-label ${item.status === '수용 완료' ? 'accepted' : 'rejected'}">
            ${item.status}
          </span></td>`;
                tableBody.appendChild(tr);
            });
    }
}


// -------------------------------
// 응급 콜 기록 구독 함수
// -------------------------------
function subscribeHistory() {
    historyData = [];

    // --- 수용 / 완료 케이스 ---
    db.collection('emergency_calls')
        .where('acceptedHospitalId','==',currentHospitalId)
        .onSnapshot(snap => {
            // 이전 '수용 완료' 기록 삭제
            historyData = historyData.filter(i => i.status !== '수용 완료');

            snap.forEach(doc => {
                const d = doc.data();
                // caseCompletedAt(치료완료) 또는 acceptedAt(수락) 중 먼저 있는 쪽
                const ts = d.caseCompletedAt || d.acceptedAt;
                // ts 가 Firestore 타임스탬프 객체인지 확인
                const time = (ts && typeof ts.toDate === 'function')
                    ? ts.toDate().toLocaleString()
                    : '시간 없음';

                historyData.push({
                    time,
                    patient: `${d.patientInfo.age}세 ${d.patientInfo.gender}, ${d.patientInfo.symptom}`,
                    status: '수용 완료'
                });
            });
            renderHistory();
        });

    // --- 거절 케이스 ---
    db.collection('emergency_calls')
        .where('rejectedBy','array-contains',currentHospitalId)
        .onSnapshot(snap => {
            historyData = historyData.filter(i => i.status !== '수용 불가');

            snap.forEach(doc => {
                const d = doc.data();
                const ts = d.rejectedAt;
                const time = (ts && typeof ts.toDate === 'function')
                    ? ts.toDate().toLocaleString()
                    : '시간 없음';

                historyData.push({
                    time,
                    patient: `${d.patientInfo.age}세 ${d.patientInfo.gender}, ${d.patientInfo.symptom}`,
                    status: '수용 불가'
                });
            });
            renderHistory();
        });

    // 필터/검색 이벤트 (한 번만 설정)
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.classList.replace('btn-primary','btn-secondary');
                b.classList.remove('active');
            });
            btn.classList.replace('btn-secondary','btn-primary');
            btn.classList.add('active');
            renderHistory();
        });
    });
    searchInput.addEventListener('input', renderHistory);
}

function renderHistory() {
    const filter = document.querySelector('.history-filter .btn-primary').dataset.filter;
    const kw     = searchInput.value.trim().toLowerCase();
    tableBody.innerHTML = '';

    historyData
        .filter(item => {
            if (filter==='accepted') return item.status==='수용 완료';
            if (filter==='rejected') return item.status==='수용 불가';
            return true;
        })
        .filter(item =>
            item.patient.toLowerCase().includes(kw) ||
            item.status.includes(kw)
        )
        .forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${item.time}</td>
        <td>${item.patient}</td>
        <td>
          <span class="status-label ${item.status==='수용 완료'?'accepted':'rejected'}">
            ${item.status}
          </span>
        </td>`;
            tableBody.appendChild(tr);
        });
}
// ✅ 1. 함수 정의: fetchAISummary 바깥에 위치
function removeZeroLines(text) {
    return text
        .split('\n')
        .filter(line => !line.includes("→ 0명") && !line.includes("0명"))
        .join('\n');
}

async function fetchAISummary(hospitalId) {
    console.log("✅ fetchAISummary 전달 ID:", hospitalId);

    const container = document.getElementById("ai-summary-container");
    if (!container) return;

    try {
        const res = await fetch(`http://127.0.0.1:8084/api/ai-summary?hospital_id=${hospitalId}`);
        const data = await res.json();
        console.log("📦 AI 요약 응답:", data);

        container.innerHTML = "";

        // ✅ 3. 먼저 0명 줄 제거
        const raw = removeZeroLines(data.result);
        // ⛏️ 명확하게 각 섹션을 구분
        const section1 = raw.match(/📊 시간대별 환자 수([\s\S]*?)👶 연령대별 환자 수/);
        const section2 = raw.match(/👶 연령대별 환자 수([\s\S]*?)🩺 증상별 진료과목 추천/);
        const section3 = raw.match(/🩺 증상별 진료과목 추천([\s\S]*?)🧠 AI 분석 결과/);
        const section4 = raw.match(/🧠 AI 분석 결과([\s\S]*)/);

        const sections = [
            { title: "📊 시간대별 환자 수", content: section1?.[1]?.trim() || "정보 없음" },
            { title: "👶 연령대별 환자 수", content: section2?.[1]?.trim() || "정보 없음" },
            { title: "🩺 증상별 진료과목 추천", content: section3?.[1]?.trim() || "정보 없음" },
            { title: "🧠 AI 분석 결과", content: section4?.[1]?.trim() || "정보 없음" },
        ];

        // 📦 카드 생성
        sections.forEach(({ title, content }) => {
            const card = document.createElement("div");
            card.className = "summary-card";

            const header = document.createElement("div");
            header.className = "summary-title";
            header.textContent = title;

            const body = document.createElement("div");
            body.className = "summary-text";
            const cleanContent = content
                .split('\n')
                .filter(line => !line.includes("━━━━━━━━"))
                .join("<br>");
            body.innerHTML = cleanContent;

            card.appendChild(header);
            card.appendChild(body);
            container.appendChild(card);
        });

    } catch (err) {
        console.error("❌ AI 분석 실패:", err);
        container.innerText = "❌ AI 분석 실패";
    }

    // --------------------------------------------------
//  주소→위경도 자동 채우기
// --------------------------------------------------
    function initGeocoder() {
        const addressInput = document.getElementById('hospital-address');
        const latInput     = document.getElementById('hospital-lat');
        const lngInput     = document.getElementById('hospital-lon');

        if (!addressInput) return;

        // 주소 입력 필드에 blur(포커스 아웃) 이벤트를 걸거나
        addressInput.addEventListener('blur', () => {
            const address = addressInput.value.trim();
            if (!address) return;

            // 구글 Geocoder 객체 생성
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const loc = results[0].geometry.location;
                    latInput.value = loc.lat().toFixed(6);
                    lngInput.value = loc.lng().toFixed(6);
                } else {
                    console.warn('Geocoding 실패:', status);
                }
            });
        });
    }

// 구글 맵스 라이브러리가 로드된 후 initGeocoder 실행
    window.initGeocoder = initGeocoder;
}
// ------------------------------
// 🔎 비정상 age 데이터 탐지 함수
// ------------------------------
async function findInvalidAges(hospitalId) {
    const snapshot = await db.collection('hospitals')
        .doc(hospitalId)
        .collection('completed_cases')
        .get();

    let invalidPatients = [];
    let totalPatients = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        totalPatients++;

        const age = data?.patientInfo?.age;

        if (
            age === undefined ||
            age === null ||
            age === '' ||
            isNaN(age) ||
            Number(age) < 0
        ) {
            invalidPatients.push({
                id: doc.id,
                name: data?.patientInfo?.name ?? '이름 없음',
                age: age
            });
        }
    });

    console.log(`📊 전체 환자 수: ${totalPatients}명`);
    console.log(`❗ 나이 누락/비정상 데이터 수: ${invalidPatients.length}명`);
    console.table(invalidPatients);
}
